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
import { isShowcaseMode } from '../config/appMode';
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

const SNAP_GRID: [number, number] = [5, 5];
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
  sourcePageId: string;
  bounds: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
};

type FlowPosition = { x: number; y: number };
type FlowViewport = { x: number; y: number; zoom: number };

type CommentDragGroup = {
  commentId: string;
  startPosition: FlowPosition;
  containedNodes: Array<{ id: string; startPosition: FlowPosition }>;
};

type PaneSelectionDrag = {
  startScreen: FlowPosition;
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

function getNodeClipboardBounds(nodes: BTNode[]) {
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x));
  const maxY = Math.max(...nodes.map((node) => node.position.y));
  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getNodeSize(node: Node): { width: number; height: number } {
  const data = node.data as unknown as BTNodeData;
  if (data.type === BTNodeType.COMMENT) {
    return {
      width: data.commentWidth ?? node.measured?.width ?? node.width ?? 300,
      height: data.commentHeight ?? node.measured?.height ?? node.height ?? 150,
    };
  }
  return {
    width: node.measured?.width ?? node.width ?? 130,
    height: node.measured?.height ?? node.height ?? 60,
  };
}

function isFullyInsideComment(node: Node, comment: Node): boolean {
  const nodeSize = getNodeSize(node);
  const commentSize = getNodeSize(comment);
  const nodeLeft = node.position.x;
  const nodeTop = node.position.y;
  const nodeRight = nodeLeft + nodeSize.width;
  const nodeBottom = nodeTop + nodeSize.height;
  const commentLeft = comment.position.x;
  const commentTop = comment.position.y;
  const commentRight = commentLeft + commentSize.width;
  const commentBottom = commentTop + commentSize.height;
  return (
    nodeLeft >= commentLeft &&
    nodeTop >= commentTop &&
    nodeRight <= commentRight &&
    nodeBottom <= commentBottom
  );
}

function isExecutionEdge(edge: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}) {
  return edge.sourceHandle !== 'data-out' &&
    edge.targetHandle !== 'data-in' &&
    !edge.targetHandle?.startsWith('data-in-');
}

type QuickCreateItem = {
  type: BTNodeType;
  icon: string;
  label: string;
  functionId?: string;
  variableId?: string;
  operator?: string;
};

const compareQuickCreateTypes: QuickCreateItem[] = [
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare <', operator: '<' },
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare >', operator: '>' },
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare <=', operator: '<=' },
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare >=', operator: '>=' },
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare ==', operator: '==' },
];

const staticQuickCreateTypes: QuickCreateItem[] = [
  { type: BTNodeType.SEQUENCE, icon: '→', label: 'Sequence' },
  { type: BTNodeType.PARALLEL, icon: '⇉', label: 'Parallel' },
  { type: BTNodeType.DIST_SELECTOR, icon: '📏', label: 'Dist Selector' },
  { type: BTNodeType.RANDOM_SELECTOR, icon: '🎲', label: 'Random Selector' },
  ...compareQuickCreateTypes,
  { type: BTNodeType.COMPARE, icon: '⇔', label: 'Compare' },
  { type: BTNodeType.TEST, icon: '🧪', label: 'Test' },
  { type: BTNodeType.CONDITION, icon: '◆', label: 'Condition' },
  { type: BTNodeType.REPEATER, icon: '↻', label: 'Repeater' },
  { type: BTNodeType.ACTION, icon: '⚡', label: 'Action' },
  { type: BTNodeType.APPROACH, icon: '🏃', label: 'Approach' },
  { type: BTNodeType.DISTANCE_2D, icon: '📐', label: '2D Dist Between' },
  { type: BTNodeType.ANGLE_BETWEEN_CW, icon: '↻', label: 'Angle Between CW' },
  { type: BTNodeType.ANGLE_BETWEEN_CW_LR_BOTH, icon: '↻', label: 'Angle Between CW LRBoth' },
  { type: BTNodeType.RESET, icon: '🔄', label: 'Reset' },
  { type: BTNodeType.COMBO_SHOW, icon: '🎬', label: 'Combo' },
];

