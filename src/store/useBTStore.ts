import { create } from 'zustand';
import {
  type BTNode,
  type BTEdge,
  type BTVariable,
  type BTFunction,
  type BTNodeData,
  BTNodeType,
  BTExecutionStatus,
} from '../engine/types';
import { generateId } from '../utils/idGenerator';

interface BTStore {
  nodes: BTNode[];
  edges: BTEdge[];
  variables: BTVariable[];
  functions: BTFunction[];
  selectedNodeId: string | null;
  isRunning: boolean;
  executionResults: Map<string, BTExecutionStatus>;

  // Node operations
  addNode: (type: BTNodeType, position: { x: number; y: number }, data?: Partial<BTNodeData>) => string;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<BTNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setSelectedNode: (id: string | null) => void;

  // Edge operations
  addEdge: (source: string, target: string, sourceHandle?: string, targetHandle?: string) => void;
  removeEdge: (id: string) => void;

  // Variable operations
  addVariable: (name: string, type: BTVariable['type'], value: BTVariable['value']) => void;
  updateVariable: (id: string, updates: Partial<BTVariable>) => void;
  removeVariable: (id: string) => void;

  // Function operations
  addFunction: (name: string, body?: string) => void;
  updateFunction: (id: string, updates: Partial<BTFunction>) => void;
  removeFunction: (id: string) => void;

  // Execution
  setRunning: (running: boolean) => void;
  setExecutionResult: (nodeId: string, status: BTExecutionStatus) => void;
  resetExecution: () => void;

  // Load/Save
  exportTree: () => string;
  importTree: (json: string) => void;
  clearAll: () => void;
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
};

export const useBTStore = create<BTStore>((set, get) => ({
  nodes: [],
  edges: [],
  variables: [],
  functions: [],
  selectedNodeId: null,
  isRunning: false,
  executionResults: new Map(),

  addNode: (type, position, dataOverride) => {
    const id = generateId(type);
    const data: BTNodeData = {
      label: dataOverride?.label ?? defaultLabels[type],
      type,
      condition: dataOverride?.condition ?? '',
      action: dataOverride?.action ?? '',
      duration: dataOverride?.duration ?? 1000,
      repeatCount: dataOverride?.repeatCount ?? 1,
      status: BTExecutionStatus.IDLE,
    };
    const node: BTNode = {
      id,
      type: 'bt-node',
      position,
      data,
    };
    set((state) => ({ nodes: [...state.nodes, node] }));
    return id;
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, position } : n
      ),
    }));
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  addEdge: (source, target, sourceHandle, targetHandle) => {
    // Prevent duplicate edges
    const state = get();
    const exists = state.edges.some(
      (e) => e.source === source && e.target === target
    );
    if (exists || source === target) return;

    const edge: BTEdge = {
      id: generateId('edge'),
      source,
      target,
      sourceHandle,
      targetHandle,
    };
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
  },

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

  addFunction: (name, body = '') => {
    const func: BTFunction = {
      id: generateId('func'),
      name,
      body,
      parameters: [],
    };
    set((state) => ({ functions: [...state.functions, func] }));
  },

  updateFunction: (id, updates) => {
    set((state) => ({
      functions: state.functions.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  removeFunction: (id) => {
    set((state) => ({
      functions: state.functions.filter((f) => f.id !== id),
    }));
  },

  setRunning: (running) => set({ isRunning: running }),

  setExecutionResult: (nodeId, status) => {
    set((state) => {
      const newResults = new Map(state.executionResults);
      newResults.set(nodeId, status);
      // Also update node data status
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

  exportTree: () => {
    const state = get();
    return JSON.stringify(
      {
        nodes: state.nodes,
        edges: state.edges,
        variables: state.variables,
        functions: state.functions,
      },
      null,
      2
    );
  },

  importTree: (json) => {
    try {
      const data = JSON.parse(json);
      set({
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        variables: data.variables ?? [],
        functions: data.functions ?? [],
        selectedNodeId: null,
        executionResults: new Map(),
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
      selectedNodeId: null,
      executionResults: new Map(),
    }),
}));
