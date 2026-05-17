import { useCallback, useEffect, useRef, useState } from 'react';
import { useBTStore } from './store/useBTStore';
import { Toolbar } from './components/Toolbar';
import { NodePalette } from './components/NodePalette';
import { BTEditor } from './components/BTEditor';
import { PropertiesPanel } from './components/PropertiesPanel';
import { BTNodeType } from './engine/types';
import './App.css';

const MIN_LEFT = 100;
const MAX_LEFT = 400;
const DEFAULT_LEFT = 180;
const MIN_RIGHT = 200;
const MAX_RIGHT = 500;
const DEFAULT_RIGHT = 280;

const STORAGE_KEY = 'behavior-tree-data';

export default function App() {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

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

  // Load from localStorage on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        useBTStore.getState().importTree(saved);
      }
    } catch { /* ignore */ }

    const state = useBTStore.getState();
    const hasRoot = state.nodes.some((n) => n.data.type === BTNodeType.ROOT);
    if (!hasRoot) {
      // Clear possibly corrupted saved state
      localStorage.removeItem(STORAGE_KEY);
      state.addNode(BTNodeType.ROOT, { x: 100, y: 200 });
    }
  }, []);

  // Auto-save
  useEffect(() => {
    const unsub = useBTStore.subscribe((state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        nodes: state.nodes, edges: state.edges,
        variables: state.variables, functions: state.functions,
      }));
    });
    return unsub;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        const state = useBTStore.getState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          nodes: state.nodes, edges: state.edges,
          variables: state.variables, functions: state.functions,
        }));
      }
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
              <PropertiesPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
