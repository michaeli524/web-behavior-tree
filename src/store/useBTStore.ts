import { create } from 'zustand';
import {
  type BTNode,
  type BTEdge,
  type BTVariable,
  type BTFunction,
  type BTPage,
  type BTNodeData,
  type BTEdgeReroutePoint,
  BTNodeType,
  BTExecutionStatus,
} from '../engine/types';
import { generateId } from '../utils/idGenerator';

interface BTStore {
  nodes: BTNode[];
  edges: BTEdge[];
  variables: BTVariable[];
  functions: BTFunction[];
  pages: BTPage[];
  mainPageName: string;
  selectedNodeIds: string[];
  selectedVariableId: string | null;
  setSelectedVariableId: (id: string | null) => void;
  rootFocusRequest: { pageId: string; nonce: number } | null;
  isRunning: boolean;
  executionResults: Map<string, BTExecutionStatus>;
  activePageId: string; // 'main' or functionId

  setActivePageId: (pageId: string) => void;
  requestRootFocus: (pageId: string) => void;
  clearRootFocusRequest: () => void;

  // Node operations (main tree)
  addNode: (type: BTNodeType, position: { x: number; y: number }, data?: Partial<BTNodeData>) => string;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<BTNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setSelectedNodes: (ids: string[]) => void;

  // Edge operations (main tree)
  addEdge: (source: string, target: string, sourceHandle?: string, targetHandle?: string) => void;
  removeEdge: (id: string) => void;
  updateEdgeReroutePoints: (id: string, reroutePoints: BTEdgeReroutePoint[]) => void;

  // Function tree operations
  addFunctionNode: (funcId: string, type: BTNodeType, position: { x: number; y: number }, data?: Partial<BTNodeData>) => string;
  removeFunctionNode: (funcId: string, nodeId: string) => void;
  updateFunctionNodeData: (funcId: string, nodeId: string, data: Partial<BTNodeData>) => void;
  updateFunctionNodePosition: (funcId: string, nodeId: string, position: { x: number; y: number }) => void;
  addFunctionEdge: (funcId: string, source: string, target: string, sourceHandle?: string, targetHandle?: string) => void;
  removeFunctionEdge: (funcId: string, edgeId: string) => void;
  updateFunctionEdgeReroutePoints: (funcId: string, edgeId: string, reroutePoints: BTEdgeReroutePoint[]) => void;

  // Variable operations
  addVariable: (name: string, type: BTVariable['type'], value: BTVariable['value']) => void;
  updateVariable: (id: string, updates: Partial<BTVariable>) => void;
  removeVariable: (id: string) => void;

  // Page operations
  addPage: (name?: string) => string;
  renamePage: (pageId: string, name: string) => void;
  deletePage: (pageId: string) => void;
  addPageNode: (pageId: string, type: BTNodeType, position: { x: number; y: number }, data?: Partial<BTNodeData>) => string;
  removePageNode: (pageId: string, nodeId: string) => void;
  addPageEdge: (pageId: string, source: string, target: string, sourceHandle?: string, targetHandle?: string) => void;
  removePageEdge: (pageId: string, edgeId: string) => void;
  updatePageEdgeReroutePoints: (pageId: string, edgeId: string, reroutePoints: BTEdgeReroutePoint[]) => void;
  updatePageNodePosition: (pageId: string, nodeId: string, position: { x: number; y: number }) => void;

  // Function operations
  addFunction: (name: string, body?: string) => string;
  updateFunction: (id: string, updates: Partial<BTFunction>) => void;
  removeFunction: (id: string) => void;

  // Execution
  setRunning: (running: boolean) => void;
  setExecutionResult: (nodeId: string, status: BTExecutionStatus) => void;
  resetExecution: () => void;

  // Undo
  _snapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Load/Save
  exportTree: () => string;
  importTree: (json: string) => void;
  clearAll: () => void;
}

