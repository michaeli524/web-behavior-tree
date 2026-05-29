import { useEffect, useMemo, useState } from 'react';

export interface ActionConfig {
  actionId: string;
  actionName: string;
  gifPath: string;
  comment: string;
}

interface AssetHostConfig {
  assetBaseUrl?: string;
}

let catalogCache: ActionConfig[] | null = null;
let catalogPromise: Promise<ActionConfig[]> | null = null;
let assetBaseUrlCache: string | null = null;
let assetBaseUrlPromise: Promise<string> | null = null;
const CATALOG_UPDATED_EVENT = 'action-catalog-updated';
const ACTION_CATALOG_PATH = '/config/Actions.json';
const ASSET_HOST_PATH = '/config/asset-host.json';

function isExternalUrl(path: string) {
  return /^(https?:)?\/\//i.test(path) || /^(data|blob):/i.test(path);
}

function joinAssetUrl(assetBaseUrl: string, path: string) {
  if (!path || !assetBaseUrl || isExternalUrl(path)) return path;
  const base = assetBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function loadAssetBaseUrl(force = false): Promise<string> {
  if (force) {
    assetBaseUrlCache = null;
    assetBaseUrlPromise = null;
  }
  if (assetBaseUrlCache !== null) return assetBaseUrlCache;
  if (!assetBaseUrlPromise) {
    const query = force ? `?t=${Date.now()}` : '';
    assetBaseUrlPromise = fetch(`${ASSET_HOST_PATH}${query}`)
      .then((res) => {
        if (!res.ok) return {} as AssetHostConfig;
        return res.json() as Promise<AssetHostConfig>;
      })
      .then((config) => config.assetBaseUrl?.trim().replace(/\/+$/, '') ?? '')
      .catch(() => '');
  }
  assetBaseUrlCache = await assetBaseUrlPromise;
  return assetBaseUrlCache;
}

async function loadActionCatalog(force = false): Promise<ActionConfig[]> {
  if (force) {
    catalogCache = null;
    catalogPromise = null;
  }
  if (catalogCache) return catalogCache;
  if (!catalogPromise) {
    const query = force ? `?t=${Date.now()}` : '';
    catalogPromise = fetch(`${ACTION_CATALOG_PATH}${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load Actions.json: ${res.status}`);
        return res.json() as Promise<ActionConfig[]>;
      })
      .then((items) => {
        return loadAssetBaseUrl(force).then((assetBaseUrl) => {
          const resolvedItems = items.map((item) => ({
            ...item,
            gifPath: joinAssetUrl(assetBaseUrl, item.gifPath),
          }));
          catalogCache = resolvedItems;
          return resolvedItems;
        });
      });
  }
  return catalogPromise;
}

export async function refreshActionCatalog(): Promise<ActionConfig[]> {
  const items = await loadActionCatalog(true);
  window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
  return items;
}

export async function exportActionCatalogFromExcel(): Promise<{ count: number; source: string; target: string }> {
  const response = await fetch('/api/export-actions', { method: 'POST' });
  const data = await response.json() as {
    ok: boolean;
    count?: number;
    source?: string;
    target?: string;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? '导表失败');
  }

  await refreshActionCatalog();
  return {
    count: data.count ?? 0,
    source: data.source ?? 'public/config/Actions.xlsx',
    target: data.target ?? 'public/config/Actions.json',
  };
}

export function useActionCatalog() {
  const [actions, setActions] = useState<ActionConfig[]>(catalogCache ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = (force = false) => {
      loadActionCatalog(force)
        .then((items) => {
          if (!cancelled) {
            setActions(items);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    };

    load();

    const onCatalogUpdated = () => load(true);
    window.addEventListener(CATALOG_UPDATED_EVENT, onCatalogUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(CATALOG_UPDATED_EVENT, onCatalogUpdated);
    };
  }, []);

  const actionById = useMemo(() => {
    return new Map(actions.map((action) => [action.actionId, action]));
  }, [actions]);

  return { actions, actionById, error };
}
