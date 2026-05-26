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
  RANDOM_SELECTOR: 'random-selector',
  GET_VARIABLE: 'get-variable',
  SET_VARIABLE: 'set-variable',
  COMMENT: 'comment',
  COMPARE: 'compare',
  TEST: 'test',
  APPROACH: 'approach',
  DISTANCE_2D: 'distance-2d',
  ANGLE_BETWEEN_CW: 'angle-between-cw',
  ANGLE_BETWEEN_CW_LR_BOTH: 'angle-between-cw-lr-both',
  RESET: 'reset',
  COMBO_SHOW: 'combo-show',
} as const;

export type BTNodeType = (typeof BTNodeType)[keyof typeof BTNodeType];

export const BTExecutionStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;

export type BTExecutionStatus = (typeof BTExecutionStatus)[keyof typeof BTExecutionStatus];

export type BTNumericValue = number | '';

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
  isCombo?: boolean;
  duration?: BTNumericValue;
  repeatCount?: BTNumericValue;
  status?: BTExecutionStatus;
  functionId?: string;
  distances?: BTNumericValue[];
  randomWeights?: BTNumericValue[];
  variableId?: string;
  setValue?: string;
  commentWidth?: number;
  commentHeight?: number;
  operator?: string;
  compareLeftValue?: string;
  compareValue?: string;
  approachDistance?: BTNumericValue;
  startValue?: string;
  endValue?: string;
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
