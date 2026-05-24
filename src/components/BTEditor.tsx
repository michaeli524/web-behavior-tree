import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type OnConnectStartParams,
  SelectionMode,
  type ReactFlowInstance,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BTNodeRenderer } from '../nodes/BTNodeRenderer';
import { BTEdge } from '../edges/BTEdge';
import { useBTStore } from '../store/useBTStore';
import {
  BTExecutionStatus,
  BTNodeType,
  type BTEdge as BTStoreEdge,
  type BTEdgeReroutePoint,
  type BTNode,
  type BTNodeData,
} from '../engine/types';
import { useActionCatalog } from '../config/actionCatalog';
import { generateId } from '../utils/idGenerator';

const nodeTypes = {
  'bt-node': BTNodeRenderer,
};

const edgeTypes = {
  'bt-edge': BTEdge,
};

const defaultEdgeOptions = {
  type: 'bt-edge' as const,
};

const SNAP_GRID: [number, number] = [10, 10];
const PASTE_OFFSET = 40;

function snapPosition(position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / SNAP_GRID[0]) * SNAP_GRID[0],
    y: Math.round(position.y / SNAP_GRID[1]) * SNAP_GRID[1],
  };
}

type NodeClipboard = {
  nodes: BTNode[];
  edges: BTStoreEdge[];
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable;
}

function cloneNodeData(data: BTNodeData): BTNodeData {
  return {
    ...JSON.parse(JSON.stringify(data)),
    status: BTExecutionStatus.IDLE,
  };
}

function isExecutionEdge(edge: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}) {
  return edge.sourceHandle !== 'data-out' && edge.targetHandle !== 'data-in';
}

const staticQuickCreateTypes: { type: BTNodeType; icon: string; label: string }[] = [
  { type: BTNodeType.SELECTOR, icon: '❓', label: 'Selector' },
  { type: BTNodeType.SEQUENCE, icon: '→', label: 'Sequence' },
  { type: BTNodeType.PARALLEL, icon: '⇉', label: 'Parallel' },
  { type: BTNodeType.DIST_SELECTOR, icon: '📏', label: 'Dist Selector' },
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare' },
  { type: BTNodeType.TEST, icon: '🧪', label: 'Test' },
  { type: BTNodeType.CONDITION, icon: '◆', label: 'Condition' },
  { type: BTNodeType.INVERTER, icon: '¬', label: 'Inverter' },
  { type: BTNodeType.REPEATER, icon: '↻', label: 'Repeater' },
  { type: BTNodeType.SUCCEEDER, icon: '✓', label: 'Succeeder' },
  { type: BTNodeType.ACTION, icon: '⚡', label: 'Action' },
  { type: BTNodeType.APPROACH, icon: '🏃', label: 'Approach' },
  { type: BTNodeType.WAIT, icon: '⏱', label: 'Wait' },
];

