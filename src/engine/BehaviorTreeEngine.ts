import { BTNodeType, BTExecutionStatus, type BTNode, type BTEdge, type BTVariable } from './types';

interface ExecutionContext {
  variables: BTVariable[];
  functions: Map<string, (ctx: ExecutionContext) => BTExecutionStatus>;
  onNodeTick: (nodeId: string, status: BTExecutionStatus) => void;
  getChildren: (nodeId: string) => string[];
  getNodeById: (nodeId: string) => BTNode | undefined;
}

type NodeExecutor = (node: BTNode, ctx: ExecutionContext) => BTExecutionStatus;

function getVariable(ctx: ExecutionContext, name: string): boolean | number | string | undefined {
  return ctx.variables.find((v) => v.name === name)?.value;
}

function setVariable(ctx: ExecutionContext, name: string, value: boolean | number | string): void {
  const v = ctx.variables.find((v) => v.name === name);
  if (v) v.value = value;
}

function evalCondition(condition: string, ctx: ExecutionContext): boolean {
  if (!condition.trim()) return true;
  try {
    const vars: Record<string, unknown> = {};
    ctx.variables.forEach((v) => {
      vars[v.name] = v.value;
    });
    const fn = new Function(...Object.keys(vars), `return (${condition});`);
    return !!fn(...Object.values(vars));
  } catch {
    return false;
  }
}

function executeAction(action: string, ctx: ExecutionContext): BTExecutionStatus {
  if (!action.trim()) return BTExecutionStatus.SUCCESS;
  try {
    const vars: Record<string, unknown> = {};
    ctx.variables.forEach((v) => {
      vars[v.name] = v.value;
    });
    // Allow action to update variables via 'set' function
    const fn = new Function(
      ...Object.keys(vars),
      'set',
      `return (function() { ${action} })();`
    );
    const result = fn(...Object.values(vars), (name: string, value: unknown) => {
      setVariable(ctx, name, value as boolean | number | string);
    });
    return result === false ? BTExecutionStatus.FAILURE : BTExecutionStatus.SUCCESS;
  } catch {
    return BTExecutionStatus.FAILURE;
  }
}

function tickChildren(
  children: string[],
  ctx: ExecutionContext,
  mode: 'selector' | 'sequence' | 'parallel'
): BTExecutionStatus {
  if (mode === 'selector') {
    for (const childId of children) {
      const child = ctx.getNodeById(childId);
      if (!child) continue;
      const status = tickNode(child, ctx);
      if (status === BTExecutionStatus.RUNNING) return BTExecutionStatus.RUNNING;
      if (status === BTExecutionStatus.SUCCESS) return BTExecutionStatus.SUCCESS;
    }
    return BTExecutionStatus.FAILURE;
  }

  if (mode === 'sequence') {
    for (const childId of children) {
      const child = ctx.getNodeById(childId);
      if (!child) continue;
      const status = tickNode(child, ctx);
      if (status === BTExecutionStatus.RUNNING) return BTExecutionStatus.RUNNING;
      if (status === BTExecutionStatus.FAILURE) return BTExecutionStatus.FAILURE;
    }
    return BTExecutionStatus.SUCCESS;
  }

  // parallel: all must succeed
  let allSuccess = true;
  for (const childId of children) {
    const child = ctx.getNodeById(childId);
    if (!child) continue;
    const status = tickNode(child, ctx);
    if (status === BTExecutionStatus.FAILURE) return BTExecutionStatus.FAILURE;
    if (status === BTExecutionStatus.RUNNING) allSuccess = false;
  }
  return allSuccess ? BTExecutionStatus.SUCCESS : BTExecutionStatus.RUNNING;
}

