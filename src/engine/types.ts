export const BTNodeType = {
  ROOT: 'root',
  SELECTOR: 'selector',
  SEQUENCE: 'sequence',
  PARALLEL: 'parallel',
  CONDITION: 'condition',
  ACTION: 'action',
  WAIT: 'wait',
  INVERTER: 'inverter',
  REPEATER: 'repeater',
  SUCCEEDER: 'succeeder',
  FUNCTION: 'function',
  DIST_SELECTOR: 'dist-selector',
  GET_VARIABLE: 'get-variable',
  SET_VARIABLE: 'set-variable',
  COMMENT: 'comment',
  COMPARE: 'compare',
  TEST: 'test',
} as const;

export type BTNodeType = (typeof BTNodeType)[keyof typeof BTNodeType];

export const BTExecutionStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;

export type BTExecutionStatus = (typeof BTExecutionStatus)[keyof typeof BTExecutionStatus];

export interface BTVariable {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'string';
  value: boolean | number | string;
  note?: string;
}

export interface BTFunction {
  id: string;
  name: string;
  body: string;
  parameters: { name: string; type: string }[];
  nodes: BTNode[];
  edges: BTEdge[];
}

export interface BTNodeData {
  label: string;
  type: BTNodeType;
  condition?: string;
  action?: string;
  actionId?: string;
  duration?: number;
  repeatCount?: number;
  status?: BTExecutionStatus;
  functionId?: string;
  distances?: number[];
  variableId?: string;
  setValue?: string;
  commentWidth?: number;
  commentHeight?: number;
  operator?: string;
  compareValue?: string;
}

export interface BTNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BTNodeData;
}

export interface BTEdgeReroutePoint {
  id: string;
  x: number;
  y: number;
}

export interface BTEdgeData {
  reroutePoints?: BTEdgeReroutePoint[];
}

export interface BTEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: BTEdgeData;
}

export interface BTPage {
  id: string;
  name: string;
  nodes: BTNode[];
  edges: BTEdge[];
}

export interface BehaviorTree {
  nodes: BTNode[];
  edges: BTEdge[];
  variables: BTVariable[];
  functions: BTFunction[];
  pages: BTPage[];
  mainPageName?: string;
}
