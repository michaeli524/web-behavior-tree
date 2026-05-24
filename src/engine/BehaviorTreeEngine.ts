import { BTNodeType, BTExecutionStatus, type BTFunction, type BTNode, type BTEdge, type BTVariable } from './types';

interface ExecutionContext {
  variables: BTVariable[];
  onNodeTick: (nodeId: string, status: BTExecutionStatus) => void;
  getChildren: (nodeId: string) => string[];
  getEdgesBySource: (nodeId: string) => BTEdge[];
  getNodeById: (nodeId: string) => BTNode | undefined;
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
      const conditionPassed = evalCondition(node.data.condition ?? '', ctx);
      ctx.onNodeTick(node.id, conditionPassed ? BTExecutionStatus.SUCCESS : BTExecutionStatus.FAILURE);

      // Children filtered by handle: exec-true or exec-false
      const allChildren = ctx.getChildren(node.id);
      // Find child connected to the appropriate output
      const targetHandle = conditionPassed ? 'exec-true' : 'exec-false';
      const branchChildId = allChildren.find((cid) => {
        const edge = ctx.getEdgesBySource(node.id).find((e) => e.target === cid);
        return edge?.sourceHandle === targetHandle;
      });

      if (branchChildId) {
        const childStatus = tickChild(branchChildId, ctx);
        return childStatus;
      }
      return conditionPassed ? BTExecutionStatus.SUCCESS : BTExecutionStatus.FAILURE;
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
      const count = node.data.repeatCount === '' || node.data.repeatCount == null
        ? 1
        : Number(node.data.repeatCount);
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

    case BTNodeType.DIST_SELECTOR: {
      const children = ctx.getChildren(node.id);
      if (children.length === 0) {
        ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
        return BTExecutionStatus.SUCCESS;
      }
      // Children are connected via distance handles; tick all in order (like Selector)
      for (const childId of children) {
        const child = ctx.getNodeById(childId);
        if (!child) continue;
        const status = tickNode(child, ctx);
        if (status === BTExecutionStatus.RUNNING) {
          ctx.onNodeTick(node.id, status);
          return status;
        }
        if (status === BTExecutionStatus.SUCCESS) {
          ctx.onNodeTick(node.id, status);
          return status;
        }
      }
      ctx.onNodeTick(node.id, BTExecutionStatus.FAILURE);
      return BTExecutionStatus.FAILURE;
    }

    case BTNodeType.RANDOM_SELECTOR: {
      const edges = ctx.getEdgesBySource(node.id)
        .filter((edge) => edge.sourceHandle?.startsWith('random-'));
      if (edges.length === 0) {
        ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
        return BTExecutionStatus.SUCCESS;
      }

      const weights = node.data.randomWeights ?? [50, 30, 20];
      const options = edges.map((edge) => {
        const index = Number(edge.sourceHandle?.replace('random-', '') ?? 0);
        return {
          target: edge.target,
          weight: Math.max(0, Number(weights[index] || 0)),
        };
      });
      const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
      let pick = totalWeight > 0 ? Math.random() * totalWeight : Math.random() * options.length;
      const selected = options.find((option) => {
        pick -= totalWeight > 0 ? option.weight : 1;
        return pick <= 0;
      }) ?? options[options.length - 1];

      const status = tickChild(selected.target, ctx);
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.ACTION: {
      const status = executeAction(node.data.action ?? '', ctx);
      ctx.onNodeTick(node.id, status);
      return status;
    }

    case BTNodeType.WAIT: {
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.APPROACH: {
      // Approach task: move toward target until within approachDistance
      // Placeholder — always succeeds in simulation
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.DISTANCE_2D: {
      // Data node: computes 2D distance between start/end values
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.GET_VARIABLE: {
      ctx.onNodeTick(node.id, BTExecutionStatus.SUCCESS);
      return BTExecutionStatus.SUCCESS;
    }

    case BTNodeType.SET_VARIABLE: {
      const varId = node.data.variableId;
      const targetVar = varId ? ctx.variables.find((v) => v.id === varId) : undefined;
      if (targetVar) {
        const setExpr = node.data.setValue;
        if (setExpr && setExpr.trim()) {
          try {
            const vars: Record<string, unknown> = {};
            ctx.variables.forEach((v) => { vars[v.name] = v.value; });
            const fn = new Function(...Object.keys(vars), `return (${setExpr});`);
            targetVar.value = fn(...Object.values(vars)) as boolean | number | string;
          } catch { /* eval failed */ }
        }
      }
      // Continue execution to children
      const sChildren = ctx.getChildren(node.id);
      if (sChildren.length > 0) {
        const childStatus = tickChild(sChildren[0], ctx);
        ctx.onNodeTick(node.id, childStatus);
        return childStatus;
      }
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
  private onNodeTick: ((nodeId: string, status: BTExecutionStatus) => void) | null = null;

  load(
    nodes: BTNode[],
    edges: BTEdge[],
    variables: BTVariable[],
    _functions: BTFunction[],
  ): void {
    this.nodes.clear();
    nodes.forEach((n) => this.nodes.set(n.id, n));
    this.edges = edges;
    this.variables = variables.map((v) => ({ ...v }));
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
      onNodeTick: (nodeId, status) => {
        results.set(nodeId, status);
        this.onNodeTick?.(nodeId, status);
      },
      getChildren: (nodeId) => {
        return this.edges
          .filter((e) => e.source === nodeId)
          .map((e) => e.target);
      },
      getEdgesBySource: (nodeId) => {
        return this.edges.filter((e) => e.source === nodeId);
      },
      getNodeById: (nodeId) => this.nodes.get(nodeId),
    };

    const rootStatus = tickNode(rootNode, ctx);
    return { rootStatus, results };
  }
}