function tickNode(node: BTNode, ctx: ExecutionContext): BTExecutionStatus {
  const { type } = node.data;

  switch (type) {
    case BTNodeType.ROOT: {
      const children = ctx.getChildren(node.id);
      if (children.length === 0) return BTExecutionStatus.SUCCESS;
      const status = tickChild(children[0], ctx);
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.SELECTOR:
    case BTNodeType.SEQUENCE:
    case BTNodeType.PARALLEL: {
      const children = ctx.getChildren(node.id);
      const mode = type === BTNodeType.SELECTOR ? 'selector'
        : type === BTNodeType.SEQUENCE ? 'sequence'
        : 'parallel';
      const status = children.length === 0
        ? BTExecutionStatus.SUCCESS
        : tickChildren(children, ctx, mode);
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.CONDITION: {
      const result = evalCondition(node.data.condition ?? '', ctx);
      const status = result ? BTExecutionStatus.SUCCESS : BTExecutionStatus.FAILURE;
      ctx.onNodeTick(node.id, status);

      // If condition passes, tick children
      if (result) {
        const children = ctx.getChildren(node.id);
        if (children.length > 0) {
          const childStatus = tickChild(children[0], ctx);
          return childStatus;
        }
      }
      return status;
    }

    case BTNodeType.INVERTER: {
      const children = ctx.getChildren(node.id);
      if (children.length === 0) {
        ctx.onNodeTick(node.id, BTExecutionStatus.FAILURE);
        return BTExecutionStatus.FAILURE;
      }
      const childStatus = tickChild(children[0], ctx);
      const status = childStatus === BTExecutionStatus.SUCCESS
        ? BTExecutionStatus.FAILURE
        : childStatus === BTExecutionStatus.FAILURE
        ? BTExecutionStatus.SUCCESS
        : BTExecutionStatus.RUNNING;
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.SUCCEEDER: {
      const children = ctx.getChildren(node.id);
      if (children.length > 0) {
        tickChild(children[0], ctx);
      }
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.REPEATER: {
      const count = node.data.repeatCount ?? 1;
      const children = ctx.getChildren(node.id);
      if (children.length === 0) {
        ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
        return BTExecutionStatus.SUCCESS;
      }
      for (let i = 0; i < count; i++) {
        const status = tickChild(children[0], ctx);
        if (status === BTExecutionStatus.FAILURE) {
          ctx.onNodeTick(node.id, BTExecutionStatus.FAILURE);
          return BTExecutionStatus.FAILURE;
        }
        if (status === BTExecutionStatus.RUNNING) {
          ctx.onNodeTick(node.id, BTExecutionStatus.RUNNING);
          return BTExecutionStatus.RUNNING;
        }
      }
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.ACTION: {
      const status = executeAction(node.data.action ?? '', ctx);
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.WAIT: {
      // In simulation, wait is just success with a delay hint
      const duration = node.data.duration ?? 1000;
      // For real-time sim, we'd use async. For now, instant success.
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    default: {
      ctx.onNodeTick(node.id, BTExecutionStatus.FAILURE);
      return BTExecutionStatus.FAILURE;
    }
  }
}

function tickChild(childId: string, ctx: ExecutionContext): BTExecutionStatus {
  const child = ctx.getNodeById(childId);
  if (!child) return BTExecutionStatus.FAILURE;
  return tickNode(child, ctx);
}

export class BehaviorTreeEngine {
  private nodes: Map<string, BTNode> = new Map();
  private edges: BTEdge[] = [];
  private variables: BTVariable[] = [];
  private functions: BTFunction[] = [];
  private onNodeTick: ((nodeId: string, status: BTExecutionStatus) => void) | null = null;

  load(
    nodes: BTNode[],
    edges: BTEdge[],
    variables: BTVariable[],
    functions: BTFunction[],
  ): void {
    this.nodes.clear();
    nodes.forEach((n) => this.nodes.set(n.id, n));
    this.edges = edges;
    this.variables = variables.map((v) => ({ ...v }));
    this.functions = functions;
  }

  onTick(callback: (nodeId: string, status: BTExecutionStatus) => void): void {
    this.onNodeTick = callback;
  }

  tick(): { rootStatus: BTExecutionStatus; results: Map<string, BTExecutionStatus> } {
    const rootNode = Array.from(this.nodes.values()).find(
      (n) => n.data.type === BTNodeType.ROOT
    );
    if (!rootNode) {
      return { rootStatus: BTExecutionStatus.FAILURE, results: new Map() };
    }

    const results = new Map<string, BTExecutionStatus>();

    const ctx: ExecutionContext = {
      variables: this.variables,
      functions: new Map(),
      onNodeTick: (nodeId, status) => {
        results.set(nodeId, status);
        this.onNodeTick?.(nodeId, status);
      },
      getChildren: (nodeId) => {
        return this.edges
          .filter((e) => e.source === nodeId)
          .map((e) => e.target);
      },
      getNodeById: (nodeId) => this.nodes.get(nodeId),
    };

    const rootStatus = tickNode(rootNode, ctx);
    return { rootStatus, results };
  }
}
