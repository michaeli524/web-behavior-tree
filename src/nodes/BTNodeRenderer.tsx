import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BTNodeType, BTExecutionStatus, type BTNodeData } from '../engine/types';

const statusColors: Record<BTExecutionStatus, string> = {
  [BTExecutionStatus.IDLE]: '#555',
  [BTExecutionStatus.RUNNING]: '#3b82f6',
  [BTExecutionStatus.SUCCESS]: '#22c55e',
  [BTExecutionStatus.FAILURE]: '#ef4444',
};

const typeConfig: Record<BTNodeType, { color: string; icon: string }> = {
  [BTNodeType.ROOT]: { color: '#6366f1', icon: '🏠' },
  [BTNodeType.SELECTOR]: { color: '#f59e0b', icon: '❓' },
  [BTNodeType.SEQUENCE]: { color: '#3b82f6', icon: '→' },
  [BTNodeType.PARALLEL]: { color: '#8b5cf6', icon: '⇉' },
  [BTNodeType.CONDITION]: { color: '#14b8a6', icon: '◆' },
  [BTNodeType.ACTION]: { color: '#22c55e', icon: '⚡' },
  [BTNodeType.WAIT]: { color: '#94a3b8', icon: '⏱' },
  [BTNodeType.INVERTER]: { color: '#ef4444', icon: '¬' },
  [BTNodeType.REPEATER]: { color: '#ec4899', icon: '↻' },
  [BTNodeType.SUCCEEDER]: { color: '#a3e635', icon: '✓' },
};

function BTNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as BTNodeData;
  const config = typeConfig[nodeData.type] ?? typeConfig[BTNodeType.ACTION];
  const status = nodeData.status ?? BTExecutionStatus.IDLE;
  const borderColor = status !== BTExecutionStatus.IDLE ? statusColors[status] : config.color;

  const isComposite = [
    BTNodeType.ROOT,
    BTNodeType.SELECTOR,
    BTNodeType.SEQUENCE,
    BTNodeType.PARALLEL,
  ].includes(nodeData.type);

  const isDecorator = [
    BTNodeType.CONDITION,
    BTNodeType.INVERTER,
    BTNodeType.REPEATER,
    BTNodeType.SUCCEEDER,
  ].includes(nodeData.type);

  const isLeaf = [BTNodeType.ACTION, BTNodeType.WAIT].includes(nodeData.type);

  const showInput =
    nodeData.type !== BTNodeType.ROOT;
  const showOutput = isComposite || isDecorator;

  return (
    <div
      className={`bt-node ${selected ? 'selected' : ''}`}
      style={{
        borderColor,
        borderRadius: nodeData.type === BTNodeType.ROOT ? '8px' : '6px',
        minWidth: isLeaf ? 100 : 130,
        background: nodeData.type === BTNodeType.ROOT ? '#1e1b4b' : '#1e293b',
      }}
    >
      {showInput && (
        <Handle type="target" position={Position.Top} className="bt-handle" />
      )}

      <div className="bt-node-header" style={{ background: config.color }}>
        <span>{config.icon}</span>
        <span>{nodeData.label}</span>
      </div>

      {(isComposite || isDecorator) && (
        <div className="bt-node-body">
          {nodeData.type === BTNodeType.CONDITION && nodeData.condition && (
            <div className="bt-node-cond">{nodeData.condition}</div>
          )}
          {nodeData.type === BTNodeType.REPEATER && (
            <div className="bt-node-cond">×{nodeData.repeatCount ?? 1}</div>
          )}
        </div>
      )}

      {isLeaf && (
        <div className="bt-node-body">
          {nodeData.type === BTNodeType.ACTION && nodeData.action && (
            <div className="bt-node-cond">{nodeData.action}</div>
          )}
          {nodeData.type === BTNodeType.WAIT && (
            <div className="bt-node-cond">{nodeData.duration ?? 1000}ms</div>
          )}
        </div>
      )}

      {status !== BTExecutionStatus.IDLE && (
        <div
          className="bt-node-status"
          style={{ background: statusColors[status] }}
        >
          {status}
        </div>
      )}

      {showOutput && (
        <Handle type="source" position={Position.Bottom} className="bt-handle" />
      )}
    </div>
  );
}

export const BTNodeRenderer = memo(BTNodeComponent);
