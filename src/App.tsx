import { useCallback, useEffect, useRef, useState } from 'react';
import { useBTStore } from './store/useBTStore';
import { Toolbar } from './components/Toolbar';
import { NodePalette } from './components/NodePalette';
import { BTEditor } from './components/BTEditor';
import { PropertiesPanel } from './components/PropertiesPanel';
import { VariableDetail } from './components/VariableDetail';
import { BTNodeType } from './engine/types';
import type { BTNode } from './engine/types';
import { isShowcaseMode } from './config/appMode';
import { preloadActionCatalog, type ActionConfig } from './config/actionCatalog';
import { preloadVideoFrames } from './utils/mediaPreloader';
import './App.css';

const MIN_LEFT = 100;
const MAX_LEFT = 400;
const DEFAULT_LEFT = 180;
const MIN_RIGHT = 200;
const MAX_RIGHT = 500;
const DEFAULT_RIGHT = 280;

const STORAGE_KEY = 'behavior-tree-data';
const DEFAULT_TREE_PATH = '/电龙AI.json';
const INITIAL_MEDIA_WARMUP_MS = 1200;

interface InitialLoadingState {
  visible: boolean;
  progress: number;
}

async function loadPublishedTree() {
  const res = await fetch(DEFAULT_TREE_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load default tree: ${res.status}`);
  const json = await res.text();
  useBTStore.getState().importTree(json);
}

function getRequestedTreePath(): string | null {
  const value = new URLSearchParams(window.location.search).get('tree')?.trim();
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

async function loadTreeFromPath(treePath: string) {
  const res = await fetch(treePath, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load tree ${treePath}: ${res.status}`);
  const json = await res.text();
  useBTStore.getState().importTree(json);
}

function collectMediaPathsFromCurrentTree(actionCatalog: ActionConfig[]): string[] {
  const state = useBTStore.getState();
  const actionById = new Map(actionCatalog.map((action) => [action.actionId, action]));
  const allNodes: BTNode[] = [
    ...state.nodes,
    ...state.pages.flatMap((page) => page.nodes),
    ...state.functions.flatMap((func) => func.nodes),
  ];

  return allNodes
    .filter((node) => node.data.type === BTNodeType.ACTION || node.data.type === BTNodeType.COMBO_SHOW)
    .map((node) => node.data.actionId ? actionById.get(node.data.actionId)?.gifPath : undefined)
    .filter((path): path is string => Boolean(path));
}