export function BTEditor() {
  const isReadonly = isShowcaseMode;
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nodeClipboardRef = useRef<NodeClipboard | null>(null);
  const pasteCountRef = useRef(0);
  const viewportByPageRef = useRef(new Map<string, FlowViewport>());
  const previousPageIdRef = useRef<string | null>(null);

  // Connection drag tracking — manual approach instead of onConnectEnd
  const connectDragRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectMadeRef = useRef(false);
  const commentDragGroupRef = useRef<CommentDragGroup | null>(null);

  const [quickCreate, setQuickCreate] = useState<{
    sourceId: string;
    sourceHandleId?: string;
    screenX: number;
    screenY: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedQuickCreateIndex, setSelectedQuickCreateIndex] = useState(0);
  const [actionPreview, setActionPreview] = useState<{
    actionId: string;
    actionName: string;
    mediaPath: string;
  } | null>(null);
  const [selectedReroutePoint, setSelectedReroutePoint] = useState<{
    edgeId: string;
    pointId: string;
  } | null>(null);
  const [commentTitleEditRequest, setCommentTitleEditRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const paneSelectionDragRef = useRef<PaneSelectionDrag | null>(null);

  // Variable drop → Get/Set popup
  const [varDropPopup, setVarDropPopup] = useState<{
    variableId: string;
    flowPosition: { x: number; y: number };
    screenX: number;
    screenY: number;
  } | null>(null);

  const storeNodes = useBTStore((s) => s.nodes);
  const storeEdges = useBTStore((s) => s.edges);
  const storePages = useBTStore((s) => s.pages);
  const functions = useBTStore((s) => s.functions);
  const variables = useBTStore((s) => s.variables);
  const selectedNodeIds = useBTStore((s) => s.selectedNodeIds);
  const activePageId = useBTStore((s) => s.activePageId);
  const rootFocusRequest = useBTStore((s) => s.rootFocusRequest);
  const clearRootFocusRequest = useBTStore((s) => s.clearRootFocusRequest);
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
  const addPage = useBTStore((s) => s.addPage);
  const updateNodeDataStore = useBTStore((s) => s.updateNodeData);

  const saveCurrentViewport = useCallback((pageId: string) => {
    const rfInstance = rfInstanceRef.current;
    if (!rfInstance) return;
    viewportByPageRef.current.set(pageId, rfInstance.getViewport());
  }, []);

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

  const makeComboData = useCallback((label = 'Combo'): Partial<BTNodeData> => {
    const pageId = addPage(label);
    setActivePageId(activePageId);
    return { label, functionId: pageId, isCombo: true };
  }, [activePageId, addPage, setActivePageId]);

  const openComboPage = useCallback(
    (nodeId: string, data: BTNodeData) => {
      const label = data.label && data.label !== 'ComboShow' ? data.label : 'Combo';
      let pageId = data.functionId;
      if (!pageId || !useBTStore.getState().pages.some((page) => page.id === pageId)) {
        pageId = addPage(label);
        updateNodeDataStore(nodeId, { label, functionId: pageId });
      }
      setActivePageId(pageId);
    },
    [addPage, setActivePageId, updateNodeDataStore]
  );

  const previewActionMedia = useCallback(
    (data: BTNodeData) => {
      if (!data.actionId) return;
      const actionConfig = actionById.get(data.actionId);
      if (!actionConfig?.gifPath) return;
      setActionPreview({
        actionId: actionConfig.actionId,
        actionName: actionConfig.actionName,
        mediaPath: actionConfig.gifPath,
      });
    },
    [actionById]
  );

  const previewComboMedia = useCallback(
    (data: BTNodeData) => {
      if (data.isCombo === false) return;
      previewActionMedia(data);
    },
    [previewActionMedia]
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

  const addReroutePoint = useCallback(
    (edgeId: string, position: { x: number; y: number }) => {
      const edge = edges.find((item) => item.id === edgeId);
      if (!edge || !isExecutionEdge(edge)) return;

      const point = {
        id: generateId('reroute'),
        ...snapPosition(position),
      };
      const reroutePoints = [
        ...((edge.data?.reroutePoints as BTEdgeReroutePoint[] | undefined) ?? []),
        point,
      ];
      updateEdgeReroutePoints(edge.id, reroutePoints);
      setSelectedReroutePoint({ edgeId: edge.id, pointId: point.id });
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
        ...(n.data.type === BTNodeType.COMMENT && commentTitleEditRequest?.id === n.id
          ? {
              data: {
                ...n.data,
                commentTitleEditRequestNonce: commentTitleEditRequest.nonce,
                onCommentTitleEditStarted: () => setCommentTitleEditRequest(null),
              },
            }
          : {}),
        ...(n.data.type === BTNodeType.COMBO_SHOW
          ? {
              data: {
                ...n.data,
                onComboTitleClick: () => openComboPage(n.id, n.data),
                onComboPreviewClick: () => previewComboMedia(n.data),
              },
            }
          : {}),
        ...(n.data.type === BTNodeType.ACTION
          ? {
              data: {
                ...n.data,
                onActionPreviewClick: () => previewActionMedia(n.data),
              },
            }
          : {}),
        zIndex: n.data.type === BTNodeType.COMMENT ? -1 : undefined,
        dragHandle: n.data.type === BTNodeType.COMMENT ? '.bt-comment-title' : undefined,
      })) as Node[],
    [nodes, selectedNodeIds, commentTitleEditRequest, openComboPage, previewActionMedia, previewComboMedia]
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
          onReroutePointMove: isReadonly ? undefined : moveReroutePoint,
          onReroutePointAdd: isReadonly ? undefined : addReroutePoint,
        },
      })) as Edge[],
    [edges, selectedReroutePoint, selectReroutePoint, moveReroutePoint, addReroutePoint, isReadonly]
  );

  // ----- React Flow event handlers -----
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isReadonly) return;
      const changedNodeIds = new Set(
        changes.flatMap((change) => ('id' in change ? [change.id] : []))
      );
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateNodePosition(change.id, change.position);

          const movingNode = nodes.find((node) => node.id === change.id);
          if (
            movingNode?.data.type === BTNodeType.COMMENT &&
            (change.dragging || commentDragGroupRef.current?.commentId === change.id)
          ) {
            let dragGroup = commentDragGroupRef.current;
            if (change.dragging && (!dragGroup || dragGroup.commentId !== change.id)) {
              const rfNodes = rfInstanceRef.current?.getNodes() ?? [];
              const commentNode = rfNodes.find((node) => node.id === change.id);
              if (commentNode) {
                dragGroup = {
                  commentId: change.id,
                  startPosition: { ...movingNode.position },
                  containedNodes: rfNodes
                    .filter((node) => {
                      if (node.id === change.id || changedNodeIds.has(node.id)) return false;
                      const nodeData = node.data as unknown as BTNodeData;
                      if (nodeData.type === BTNodeType.COMMENT) return false;
                      return isFullyInsideComment(node, commentNode);
                    })
                    .map((node) => ({
                      id: node.id,
                      startPosition: { ...node.position },
                    })),
                };
                commentDragGroupRef.current = dragGroup;
              }
            }

            if (dragGroup) {
              const snappedCommentPosition = snapPosition(change.position);
              const delta = {
                x: snappedCommentPosition.x - dragGroup.startPosition.x,
                y: snappedCommentPosition.y - dragGroup.startPosition.y,
              };
              dragGroup.containedNodes.forEach((node) => {
                updateNodePosition(node.id, {
                  x: node.startPosition.x + delta.x,
                  y: node.startPosition.y + delta.y,
                });
              });
            }

            if (change.dragging === false) {
              commentDragGroupRef.current = null;
            }
          }
        }
      }
    },
    [nodes, updateNodePosition, isReadonly]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      setSelectedNodes(selNodes.map((n) => n.id));
      if (selNodes.length > 0) setSelectedReroutePoint(null);
    },
    [setSelectedNodes]
  );

  const onEditorMouseDownCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isReadonly) return;
    if (event.button !== 0 || isEditableTarget(event.target)) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || target.closest('.react-flow__node, .react-flow__edge, .react-flow__handle, .bt-edge-reroute-point')) {
      return;
    }
    paneSelectionDragRef.current = {
      startScreen: { x: event.clientX, y: event.clientY },
    };
  }, [isReadonly]);

  const onEditorMouseUpCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isReadonly) return;
    const selectionDrag = paneSelectionDragRef.current;
    paneSelectionDragRef.current = null;
    if (!selectionDrag) return;

    const dx = event.clientX - selectionDrag.startScreen.x;
    const dy = event.clientY - selectionDrag.startScreen.y;
    if (Math.hypot(dx, dy) < 8) return;

    const rfInstance = rfInstanceRef.current;
    if (!rfInstance) return;

    const start = rfInstance.screenToFlowPosition(selectionDrag.startScreen);
    const end = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const bounds = {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
      top: Math.min(start.y, end.y),
      bottom: Math.max(start.y, end.y),
    };

    const matchedPoint = edges
      .flatMap((edge) =>
        (edge.data?.reroutePoints ?? []).map((point) => ({
          edgeId: edge.id,
          pointId: point.id,
          x: point.x,
          y: point.y,
        }))
      )
      .find((point) =>
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom
      );

    if (!matchedPoint) return;
    window.setTimeout(() => {
      setSelectedReroutePoint({
        edgeId: matchedPoint.edgeId,
        pointId: matchedPoint.pointId,
      });
    }, 0);
  }, [edges, isReadonly]);

  const onEdgesChange = useCallback(() => {}, []);

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (isReadonly) return;
      if (!params.nodeId) return;
      connectDragRef.current = { nodeId: params.nodeId, handleId: params.handleId };
      connectMadeRef.current = false;
    },
    [isReadonly]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isReadonly) return;
      if (!connection.source || !connection.target) return;
      connectMadeRef.current = true;
      addEdgeStore(
        connection.source,
        connection.target,
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );
    },
    [addEdgeStore, isReadonly]
  );

  // Detect end of connection drag via window mouseup
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (isReadonly) return;
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

        setSearchFilter('');
        setSelectedQuickCreateIndex(0);
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
  }, [isReadonly]);

  const handleQuickCreate = useCallback(
    (item: QuickCreateItem) => {
      if (!quickCreate) return;
      if (isReadonly) return;

      const data: Partial<BTNodeData> = {};
      if (item.type === BTNodeType.FUNCTION && item.functionId) {
        data.functionId = item.functionId;
      }
      if ((item.type === BTNodeType.GET_VARIABLE || item.type === BTNodeType.SET_VARIABLE) && item.variableId) {
        data.variableId = item.variableId;
      }
      if (item.type === BTNodeType.COMPARE && item.operator) {
        data.operator = item.operator;
        data.label = item.operator;
      }
      if (item.type === BTNodeType.COMBO_SHOW) {
        Object.assign(data, makeComboData('Combo'));
      }

      const newId = addNode(item.type, quickCreate.flowPosition, data);
      if (quickCreate.sourceId) {
        addEdgeStore(quickCreate.sourceId, newId, quickCreate.sourceHandleId, undefined);
      }
      setQuickCreate(null);
    },
    [quickCreate, addNode, addEdgeStore, makeComboData, isReadonly]
  );

  const dismissQuickCreate = useCallback(() => {
    setQuickCreate(null);
  }, []);

  const handleVarDrop = useCallback((mode: 'get' | 'set') => {
    if (!varDropPopup) return;
    if (isReadonly) return;
    const nodeType = mode === 'get' ? BTNodeType.GET_VARIABLE : BTNodeType.SET_VARIABLE;
    addNode(nodeType, varDropPopup.flowPosition, {
      variableId: varDropPopup.variableId,
    });
    setVarDropPopup(null);
  }, [varDropPopup, addNode, isReadonly]);

  // Dynamic quick-create list including user functions.
  const allQuickCreateTypes = useMemo<QuickCreateItem[]>(() => {
    const funcTypes = functions.map((f) => ({
      type: BTNodeType.FUNCTION,
      icon: '📦',
      label: f.name,
      functionId: f.id,
    }));
    return [...staticQuickCreateTypes, ...funcTypes];
  }, [functions]);

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

  useEffect(() => {
    setSelectedQuickCreateIndex(0);
  }, [quickCreate, searchFilter]);

  useEffect(() => {
    if (filteredQuickCreateTypes.length === 0) {
      setSelectedQuickCreateIndex(0);
      return;
    }
    setSelectedQuickCreateIndex((index) => Math.min(index, filteredQuickCreateTypes.length - 1));
  }, [filteredQuickCreateTypes.length]);

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
    if (isReadonly) return;
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
  }, [edges, selectedReroutePoint, updateEdgeReroutePoints, isReadonly]);

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
    },
    [setActivePageId]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (isReadonly) return;
      deletedNodes.forEach((n) => {
        const nd = n.data as unknown as BTNodeData;
        if (nd.type !== BTNodeType.ROOT) removeNode(n.id);
      });
    },
    [removeNode, isReadonly]
  );

  useEffect(() => {
    if (isReadonly) return;
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
          sourcePageId: activePageId,
          bounds: getNodeClipboardBounds(copiedNodes),
        };
        pasteCountRef.current = 0;
        e.preventDefault();
        return;
      }

      const clipboard = nodeClipboardRef.current;
      if (!clipboard || clipboard.nodes.length === 0) return;

      pasteCountRef.current += 1;
      const offset = PASTE_OFFSET * pasteCountRef.current;
      const isCrossPagePaste = clipboard.sourcePageId !== activePageId;
      const viewportCenter = (() => {
        const rect = reactFlowRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return rfInstance.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      })();
      const crossPageDelta = isCrossPagePaste && viewportCenter
        ? {
            x: viewportCenter.x - (clipboard.bounds.minX + clipboard.bounds.width / 2),
            y: viewportCenter.y - (clipboard.bounds.minY + clipboard.bounds.height / 2),
          }
        : null;
      const idMap = new Map<string, string>();
      const newSelectedIds: string[] = [];

      clipboard.nodes.forEach((node) => {
        if (node.data.type === BTNodeType.ROOT) return;

        const newId = addNode(node.data.type, snapPosition({
          x: node.position.x + (crossPageDelta?.x ?? offset),
          y: node.position.y + (crossPageDelta?.y ?? offset),
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
  }, [activePageId, addEdgeStore, addNode, edges, nodes, selectedNodeIds, setSelectedNodes, isReadonly]);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedReroutePoint(null);
      if (isReadonly) return;
      if (_event.metaKey || _event.altKey) {
        removeEdge(edge.id);
      }
    },
    [removeEdge, isReadonly]
  );

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (isReadonly) return;
      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;
      event.preventDefault();
      event.stopPropagation();

      addReroutePoint(
        edge.id,
        rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      );
    },
    [addReroutePoint, isReadonly]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (isReadonly) return;
      if (selectedReroutePoint && deletedEdges.some((e) => e.id === selectedReroutePoint.edgeId)) {
        setSelectedReroutePoint(null);
      }
      deletedEdges.forEach((e) => removeEdge(e.id));
    },
    [removeEdge, selectedReroutePoint, isReadonly]
  );

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      e.preventDefault();
      if (isReadonly) return;
      const rfInstance = rfInstanceRef.current;
      if (!rfInstance) return;
      const flowPosition = snapPosition(rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      setSearchFilter('');
      setSelectedQuickCreateIndex(0);
      setQuickCreate({
        sourceId: '',
        sourceHandleId: undefined,
        screenX: e.clientX,
        screenY: e.clientY,
        flowPosition,
      });
    },
    [isReadonly]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodes([]);
    setSelectedReroutePoint(null);
    setQuickCreate(null);
    setVarDropPopup(null);
  }, [setSelectedNodes]);

  const onDragOver = useCallback((event: DragEvent) => {
    if (isReadonly) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [isReadonly]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (isReadonly) return;

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
      if (nodeType === BTNodeType.COMBO_SHOW) {
        const functionId = event.dataTransfer.getData('application/function-id');
        const functionLabel = event.dataTransfer.getData('application/function-label');
        const actionId = event.dataTransfer.getData('application/action-id');
        const isCombo = event.dataTransfer.getData('application/is-combo');
        if (functionId) {
          data.functionId = functionId;
          data.label = functionLabel || 'Combo';
          data.isCombo = isCombo ? isCombo === 'true' : Boolean(actionId);
          if (actionId) {
            data.actionId = actionId;
          }
        } else {
          Object.assign(data, makeComboData('Combo'));
        }
      }

      addNode(nodeType, position, data);
    },
    [addNode, makeComboData, isReadonly]
  );

  const isValidConnection = useCallback((conn: Connection | Edge) => {
    const sourceHandle = conn.sourceHandle ?? null;
    const targetHandle = conn.targetHandle ?? null;
    const sourceIsData = sourceHandle === 'data-out';
    const targetIsData = targetHandle === 'data-in' || targetHandle?.startsWith('data-in-') === true;
    if (sourceIsData || targetIsData) {
      return sourceIsData && targetIsData;
    }
    return true;
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.2 }), 100);
  }, []);

  const onMoveEnd = useCallback(() => {
    saveCurrentViewport(activePageId);
  }, [activePageId, saveCurrentViewport]);

  // Press 'C' to create a comment box around the current node selection.
  useEffect(() => {
    if (isReadonly) return;
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
      let newCommentId: string | undefined;
      if (state.activePageId === 'main') {
        newCommentId = state.addNode(BTNodeType.COMMENT, { x: minX, y: minY }, {
          label: 'Comment',
          commentWidth: cw,
          commentHeight: ch,
        });
      } else {
        const page = state.pages.find((p) => p.id === state.activePageId);
        if (page) {
          newCommentId = state.addPageNode(state.activePageId, BTNodeType.COMMENT, { x: minX, y: minY }, {
            label: 'Comment',
            commentWidth: cw,
            commentHeight: ch,
          });
        } else {
          newCommentId = state.addFunctionNode(state.activePageId, BTNodeType.COMMENT, { x: minX, y: minY }, {
            label: 'Comment',
            commentWidth: cw,
            commentHeight: ch,
          });
        }
      }
      if (newCommentId) {
        state.setSelectedNodes([newCommentId]);
        window.setTimeout(() => {
          setCommentTitleEditRequest({
            id: newCommentId,
            nonce: Date.now(),
          });
        }, 0);
      }

      e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isReadonly]);

  // Restore each page/function to the viewport where the user last left it.
  useEffect(() => {
    const rfInstance = rfInstanceRef.current;
    if (!rfInstance) return;
    const previousPageId = previousPageIdRef.current;
    if (previousPageId && previousPageId !== activePageId) {
      viewportByPageRef.current.set(previousPageId, rfInstance.getViewport());
    }

    const savedViewport = viewportByPageRef.current.get(activePageId);
    if (savedViewport) {
      requestAnimationFrame(() => {
        rfInstance.setViewport(savedViewport, { duration: 0 });
      });
    }
    previousPageIdRef.current = activePageId;
  }, [activePageId]);

  useEffect(() => {
    if (!rootFocusRequest || rootFocusRequest.pageId !== activePageId) return;
    const rfInstance = rfInstanceRef.current;
    const rootNode = nodes.find((node) => node.data.type === BTNodeType.ROOT);
    if (!rfInstance || !rootNode) return;

    requestAnimationFrame(() => {
      rfInstance.setCenter(rootNode.position.x + 80, rootNode.position.y + 30, {
        zoom: 1,
        duration: 250,
      });
      clearRootFocusRequest();
    });
  }, [activePageId, clearRootFocusRequest, nodes, rootFocusRequest]);

  // Auto-focus search input when popup opens
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (quickCreate && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [quickCreate]);

  useEffect(() => {
    if (!quickCreate) return;
    const selectedItem = quickCreateListRef.current?.querySelector<HTMLElement>('.quick-create-item.selected');
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }, [quickCreate, selectedQuickCreateIndex, filteredQuickCreateTypes.length]);

  return (
    <div
      className="bt-editor"
      ref={reactFlowRef}
      onMouseDownCapture={onEditorMouseDownCapture}
      onMouseUpCapture={onEditorMouseUpCapture}
    >
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
        onMoveEnd={onMoveEnd}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid
        snapGrid={SNAP_GRID}
        fitView
        minZoom={0.05}
        maxZoom={2}
        zoomOnDoubleClick={false}
        deleteKeyCode={isReadonly ? [] : ['Backspace', 'Delete']}
        nodesDraggable={!isReadonly}
        nodesConnectable={!isReadonly}
        edgesReconnectable={!isReadonly}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={5} size={1} color="#333" />
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
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedQuickCreateIndex((index) =>
                      filteredQuickCreateTypes.length === 0
                        ? 0
                        : (index + 1) % filteredQuickCreateTypes.length
                    );
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedQuickCreateIndex((index) =>
                      filteredQuickCreateTypes.length === 0
                        ? 0
                        : (index - 1 + filteredQuickCreateTypes.length) % filteredQuickCreateTypes.length
                    );
                    return;
                  }
                  if (e.key === 'Enter' && filteredQuickCreateTypes.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const item = filteredQuickCreateTypes[selectedQuickCreateIndex] ?? filteredQuickCreateTypes[0];
                    handleQuickCreate(item);
                  }
                }}
              />
            </div>
            <div className="quick-create-list" ref={quickCreateListRef}>
              {filteredQuickCreateTypes.map((item, index) => (
                <button
                  key={`${item.type}-${item.label}-${item.functionId ?? item.variableId ?? item.operator ?? ''}`}
                  className={`quick-create-item${index === selectedQuickCreateIndex ? ' selected' : ''}`}
                  onMouseEnter={() => setSelectedQuickCreateIndex(index)}
                  onClick={() => handleQuickCreate(item)}
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
          mediaPath={actionPreview.mediaPath}
          onClose={() => setActionPreview(null)}
        />
      )}
    </div>
  );
}

function ActionLightbox({
  actionId,
  actionName,
  mediaPath,
  onClose,
}: {
  actionId: string;
  actionName: string;
  mediaPath: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [replayNonce] = useState(() => Date.now());
  const replayMediaPath = useMemo(() => {
    const [pathAndQuery, hash = ''] = mediaPath.split('#');
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    return `${pathAndQuery}${separator}replay=${replayNonce}${hash ? `#${hash}` : ''}`;
  }, [mediaPath, replayNonce]);

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
            <div className="action-lightbox-empty">MP4 文件待放入项目资源目录</div>
          ) : (
            <video
              src={replayMediaPath}
              aria-label={actionId}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setFailed(true)}
            />
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