export function BTEditor() {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nodeClipboardRef = useRef<NodeClipboard | null>(null);
  const pasteCountRef = useRef(0);

  // Connection drag tracking — manual approach instead of onConnectEnd
  const connectDragRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectMadeRef = useRef(false);

  const [quickCreate, setQuickCreate] = useState<{
    sourceId: string;
    sourceHandleId?: string;
    screenX: number;
    screenY: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [actionPreview, setActionPreview] = useState<{
    actionId: string;
    actionName: string;
    gifPath: string;
  } | null>(null);
  const [selectedReroutePoint, setSelectedReroutePoint] = useState<{
    edgeId: string;
    pointId: string;
  } | null>(null);

  // Variable drop → Get/Set popup
  const [varDropPopup, setVarDropPopup] = useState<{
    variableId: string;
    flowPosition: { x: number; y: number };
    screenX: number;
    screenY: number;
  } | null>(null);

  // Reset search when popup opens/closes
  useEffect(() => {
    if (!quickCreate) setSearchFilter('');
  }, [quickCreate]);

  const storeNodes = useBTStore((s) => s.nodes);
  const storeEdges = useBTStore((s) => s.edges);
  const storePages = useBTStore((s) => s.pages);
  const functions = useBTStore((s) => s.functions);
  const variables = useBTStore((s) => s.variables);
  const selectedNodeIds = useBTStore((s) => s.selectedNodeIds);
  const activePageId = useBTStore((s) => s.activePageId);
  const { actionById } = useActionCatalog();

  // Resolve nodes/edges based on active page
  const nodes = useMemo(() => {
    if (activePageId === 'main') return storeNodes;
    const page = storePages.find((p) => p.id === activePageId);
    if (page) return page.nodes;
    const func = functions.find((f) => f.id === activePageId);
    return func?.nodes ?? [];
  }, [activePageId, storeNodes, storePages, functions]);

  const edges = useMemo(() => {
    if (activePageId === 'main') return storeEdges;
    const page = storePages.find((p) => p.id === activePageId);
    if (page) return page.edges;
    const func = functions.find((f) => f.id === activePageId);
    return func?.edges ?? [];
  }, [activePageId, storeEdges, storePages, functions]);

  const isMainTree = activePageId === 'main';
  const isPage = storePages.some((p) => p.id === activePageId);

  const addNodeStore = useBTStore((s) => s.addNode);
  const updateNodePositionStore = useBTStore((s) => s.updateNodePosition);
  const removeNodeStore = useBTStore((s) => s.removeNode);
  const addEdgeStoreStore = useBTStore((s) => s.addEdge);
  const removeEdgeStore = useBTStore((s) => s.removeEdge);
  const updateEdgeReroutePointsStore = useBTStore((s) => s.updateEdgeReroutePoints);

  const addPageNode = useBTStore((s) => s.addPageNode);
  const updatePageNodePos = useBTStore((s) => s.updatePageNodePosition);
  const removePageNode = useBTStore((s) => s.removePageNode);
  const addPageEdge = useBTStore((s) => s.addPageEdge);
  const removePageEdge = useBTStore((s) => s.removePageEdge);
  const updatePageEdgeReroutePoints = useBTStore((s) => s.updatePageEdgeReroutePoints);

  const addFuncNode = useBTStore((s) => s.addFunctionNode);
  const updateFuncNodePos = useBTStore((s) => s.updateFunctionNodePosition);
  const removeFuncNode = useBTStore((s) => s.removeFunctionNode);
  const addFuncEdge = useBTStore((s) => s.addFunctionEdge);
  const removeFuncEdge = useBTStore((s) => s.removeFunctionEdge);
  const updateFuncEdgeReroutePoints = useBTStore((s) => s.updateFunctionEdgeReroutePoints);

  const setSelectedNodes = useBTStore((s) => s.setSelectedNodes);
  const setActivePageId = useBTStore((s) => s.setActivePageId);

  // Route actions to main / page / function tree
  const addNode = useCallback(
    (type: BTNodeType, pos: { x: number; y: number }, data?: Partial<BTNodeData>) => {
      if (isMainTree) return addNodeStore(type, pos, data);
      if (isPage) return addPageNode(activePageId, type, pos, data);
      return addFuncNode(activePageId, type, pos, data);
    },
    [isMainTree, isPage, activePageId, addNodeStore, addPageNode, addFuncNode]
  );

  const updateNodePosition = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      const snappedPos = snapPosition(pos);
      if (isMainTree) return updateNodePositionStore(id, snappedPos);
      if (isPage) return updatePageNodePos(activePageId, id, snappedPos);
      return updateFuncNodePos(activePageId, id, snappedPos);
    },
    [isMainTree, isPage, activePageId, updateNodePositionStore, updatePageNodePos, updateFuncNodePos]
  );

  const removeNode = useCallback(
    (id: string) => {
      if (isMainTree) return removeNodeStore(id);
      if (isPage) return removePageNode(activePageId, id);
      return removeFuncNode(activePageId, id);
    },
    [isMainTree, isPage, activePageId, removeNodeStore, removePageNode, removeFuncNode]
  );

  const addEdgeStore = useCallback(
    (source: string, target: string, sourceHandle?: string, targetHandle?: string) => {
      if (isMainTree) return addEdgeStoreStore(source, target, sourceHandle, targetHandle);
      if (isPage) return addPageEdge(activePageId, source, target, sourceHandle, targetHandle);
      return addFuncEdge(activePageId, source, target, sourceHandle, targetHandle);
    },
    [isMainTree, isPage, activePageId, addEdgeStoreStore, addPageEdge, addFuncEdge]
  );

  const removeEdge = useCallback(
    (id: string) => {
      if (isMainTree) return removeEdgeStore(id);
      if (isPage) return removePageEdge(activePageId, id);
      return removeFuncEdge(activePageId, id);
    },
    [isMainTree, isPage, activePageId, removeEdgeStore, removePageEdge, removeFuncEdge]
  );

  const updateEdgeReroutePoints = useCallback(
    (id: string, reroutePoints: BTEdgeReroutePoint[]) => {
      if (isMainTree) return updateEdgeReroutePointsStore(id, reroutePoints);
      if (isPage) return updatePageEdgeReroutePoints(activePageId, id, reroutePoints);
      return updateFuncEdgeReroutePoints(activePageId, id, reroutePoints);
    },
    [
      isMainTree,
      isPage,
      activePageId,
      updateEdgeReroutePointsStore,
      updatePageEdgeReroutePoints,
      updateFuncEdgeReroutePoints,
    ]
  );

  const selectReroutePoint = useCallback(
    (edgeId: string, pointId: string) => {
      setSelectedNodes([]);
      setSelectedReroutePoint({ edgeId, pointId });
    },
    [setSelectedNodes]
  );

  const moveReroutePoint = useCallback(
    (edgeId: string, pointId: string, position: { x: number; y: number }) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const snappedPosition = snapPosition(position);
      const reroutePoints = (edge.data?.reroutePoints ?? []).map((point) =>
        point.id === pointId
          ? { ...point, x: snappedPosition.x, y: snappedPosition.y }
          : point
      );
      updateEdgeReroutePoints(edgeId, reroutePoints);
    },
    [edges, updateEdgeReroutePoints]
  );

  // ----- React Flow node/edge derivation -----
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        type: 'bt-node',
        selected: selectedNodeIds.includes(n.id),
        data: { ...n.data },
        zIndex: n.data.type === BTNodeType.COMMENT ? -1 : undefined,
        dragHandle: n.data.type === BTNodeType.COMMENT ? '.bt-comment-title' : undefined,
      })) as Node[],
    [nodes, selectedNodeIds]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: 'bt-edge',
        data: {
          ...e.data,
          selectedReroutePointId:
            selectedReroutePoint?.edgeId === e.id ? selectedReroutePoint.pointId : null,
          onReroutePointSelect: selectReroutePoint,
          onReroutePointMove: moveReroutePoint,
        },
      })) as Edge[],
    [edges, selectedReroutePoint, selectReroutePoint, moveReroutePoint]
  );

  // ----- React Flow event handlers -----
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateNodePosition(change.id, change.position);
        }
      }
    },
    [updateNodePosition]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      setSelectedNodes(selNodes.map((n) => n.id));
      if (selNodes.length > 0) setSelectedReroutePoint(null);
    },
    [setSelectedNodes]
  );

  const onEdgesChange = useCallback(() => {}, []);

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (!params.nodeId) return;
      connectDragRef.current = { nodeId: params.nodeId, handleId: params.handleId };
      connectMadeRef.current = false;
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      connectMadeRef.current = true;
      addEdgeStore(
        connection.source,
        connection.target,
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );
    },
    [addEdgeStore]
  );

  // Detect end of connection drag via window mouseup
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (!connectDragRef.current) return;

      // Delay to let React Flow's onConnect fire first
      requestAnimationFrame(() => {
        if (connectMadeRef.current) {
          connectDragRef.current = null;
          return;
        }

        const rfInstance = rfInstanceRef.current;
        if (!rfInstance) {
          connectDragRef.current = null;
          return;
        }

        const flowPosition = snapPosition(rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }));

        setQuickCreate({
          sourceId: connectDragRef.current!.nodeId,
          sourceHandleId: connectDragRef.current!.handleId ?? undefined,
          screenX: e.clientX,
          screenY: e.clientY,
          flowPosition,
        });

        connectDragRef.current = null;
      });
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleQuickCreate = useCallback(
    (nodeType: BTNodeType, extraId?: string) => {
      if (!quickCreate) return;

      const data: Partial<BTNodeData> = {};
      if (nodeType === BTNodeType.FUNCTION && extraId) {
        data.functionId = extraId;
      }
      if ((nodeType === BTNodeType.GET_VARIABLE || nodeType === BTNodeType.SET_VARIABLE) && extraId) {
        data.variableId = extraId;
      }

      const newId = addNode(nodeType, quickCreate.flowPosition, data);
      if (quickCreate.sourceId) {
        addEdgeStore(quickCreate.sourceId, newId, quickCreate.sourceHandleId, undefined);
      }
      setQuickCreate(null);
    },
    [quickCreate, addNode, addEdgeStore]
  );

  const dismissQuickCreate = useCallback(() => {
    setQuickCreate(null);
  }, []);

  const handleVarDrop = useCallback((mode: 'get' | 'set') => {
    if (!varDropPopup) return;
    const nodeType = mode === 'get' ? BTNodeType.GET_VARIABLE : BTNodeType.SET_VARIABLE;
    addNode(nodeType, varDropPopup.flowPosition, {
      variableId: varDropPopup.variableId,
    });
    setVarDropPopup(null);
  }, [varDropPopup, addNode]);

  // Dynamic quick-create list including user functions + variables
  const allQuickCreateTypes = useMemo(() => {
    const funcTypes = functions.map((f) => ({
      type: BTNodeType.FUNCTION,
      icon: '📦',
      label: f.name,
      functionId: f.id,
    }));
    const varGetTypes = variables.map((v) => ({
      type: BTNodeType.GET_VARIABLE,
      icon: '📤',
      label: `Get: ${v.name}`,
      variableId: v.id,
    }));
    const varSetTypes = variables.map((v) => ({
      type: BTNodeType.SET_VARIABLE,
      icon: '📥',
      label: `Set: ${v.name}`,
      variableId: v.id,
    }));
    return [...staticQuickCreateTypes, ...funcTypes, ...varGetTypes, ...varSetTypes];
  }, [functions, variables]);

  const filteredQuickCreateTypes = useMemo(() => {
    if (!searchFilter.trim()) return allQuickCreateTypes;
    const lower = searchFilter.toLowerCase();
    const exact: typeof allQuickCreateTypes = [];
    const prefix: typeof allQuickCreateTypes = [];
    const rest: typeof allQuickCreateTypes = [];
    for (const item of allQuickCreateTypes) {
      const label = item.label.toLowerCase();
      if (!label.includes(lower)) continue;
      if (label === lower) exact.push(item);
      else if (label.startsWith(lower)) prefix.push(item);
      else rest.push(item);
    }
    return [...exact, ...prefix, ...rest];
  }, [allQuickCreateTypes, searchFilter]);

  // Close popups on Escape
  useEffect(() => {
    if (!quickCreate && !varDropPopup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickCreate(null);
        setVarDropPopup(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quickCreate, varDropPopup]);

  useEffect(() => {
    if (!actionPreview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionPreview(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actionPreview]);

  useEffect(() => {
    if (!selectedReroutePoint) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (isEditableTarget(e.target)) return;

      const edge = edges.find((item) => item.id === selectedReroutePoint.edgeId);
      if (!edge) {
        setSelectedReroutePoint(null);
        return;
      }

      const reroutePoints = (edge.data?.reroutePoints ?? []).filter(
        (point) => point.id !== selectedReroutePoint.pointId
      );
      updateEdgeReroutePoints(edge.id, reroutePoints);
      setSelectedReroutePoint(null);
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [edges, selectedReroutePoint, updateEdgeReroutePoints]);

  // ----- Other handlers -----
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodes([node.id]);
      setSelectedReroutePoint(null);
    },
    [setSelectedNodes]
  );

  const onNodeContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      e.preventDefault();
    },
    []
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const data = node.data as unknown as BTNodeData;
      if (data.type === BTNodeType.FUNCTION && data.functionId) {
        setActivePageId(data.functionId);
      }
      if (data.type === BTNodeType.ACTION && data.actionId) {
        const actionConfig = actionById.get(data.actionId);
        if (!actionConfig?.gifPath) return;
        setActionPreview({
          actionId: actionConfig.actionId,
          actionName: actionConfig.actionName,
          gifPath: actionConfig.gifPath,
        });
      }
    },
    [actionById, setActivePageId]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((n) => {
        const nd = n.data as unknown as BTNodeData;
        if (nd.type !== BTNodeType.ROOT) removeNode(n.id);
      });
    },
    [removeNode]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (key !== 'c' && key !== 'v') return;

      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;

      if (key === 'c') {
        const selectedIds = new Set(selectedNodeIds);
        rfInstance.getNodes().forEach((n) => {
          if (n.selected) selectedIds.add(n.id);
        });

        const copiedNodes = nodes
          .filter((n) => selectedIds.has(n.id) && n.data.type !== BTNodeType.ROOT)
          .map((n) => ({
            ...n,
            position: { ...n.position },
            data: cloneNodeData(n.data),
          }));

        if (copiedNodes.length === 0) {
          nodeClipboardRef.current = null;
          pasteCountRef.current = 0;
          e.preventDefault();
          return;
        }

        const copiedIds = new Set(copiedNodes.map((n) => n.id));
        const copiedEdges = edges
          .filter((edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target))
          .map((edge) => ({ ...edge }));

        nodeClipboardRef.current = {
          nodes: copiedNodes,
          edges: copiedEdges,
        };
        pasteCountRef.current = 0;
        e.preventDefault();
        return;
      }

      const clipboard = nodeClipboardRef.current;
      if (!clipboard || clipboard.nodes.length === 0) return;

      pasteCountRef.current += 1;
      const offset = PASTE_OFFSET * pasteCountRef.current;
      const idMap = new Map<string, string>();
      const newSelectedIds: string[] = [];

      clipboard.nodes.forEach((node) => {
        if (node.data.type === BTNodeType.ROOT) return;

        const newId = addNode(node.data.type, snapPosition({
          x: node.position.x + offset,
          y: node.position.y + offset,
        }), cloneNodeData(node.data));
        idMap.set(node.id, newId);
        newSelectedIds.push(newId);
      });

      clipboard.edges.forEach((edge) => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);
        if (!source || !target) return;
        addEdgeStore(source, target, edge.sourceHandle, edge.targetHandle);
      });

      setSelectedNodes(newSelectedIds);
      e.preventDefault();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addEdgeStore, addNode, edges, nodes, selectedNodeIds, setSelectedNodes]);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedReroutePoint(null);
      if (_event.metaKey || _event.altKey) {
        removeEdge(edge.id);
      }
    },
    [removeEdge]
  );

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!isExecutionEdge(edge)) return;
      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;
      event.preventDefault();
      event.stopPropagation();

      const point = {
        id: generateId('reroute'),
        ...snapPosition(rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })),
      };
      const reroutePoints = [
        ...((edge.data?.reroutePoints as BTEdgeReroutePoint[] | undefined) ?? []),
        point,
      ];
      updateEdgeReroutePoints(edge.id, reroutePoints);
      setSelectedReroutePoint({ edgeId: edge.id, pointId: point.id });
    },
    [updateEdgeReroutePoints]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (selectedReroutePoint && deletedEdges.some((e) => e.id === selectedReroutePoint.edgeId)) {
        setSelectedReroutePoint(null);
      }
      deletedEdges.forEach((e) => removeEdge(e.id));
    },
    [removeEdge, selectedReroutePoint]
  );

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      e.preventDefault();
      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;
      const flowPosition = snapPosition(rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      setQuickCreate({
        sourceId: '',
        sourceHandleId: undefined,
        screenX: e.clientX,
        screenY: e.clientY,
        flowPosition,
      });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodes([]);
    setSelectedReroutePoint(null);
    setQuickCreate(null);
    setVarDropPopup(null);
  }, [setSelectedNodes]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      // Variable drop → Get/Set with modifier keys
      const variableId = event.dataTransfer.getData('application/variable-id');
      if (variableId) {
        const rfInstance = rfInstanceRef.current;
        if (!rfInstance) return;
        const flowPosition = snapPosition(rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        const modKey = event.metaKey || event.altKey;

        if (modKey) {
          // Cmd/Alt → Get
          addNode(BTNodeType.GET_VARIABLE, flowPosition, {
            variableId,
          });
        } else if (event.ctrlKey) {
          // Ctrl → Set
          addNode(BTNodeType.SET_VARIABLE, flowPosition, {
            variableId,
          });
        } else {
          // No modifier → popup
          setVarDropPopup({
            variableId,
            flowPosition,
            screenX: event.clientX,
            screenY: event.clientY,
          });
        }
        return;
      }

      const nodeType = event.dataTransfer.getData('application/node-type') as BTNodeType;
      if (!nodeType) return;

      const rfBounds = reactFlowRef.current?.getBoundingClientRect();
      const rfInstance = rfInstanceRef.current;
      if (!rfBounds || !rfInstance) return;

      const position = snapPosition(rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }));

      const data: Partial<BTNodeData> = {};
      if (nodeType === BTNodeType.FUNCTION) {
        const functionId = event.dataTransfer.getData('application/function-id');
        const functionLabel = event.dataTransfer.getData('application/function-label');
        if (functionId) {
          data.functionId = functionId;
        }
        if (functionLabel) {
          data.label = functionLabel;
        }
      }

      addNode(nodeType, position, data);
    },
    [addNode]
  );

  const isValidConnection = useCallback((conn: Connection | Edge) => {
    const sourceHandle = conn.sourceHandle ?? null;
    const targetHandle = conn.targetHandle ?? null;
    const sourceIsData = sourceHandle === 'data-out';
    const targetIsData = targetHandle === 'data-in';
    if (sourceIsData || targetIsData) {
      return sourceIsData && targetIsData;
    }
    return true;
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.2 }), 100);
  }, []);

  // Press 'C' to create a comment box around the current node selection.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'c' || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;

      const state = useBTStore.getState();
      const rfAllNodes = rfInstance.getNodes();

      const selectedIds = new Set(state.selectedNodeIds);
      rfAllNodes.forEach((n) => {
        if (n.selected) selectedIds.add(n.id);
      });

      const selectedNodes = rfAllNodes.filter((n) => {
        const nodeData = n.data as unknown as BTNodeData;
        return selectedIds.has(n.id) && nodeData.type !== BTNodeType.COMMENT;
      });

      if (selectedNodes.length === 0) {
        return;
      }

      const getSize = (node: Node): { w: number; h: number } => {
        return {
          w: node.measured?.width ?? node.width ?? 130,
          h: node.measured?.height ?? node.height ?? 60,
        };
      };

      const PAD = 30;
      const minX = Math.min(...selectedNodes.map((n) => n.position.x)) - PAD;
      const minY = Math.min(...selectedNodes.map((n) => n.position.y)) - PAD;
      const maxX = Math.max(...selectedNodes.map((n) => n.position.x + getSize(n).w)) + PAD;
      const maxY = Math.max(...selectedNodes.map((n) => n.position.y + getSize(n).h)) + PAD;

      const cw = maxX - minX;
      const ch = maxY - minY;
      if (state.activePageId === 'main') {
        state.addNode(BTNodeType.COMMENT, { x: minX, y: minY }, {
          label: 'Comment',
          commentWidth: cw,
          commentHeight: ch,
        });
      } else {
        const page = state.pages.find((p) => p.id === state.activePageId);
        if (page) {
          state.addPageNode(state.activePageId, BTNodeType.COMMENT, { x: minX, y: minY }, {
            label: 'Comment',
            commentWidth: cw,
            commentHeight: ch,
          });
        } else {
          state.addFunctionNode(state.activePageId, BTNodeType.COMMENT, { x: minX, y: minY }, {
            label: 'Comment',
            commentWidth: cw,
            commentHeight: ch,
          });
        }
      }

      e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // When switching pages, center on the root node
  useEffect(() => {
    const rfInstance = rfInstanceRef.current;
    if (!rfInstance) return;
    const rootNode = nodes.find((n) => n.data.type === BTNodeType.ROOT);
    if (rootNode) {
      setTimeout(() => {
        rfInstance.setCenter(rootNode.position.x + 80, rootNode.position.y + 30, { zoom: 1, duration: 300 });
      }, 50);
    }
  }, [activePageId]);

  // Auto-focus search input when popup opens
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (quickCreate && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [quickCreate]);

  return (
    <div className="bt-editor" ref={reactFlowRef}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={onInit}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid
        snapGrid={SNAP_GRID}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        panOnDrag={[2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={10} size={1} color="#333" />
      </ReactFlow>

      {quickCreate && (
        <>
          <div
            className="quick-create-overlay"
            onClick={dismissQuickCreate}
            onContextMenu={(e) => { e.preventDefault(); dismissQuickCreate(); }}
          />
          <div
            className="quick-create-popup"
            style={{
              left: quickCreate.screenX,
              top: quickCreate.screenY,
            }}
          >
            <div className="quick-create-search">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索节点..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    dismissQuickCreate();
                  }
                  if (e.key === 'Enter' && filteredQuickCreateTypes.length === 1) {
                    const item = filteredQuickCreateTypes[0];
                    handleQuickCreate(item.type, (item as { functionId?: string; variableId?: string }).functionId ?? (item as { variableId?: string }).variableId);
                  }
                }}
              />
            </div>
            <div className="quick-create-list">
              {filteredQuickCreateTypes.map((item) => (
                <button
                  key={item.type === BTNodeType.FUNCTION ? `func-${item.label}` : item.type}
                  className="quick-create-item"
                  onClick={() => handleQuickCreate(item.type, (item as { functionId?: string; variableId?: string }).functionId ?? (item as { variableId?: string }).variableId)}
                >
                  <span className="quick-create-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
              {filteredQuickCreateTypes.length === 0 && (
                <div className="quick-create-empty">无匹配节点</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Get/Set variable popup */}
      {varDropPopup && (
        <>
          <div className="quick-create-overlay" onClick={() => setVarDropPopup(null)} />
          <div
            className="var-drop-popup"
            style={{ left: varDropPopup.screenX, top: varDropPopup.screenY }}
          >
            <div className="var-drop-title">
              {variables.find((v) => v.id === varDropPopup.variableId)?.name ?? 'Variable'}
            </div>
            <button className="var-drop-btn" onClick={() => handleVarDrop('get')}>
              📤 Get
            </button>
            <button className="var-drop-btn" onClick={() => handleVarDrop('set')}>
              📥 Set
            </button>
            <button className="var-drop-btn var-drop-cancel" onClick={() => setVarDropPopup(null)}>
              取消
            </button>
          </div>
        </>
      )}

      {actionPreview && (
        <ActionLightbox
          actionId={actionPreview.actionId}
          actionName={actionPreview.actionName}
          gifPath={actionPreview.gifPath}
          onClose={() => setActionPreview(null)}
        />
      )}
    </div>
  );
}

function ActionLightbox({
  actionId,
  actionName,
  gifPath,
  onClose,
}: {
  actionId: string;
  actionName: string;
  gifPath: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const replayGifPath = useMemo(() => {
    const [pathAndQuery, hash = ''] = gifPath.split('#');
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    return `${pathAndQuery}${separator}replay=${Date.now()}${hash ? `#${hash}` : ''}`;
  }, [gifPath]);

  return (
    <div className="action-lightbox" onMouseDown={onClose}>
      <div className="action-lightbox-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="action-lightbox-close"
          title="关闭预览"
          onClick={onClose}
        >
          ×
        </button>
        <div className="action-lightbox-media">
          {failed ? (
            <div className="action-lightbox-empty">GIF 文件待放入项目资源目录</div>
          ) : (
            <img src={replayGifPath} alt={actionId} onError={() => setFailed(true)} />
          )}
        </div>
        <div className="action-lightbox-meta">
          <div className="action-lightbox-id">{actionId}</div>
          <div className="action-lightbox-name">{actionName}</div>
        </div>
      </div>
    </div>
  );
}
