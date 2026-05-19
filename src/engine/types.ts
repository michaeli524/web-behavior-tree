export enum BTNodeType {
  ROOT = 'root',
  SELECTOR = 'selector',
  SEQUENCE = 'sequence',
  PARALLEL = 'parallel',
  CONDITION = 'condition',
  ACTION = 'action',
  WAIT = 'wait',
  INVERTER = 'inverter',
  REPEATER = 'repeater',
  SUCCEEDER = 'succeeder',
  FUNCTION = 'function',
  DIST_SELECTOR = 'dist-selector',
  GET_VARIABLE = 'get-variable',
  SET_VARIABLE = 'set-variable',
  COMMENT = 'comment',
  COMPARE = 'compare',
  TEST = 'test',
}

export enum BTExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export interface BTVariable {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'string';
  value: boolean | number | string;
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

export interface BTEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
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
}
