import { useCallback, useMemo, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  type ReactFlowInstance,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BTNodeRenderer } from '../nodes/BTNodeRenderer';
import { BTEdge } from '../edges/BTEdge';
import { useBTStore } from '../store/useBTStore';
import { BTNodeType } from '../engine/types';

const nodeTypes = {
  'bt-node': BTNodeRenderer,
};

const edgeTypes = {
  'bt-edge': BTEdge,
};

const defaultEdgeOptions = {
  type: 'bt-edge' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
};

export function BTEditor() {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const nodes = useBTStore((s) => s.nodes);
  const edges = useBTStore((s) => s.edges);
  const selectedNodeId = useBTStore((s) => s.selectedNodeId);
  const addNode = useBTStore((s) => s.addNode);
  const updateNodePosition = useBTStore((s) => s.updateNodePosition);
  const removeNode = useBTStore((s) => s.removeNode);
  const addEdgeStore = useBTStore((s) => s.addEdge);
  const removeEdge = useBTStore((s) => s.removeEdge);
  const setSelectedNode = useBTStore((s) => s.setSelectedNode);

  // Derive React Flow nodes from store with selection state
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        type: 'bt-node',
        selected: n.id === selectedNodeId,
        data: { ...n.data },
      })) as Node[],
    [nodes, selectedNodeId]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: 'bt-edge',
      })) as Edge[],
    [edges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position);
        }
        if (change.type === 'select' && change.selected && change.id) {
          setSelectedNode(change.id);
        }
        // 'remove' changes are handled by onNodesDelete
      }
    },
    [updateNodePosition, setSelectedNode]
  );

  const onEdgesChange = useCallback(() => {
    // Edge position/label changes not relevant for BT
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      addEdgeStore(
        connection.source,
        connection.target,
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );
    },
    [addEdgeStore]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((n) => removeNode(n.id));
    },
    [removeNode]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => removeEdge(e.id));
    },
    [removeEdge]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/node-type') as BTNodeType;
      if (!nodeType) return;

      const rfBounds = reactFlowRef.current?.getBoundingClientRect();
      const rfInstance = rfInstanceRef.current;
      if (!rfBounds || !rfInstance) return;

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(nodeType, position);
    },
    [addNode]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.2 }), 100);
  }, []);

  return (
    <div className="bt-editor" ref={reactFlowRef}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        snapToGrid
        snapGrid={[20, 20]}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor={(n) => {
            const type = (n.data as { type?: string })?.type;
            if (type === 'root') return '#6366f1';
            if (type === 'selector') return '#f59e0b';
            if (type === 'sequence') return '#3b82f6';
            if (type === 'action') return '#22c55e';
            return '#475569';
          }}
          style={{ background: '#0f172a' }}
        />
      </ReactFlow>
    </div>
  );
}
