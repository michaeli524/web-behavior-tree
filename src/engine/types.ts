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
}

export interface BTNodeData {
  label: string;
  type: BTNodeType;
  condition?: string;
  action?: string;
  duration?: number;
  repeatCount?: number;
  status?: BTExecutionStatus;
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

export interface BehaviorTree {
  nodes: BTNode[];
  edges: BTEdge[];
  variables: BTVariable[];
  functions: BTFunction[];
}