export default function App() {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  const [initialLoading, setInitialLoading] = useState<InitialLoadingState>({
    visible: true,
    progress: 6,
  });
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const selectedVariableId = useBTStore((s) => s.selectedVariableId);

  const onResizeMouseDown = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const target = side === 'left' ? leftPanelRef.current : rightPanelRef.current;
    if (!target) return;

    const onMouseMove = (ev: MouseEvent) => {
      const w = side === 'left'
        ? Math.min(MAX_LEFT, Math.max(MIN_LEFT, ev.clientX))
        : Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, window.innerWidth - ev.clientX));
      target.style.width = `${w}px`;
    };

    const onMouseUp = () => {
      const finalW = parseFloat(target.style.width);
      if (side === 'left') setLeftWidth(finalW);
      else setRightWidth(finalW);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Load the tree according to the current app mode.
  useEffect(() => {
    let cancelled = false;
    let warmupTimer: number | undefined;

    const updateLoadingProgress = (progress: number) => {
      if (cancelled) return;
      setInitialLoading((current) => ({
        visible: true,
        progress: Math.max(current.progress, Math.min(100, Math.round(progress))),
      }));
    };

    const finishLoading = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          warmupTimer = window.setTimeout(() => {
            if (!cancelled) {
              setInitialLoading({ visible: true, progress: 100 });
              window.setTimeout(() => {
                if (!cancelled) {
                  setInitialLoading((current) => ({ ...current, visible: false }));
                }
              }, 250);
            }
          }, INITIAL_MEDIA_WARMUP_MS);
        });
      });
    };

    const catalogPromise = preloadActionCatalog().catch((error) => {
      console.error(error);
      return [];
    });

    const preloadTreeMediaAndFinish = async () => {
      const actionCatalog = await catalogPromise;
      updateLoadingProgress(24);
      const mediaPaths = collectMediaPathsFromCurrentTree(actionCatalog);
      if (mediaPaths.length > 0) {
        await preloadVideoFrames(mediaPaths, {
          onProgress: (loaded, total) => {
            updateLoadingProgress(24 + (loaded / total) * 70);
          },
        });
      } else {
        updateLoadingProgress(94);
      }
      finishLoading();
    };

    const loadInitialTree = async () => {
      updateLoadingProgress(8);
      const requestedTreePath = getRequestedTreePath();

      if (requestedTreePath) {
        try {
          await loadTreeFromPath(requestedTreePath);
        } catch (error) {
          console.error(error);
          await loadPublishedTree();
        }
        updateLoadingProgress(20);
        await preloadTreeMediaAndFinish();
        return;
      }

      if (isShowcaseMode) {
        try {
          await loadPublishedTree();
        } catch (error) {
          console.error(error);
          const state = useBTStore.getState();
          if (!state.nodes.some((n) => n.data.type === BTNodeType.ROOT)) {
            state.addNode(BTNodeType.ROOT, { x: 100, y: 200 }, { label: state.mainPageName });
          }
        }
        updateLoadingProgress(20);
        await preloadTreeMediaAndFinish();
        return;
      }

      try {
        await loadPublishedTree();
      } catch (error) {
        console.error(error);
        const state = useBTStore.getState();
        const hasRoot = state.nodes.some((n) => n.data.type === BTNodeType.ROOT);
        if (!hasRoot) {
          // Clear possibly corrupted saved state
          localStorage.removeItem(STORAGE_KEY);
          state.addNode(BTNodeType.ROOT, { x: 100, y: 200 }, { label: state.mainPageName });
        }
      }
      updateLoadingProgress(20);
      await preloadTreeMediaAndFinish();
    };

    void loadInitialTree();

    return () => {
      cancelled = true;
      if (warmupTimer !== undefined) window.clearTimeout(warmupTimer);
    };
  }, []);

  // Keep a local snapshot for recovery/debugging, but startup always loads the explicit/default JSON.
  useEffect(() => {
    if (isShowcaseMode) return;
    const unsub = useBTStore.subscribe((state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        nodes: state.nodes, edges: state.edges,
        variables: state.variables, functions: state.functions,
        pages: state.pages, mainPageName: state.mainPageName,
      }));
    });
    return unsub;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (isShowcaseMode) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useBTStore.getState().undo();
      }
      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useBTStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      <Toolbar />

      {/* Floating expand button when collapsed */}
      {panelsCollapsed && (
        <button
          className="float-expand-btn"
          onClick={() => setPanelsCollapsed(false)}
          title="展开面版"
        >
          ▶
        </button>
      )}

      <div className="main-layout">
        {!panelsCollapsed && (
          <>
            <div ref={leftPanelRef} style={{ width: leftWidth, flexShrink: 0, display: 'flex' }}>
              <NodePalette width={leftWidth} onToggleCollapse={() => setPanelsCollapsed(true)} />
            </div>
            <div className="resize-handle resize-handle-left" onMouseDown={onResizeMouseDown('left')} />
          </>
        )}
        <BTEditor />
        {!panelsCollapsed && (
          <>
            <div className="resize-handle resize-handle-right" onMouseDown={onResizeMouseDown('right')} />
            <div ref={rightPanelRef} className="right-panels" style={{ width: rightWidth }}>
              {selectedVariableId ? <VariableDetail /> : <PropertiesPanel />}
            </div>
          </>
        )}
      </div>

      {initialLoading.visible && (
        <div className="initial-loading" role="status" aria-live="polite">
          <div className="initial-loading-panel">
            <div className="initial-loading-title">加载中</div>
            <div
              className="initial-loading-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={initialLoading.progress}
            >
              <div
                className="initial-loading-progress-fill"
                style={{ width: `${initialLoading.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