type HistorySnapshot = {
  nodes: BTNode[];
  edges: BTEdge[];
  variables: BTVariable[];
  functions: BTFunction[];
  pages: BTPage[];
  mainPageName: string;
};

const MAX_HISTORY = 50;
let _history: HistorySnapshot[] = [];
let _historyIndex = -1;
let _skipSnapshot = false;

function pushHistory(state: BTStore) {
  if (_skipSnapshot) return;
  if (_historyIndex < _history.length - 1) {
    _history = _history.slice(0, _historyIndex + 1);
  }
  _history.push({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
    variables: JSON.parse(JSON.stringify(state.variables)),
    functions: JSON.parse(JSON.stringify(state.functions)),
    pages: JSON.parse(JSON.stringify(state.pages)),
    mainPageName: state.mainPageName,
  });
  if (_history.length > MAX_HISTORY) _history.shift();
  _historyIndex = _history.length - 1;
}

const defaultLabels: Record<BTNodeType, string> = {
  [BTNodeType.ROOT]: 'Root',
  [BTNodeType.SELECTOR]: 'Selector',
  [BTNodeType.SEQUENCE]: 'Sequence',
  [BTNodeType.PARALLEL]: 'Parallel',
  [BTNodeType.CONDITION]: 'Condition',
  [BTNodeType.ACTION]: 'Action',
  [BTNodeType.WAIT]: 'Wait',
  [BTNodeType.INVERTER]: 'Inverter',
  [BTNodeType.REPEATER]: 'Repeater',
  [BTNodeType.SUCCEEDER]: 'Succeeder',
  [BTNodeType.FUNCTION]: 'Function',
  [BTNodeType.DIST_SELECTOR]: 'Dist Selector',
  [BTNodeType.RANDOM_SELECTOR]: 'Random Selector',
  [BTNodeType.GET_VARIABLE]: 'Get',
  [BTNodeType.SET_VARIABLE]: 'Set',
  [BTNodeType.COMMENT]: 'Comment',
  [BTNodeType.COMPARE]: '<',
  [BTNodeType.TEST]: 'Test',
  [BTNodeType.APPROACH]: 'Approach',
  [BTNodeType.DISTANCE_2D]: '2D Dist Between',
  [BTNodeType.ANGLE_BETWEEN_CW]: 'Angle Between CW',
  [BTNodeType.ANGLE_BETWEEN_CW_LR_BOTH]: 'Angle Between CW LRBoth',
  [BTNodeType.RESET]: 'Reset',
  [BTNodeType.COMBO_SHOW]: 'Combo',
};

function makeNodeData(type: BTNodeType, dataOverride?: Partial<BTNodeData>): BTNodeData {
  return {
    label: dataOverride?.label ?? defaultLabels[type],
    type,
    condition: dataOverride?.condition ?? '',
    action: dataOverride?.action ?? '',
    actionId: dataOverride?.actionId,
    isCombo: dataOverride?.isCombo,
    duration: dataOverride?.duration ?? 1000,
    repeatCount: dataOverride?.repeatCount ?? 1,
    status: BTExecutionStatus.IDLE,
    functionId: dataOverride?.functionId,
    distances: dataOverride?.distances ?? [300, 650, 2000],
    randomWeights: dataOverride?.randomWeights ?? [50, 30, 20],
    variableId: dataOverride?.variableId,
    setValue: dataOverride?.setValue,
    commentWidth: dataOverride?.commentWidth,
    commentHeight: dataOverride?.commentHeight,
    operator: dataOverride?.operator ?? '<',
    compareLeftValue: dataOverride?.compareLeftValue ?? '0',
    compareValue: dataOverride?.compareValue ?? '0',
    approachDistance: dataOverride?.approachDistance ?? 500,
    startValue: dataOverride?.startValue ?? '0',
    endValue: dataOverride?.endValue ?? '0',
  };
}

function createNode(type: BTNodeType, position: { x: number; y: number }, dataOverride?: Partial<BTNodeData>): BTNode {
  const id = generateId(type);
  return {
    id,
    type: 'bt-node',
    position,
    data: makeNodeData(type, dataOverride),
  };
}

function createEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): BTEdge {
  return {
    id: generateId('edge'),
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

function sanitizeNodeDataUpdate(node: BTNode | undefined, data: Partial<BTNodeData>): Partial<BTNodeData> {
  if (node?.data.type === BTNodeType.COMMENT || node?.data.type === BTNodeType.COMBO_SHOW) return data;
  const sanitized = { ...data };
  delete sanitized.label;
  return sanitized;
}

function renameRootNode(nodes: BTNode[], name: string): BTNode[] {
  return nodes.map((node) =>
    node.data.type === BTNodeType.ROOT
      ? { ...node, data: { ...node.data, label: name } }
      : node
  );
}

function renameComboNodesForPage(nodes: BTNode[], pageId: string, name: string): BTNode[] {
  return nodes.map((node) =>
    node.data.type === BTNodeType.COMBO_SHOW && node.data.functionId === pageId
      ? { ...node, data: { ...node.data, label: name } }
      : node
  );
}

function syncComboLabelsFromPages(nodes: BTNode[], pages: BTPage[]): BTNode[] {
  const pageNameById = new Map(pages.map((page) => [page.id, page.name]));
  return nodes.map((node) => {
    const pageName = node.data.functionId ? pageNameById.get(node.data.functionId) : undefined;
    return node.data.type === BTNodeType.COMBO_SHOW && pageName
      ? { ...node, data: { ...node.data, label: pageName } }
      : node;
  });
}

function getLegacyMainPageName(nodes: BTNode[]): string {
  const rootLabel = nodes.find((node) => node.data.type === BTNodeType.ROOT)?.data.label?.trim();
  return rootLabel && rootLabel !== defaultLabels[BTNodeType.ROOT] ? rootLabel : 'Main';
}

export const useBTStore = create<BTStore>((set, get) => ({
  nodes: [],
  edges: [],
  variables: [],
  functions: [],
  pages: [],
  mainPageName: 'Main',
  selectedNodeIds: [],
  selectedVariableId: null,
  rootFocusRequest: null,
  isRunning: false,
  executionResults: new Map(),
  activePageId: 'main',

  setActivePageId: (pageId) => set({ activePageId: pageId, selectedNodeIds: [] }),
  requestRootFocus: (pageId) => set({ rootFocusRequest: { pageId, nonce: Date.now() } }),
  clearRootFocusRequest: () => set({ rootFocusRequest: null }),

  // ----- Main tree nodes -----
  addNode: (type, position, dataOverride) => {
    get()._snapshot();
    const node = createNode(type, position, dataOverride);
    set((state) => ({ nodes: [...state.nodes, node] }));
    return node.id;
  },

  removeNode: (id) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === id);
    if (node?.data.type === BTNodeType.ROOT) return;
    get()._snapshot();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== id),
    }));
  },

  updateNodeData: (id, data) => {
    set((state) => {
      const currentNode = [
        ...state.nodes,
        ...state.pages.flatMap((p) => p.nodes),
        ...state.functions.flatMap((f) => f.nodes),
      ].find((n) => n.id === id);
      const comboPageId = currentNode?.data.type === BTNodeType.COMBO_SHOW
        ? data.functionId ?? currentNode.data.functionId
        : undefined;
      const comboLabel = typeof data.label === 'string' ? data.label.trim() : '';

      const updatedNodes = state.nodes.map((n) => {
        if (n.id !== id) return n;
        const nextData = { ...n.data, ...sanitizeNodeDataUpdate(n, data) };
        return { ...n, data: nextData };
      });
      const updatedPages = state.pages.map((p) => {
        const updatedPage = {
          ...p,
          nodes: p.nodes.map((n) => {
            if (n.id !== id) return n;
            const nextData = { ...n.data, ...sanitizeNodeDataUpdate(n, data) };
            return { ...n, data: nextData };
          }),
        };
        if (comboPageId && p.id === comboPageId && comboLabel) {
          return {
            ...updatedPage,
            name: comboLabel,
            nodes: renameComboNodesForPage(renameRootNode(updatedPage.nodes, comboLabel), comboPageId, comboLabel),
          };
        }
        return comboPageId && comboLabel
          ? { ...updatedPage, nodes: renameComboNodesForPage(updatedPage.nodes, comboPageId, comboLabel) }
          : updatedPage;
      });
      const updatedFunctions = state.functions.map((f) => ({
        ...f,
        nodes: f.nodes.map((n) => {
          if (n.id !== id) return n;
          const nextData = { ...n.data, ...sanitizeNodeDataUpdate(n, data) };
          return { ...n, data: nextData };
        }),
      }));

      return {
        nodes: comboPageId && comboLabel
          ? renameComboNodesForPage(updatedNodes, comboPageId, comboLabel)
          : updatedNodes,
        pages: updatedPages,
        functions: comboPageId && comboLabel
          ? updatedFunctions.map((f) => ({
              ...f,
              nodes: renameComboNodesForPage(f.nodes, comboPageId, comboLabel),
            }))
          : updatedFunctions,
      };
    });
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, position } : n
      ),
    }));
  },

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
  setSelectedVariableId: (id) => set({ selectedVariableId: id }),

  // ----- Undo / Redo -----
  _snapshot: () => { pushHistory(get()); },
  undo: () => {
    if (_historyIndex <= 0) return;
    _historyIndex--;
    const snap = _history[_historyIndex];
    _skipSnapshot = true;
    set({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      variables: JSON.parse(JSON.stringify(snap.variables)),
      functions: JSON.parse(JSON.stringify(snap.functions)),
      pages: JSON.parse(JSON.stringify(snap.pages)),
      mainPageName: snap.mainPageName,
      selectedNodeIds: [],
    });
    setTimeout(() => { _skipSnapshot = false; }, 0);
  },
  redo: () => {
    if (_historyIndex >= _history.length - 1) return;
    _historyIndex++;
    const snap = _history[_historyIndex];
    _skipSnapshot = true;
    set({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      variables: JSON.parse(JSON.stringify(snap.variables)),
      functions: JSON.parse(JSON.stringify(snap.functions)),
      pages: JSON.parse(JSON.stringify(snap.pages)),
      mainPageName: snap.mainPageName,
      selectedNodeIds: [],
    });
    setTimeout(() => { _skipSnapshot = false; }, 0);
  },
  canUndo: () => _historyIndex > 0,
  canRedo: () => _historyIndex < _history.length - 1,

  // ----- Main tree edges -----
  addEdge: (source, target, sourceHandle, targetHandle) => {
    get()._snapshot();
    const state = get();
    const exists = state.edges.some(
      (e) => e.source === source && e.target === target
    );
    if (exists || source === target) return;

    const edge = createEdge(source, target, sourceHandle, targetHandle);
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  removeEdge: (id) => {
    get()._snapshot();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
  },

  updateEdgeReroutePoints: (id, reroutePoints) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, reroutePoints } } : e
      ),
    }));
  },

  // ----- Function tree nodes -----
  addFunctionNode: (funcId, type, position, dataOverride) => {
    const node = createNode(type, position, dataOverride);
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId ? { ...f, nodes: [...f.nodes, node] } : f
      ),
    }));
    return node.id;
  },

  removeFunctionNode: (funcId, nodeId) => {
    const state = get();
    const func = state.functions.find((f) => f.id === funcId);
    const node = func?.nodes.find((n) => n.id === nodeId);
    if (node?.data.type === BTNodeType.ROOT) return;
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId
          ? {
              ...f,
              nodes: f.nodes.filter((n) => n.id !== nodeId),
              edges: f.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            }
          : f
      ),
      selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== nodeId),
    }));
  },

  updateFunctionNodeData: (funcId, nodeId, data) => {
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId
          ? {
              ...f,
              nodes: f.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...sanitizeNodeDataUpdate(n, data) } } : n
              ),
            }
          : f
      ),
    }));
  },

  updateFunctionNodePosition: (funcId, nodeId, position) => {
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId
          ? {
              ...f,
              nodes: f.nodes.map((n) =>
                n.id === nodeId ? { ...n, position } : n
              ),
            }
          : f
      ),
    }));
  },

  addFunctionEdge: (funcId, source, target, sourceHandle, targetHandle) => {
    const state = get();
    const func = state.functions.find((f) => f.id === funcId);
    if (!func) return;
    const exists = func.edges.some(
      (e) => e.source === source && e.target === target
    );
    if (exists || source === target) return;

    const edge = createEdge(source, target, sourceHandle, targetHandle);
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId ? { ...f, edges: [...f.edges, edge] } : f
      ),
    }));
  },

  removeFunctionEdge: (funcId, edgeId) => {
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId
          ? { ...f, edges: f.edges.filter((e) => e.id !== edgeId) }
          : f
      ),
    }));
  },

  updateFunctionEdgeReroutePoints: (funcId, edgeId, reroutePoints) => {
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === funcId
          ? {
              ...f,
              edges: f.edges.map((e) =>
                e.id === edgeId ? { ...e, data: { ...e.data, reroutePoints } } : e
              ),
            }
          : f
      ),
    }));
  },

  // ----- Page operations -----
  addPage: (name = 'New Page') => {
    const id = generateId('page');
    const rootNode = createNode(BTNodeType.ROOT, { x: 100, y: 200 }, { label: name });
    const page: BTPage = { id, name, nodes: [rootNode], edges: [] };
    set((state) => ({ pages: [...state.pages, page], activePageId: id }));
    return id;
  },

  renamePage: (pageId, name) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    get()._snapshot();
    if (pageId === 'main') {
      set((state) => ({
        mainPageName: normalizedName,
        nodes: renameRootNode(state.nodes, normalizedName),
      }));
      return;
    }
    set((state) => ({
      nodes: renameComboNodesForPage(state.nodes, pageId, normalizedName),
      pages: state.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          name: normalizedName,
          nodes: renameComboNodesForPage(renameRootNode(p.nodes, normalizedName), pageId, normalizedName),
        };
      }),
      functions: state.functions.map((f) => ({
        ...f,
        nodes: renameComboNodesForPage(f.nodes, pageId, normalizedName),
      })),
    }));
  },

  deletePage: (pageId) => {
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== pageId),
      activePageId: state.activePageId === pageId ? 'main' : state.activePageId,
    }));
  },

  addPageNode: (pageId, type, position, dataOverride) => {
    const node = createNode(type, position, dataOverride);
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, nodes: [...p.nodes, node] } : p
      ),
    }));
    return node.id;
  },

  removePageNode: (pageId, nodeId) => {
    const state = get();
    const page = state.pages.find((p) => p.id === pageId);
    const node = page?.nodes.find((n) => n.id === nodeId);
    if (node?.data.type === BTNodeType.ROOT) return;
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, nodes: p.nodes.filter((n) => n.id !== nodeId), edges: p.edges.filter((e) => e.source !== nodeId && e.target !== nodeId) }
          : p
      ),
      selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== nodeId),
    }));
  },

  addPageEdge: (pageId, source, target, sourceHandle, targetHandle) => {
    const edge = createEdge(source, target, sourceHandle, targetHandle);
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, edges: [...p.edges, edge] } : p
      ),
    }));
  },

  removePageEdge: (pageId, edgeId) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, edges: p.edges.filter((e) => e.id !== edgeId) } : p
      ),
    }));
  },

  updatePageEdgeReroutePoints: (pageId, edgeId, reroutePoints) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              edges: p.edges.map((e) =>
                e.id === edgeId ? { ...e, data: { ...e.data, reroutePoints } } : e
              ),
            }
          : p
      ),
    }));
  },

  updatePageNodePosition: (pageId, nodeId, position) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)) }
          : p
      ),
    }));
  },

  // ----- Variables -----
  addVariable: (name, type, value) => {
    const variable: BTVariable = {
      id: generateId('var'),
      name,
      type,
      value,
    };
    set((state) => ({ variables: [...state.variables, variable] }));
  },

  updateVariable: (id, updates) => {
    set((state) => ({
      variables: state.variables.map((v) =>
        v.id === id ? { ...v, ...updates } : v
      ),
    }));
  },

  removeVariable: (id) => {
    set((state) => ({
      variables: state.variables.filter((v) => v.id !== id),
    }));
  },

  // ----- Functions -----
  addFunction: (name, body = '') => {
    const id = generateId('func');
    const rootNode = createNode(BTNodeType.ROOT, { x: 100, y: 200 }, { label: name });
    const func: BTFunction = {
      id,
      name,
      body,
      parameters: [],
      nodes: [rootNode],
      edges: [],
    };
    set((state) => ({ functions: [...state.functions, func] }));
    return id;
  },

  updateFunction: (id, updates) => {
    set((state) => ({
      functions: state.functions.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, ...updates };
        // Also rename the root node label
        if (updates.name && updated.nodes.length > 0) {
          updated.nodes = renameRootNode(updated.nodes, updates.name);
        }
        return updated;
      }),
    }));
  },

  removeFunction: (id) => {
    set((state) => ({
      functions: state.functions.filter((f) => f.id !== id),
      activePageId: state.activePageId === id ? 'main' : state.activePageId,
    }));
  },

  // ----- Execution -----
  setRunning: (running) => set({ isRunning: running }),

  setExecutionResult: (nodeId, status) => {
    set((state) => {
      const newResults = new Map(state.executionResults);
      newResults.set(nodeId, status);
      const nodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
      );
      return { executionResults: newResults, nodes };
    });
  },

  resetExecution: () =>
    set((state) => ({
      executionResults: new Map(),
      nodes: state.nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: BTExecutionStatus.IDLE },
      })),
    })),

  // ----- Load/Save -----
  exportTree: () => {
    const state = get();
    return JSON.stringify(
      {
        nodes: state.nodes,
        edges: state.edges,
        variables: state.variables,
        functions: state.functions,
        mainPageName: state.mainPageName,
        pages: state.pages,
      },
      null,
      2
    );
  },

  importTree: (json) => {
    try {
      const data = JSON.parse(json);
      const importedNodes: BTNode[] = data.nodes ?? [];
      const mainPageName = typeof data.mainPageName === 'string' && data.mainPageName.trim()
        ? data.mainPageName.trim()
        : getLegacyMainPageName(importedNodes);
      const importedPages: BTPage[] = (data.pages ?? []).map((page: BTPage) => ({
        ...page,
        nodes: renameRootNode(page.nodes ?? [], page.name),
        edges: page.edges ?? [],
      }));
      const importedFunctions: BTFunction[] = (data.functions ?? []).map((f: BTFunction) => ({
        ...f,
        nodes: syncComboLabelsFromPages(f.nodes ?? [], importedPages),
        edges: f.edges ?? [],
      }));
      set({
        nodes: syncComboLabelsFromPages(renameRootNode(importedNodes, mainPageName), importedPages),
        edges: data.edges ?? [],
        variables: data.variables ?? [],
        functions: importedFunctions,
        pages: importedPages.map((page) => ({
          ...page,
          nodes: syncComboLabelsFromPages(page.nodes, importedPages),
        })),
        mainPageName,
        selectedNodeIds: [],
        executionResults: new Map(),
        activePageId: 'main',
      });
    } catch (e) {
      console.error('Failed to import tree:', e);
    }
  },

  clearAll: () =>
    set({
      nodes: [],
      edges: [],
      variables: [],
      functions: [],
      pages: [],
      mainPageName: 'Main',
      selectedNodeIds: [],
      executionResults: new Map(),
      activePageId: 'main',
    }),
}));
