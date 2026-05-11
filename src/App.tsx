import { useBTStore } from './store/useBTStore';
import { Toolbar } from './components/Toolbar';
import { NodePalette } from './components/NodePalette';
import { BTEditor } from './components/BTEditor';
import { PropertiesPanel } from './components/PropertiesPanel';
import { VariablePanel } from './components/VariablePanel';
import { BTNodeType } from './engine/types';
import { useEffect } from 'react';
import './App.css';

export default function App() {
  const nodes = useBTStore((s) => s.nodes);
  const addNode = useBTStore((s) => s.addNode);

  // Auto-create root node if tree is empty
  useEffect(() => {
    const hasRoot = nodes.some((n) => n.data.type === BTNodeType.ROOT);
    if (!hasRoot && nodes.length === 0) {
      addNode(BTNodeType.ROOT, { x: 400, y: 50 });
    }
  }, [nodes, addNode]);

  return (
    <div className="app">
      <Toolbar />
      <div className="main-layout">
        <NodePalette />
        <BTEditor />
        <div className="right-panels">
          <PropertiesPanel />
          <VariablePanel />
        </div>
      </div>
    </div>
  );
}
