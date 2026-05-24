import { useEffect, useMemo, useState } from 'react';

export interface ActionConfig {
  actionId: string;
  actionName: string;
  gifPath: string;
  comment: string;
}

let catalogCache: ActionConfig[] | null = null;
let catalogPromise: Promise<ActionConfig[]> | null = null;
const CATALOG_UPDATED_EVENT = 'action-catalog-updated';
const ACTION_CATALOG_PATH = '/config/Actions.json';

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
        catalogCache = items;
        return items;
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
