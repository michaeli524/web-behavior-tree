import { useBTStore } from '../store/useBTStore';
import { BTNodeType } from '../engine/types';

export function PropertiesPanel() {
  const nodes = useBTStore((s) => s.nodes);
  const selectedNodeId = useBTStore((s) => s.selectedNodeId);
  const updateNodeData = useBTStore((s) => s.updateNodeData);
  const removeNode = useBTStore((s) => s.removeNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="properties-panel">
        <h3>属性面板</h3>
        <p className="panel-hint">选择一个节点查看和编辑属性</p>
      </div>
    );
  }

  const { data } = selectedNode;

  return (
    <div className="properties-panel">
      <h3>属性面板</h3>

      <div className="prop-group">
        <label>节点名称</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
        />
      </div>

      <div className="prop-group">
        <label>节点类型</label>
        <input type="text" value={data.type} disabled />
      </div>

      {data.type === BTNodeType.CONDITION && (
        <div className="prop-group">
          <label>条件表达式</label>
          <input
            type="text"
            placeholder="e.g. hp > 50"
            value={data.condition ?? ''}
            onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
          />
        </div>
      )}

      {data.type === BTNodeType.ACTION && (
        <div className="prop-group">
          <label>动作代码</label>
          <textarea
            rows={3}
            placeholder="e.g. set('attacking', true)"
            value={data.action ?? ''}
            onChange={(e) => updateNodeData(selectedNode.id, { action: e.target.value })}
          />
        </div>
      )}

      {data.type === BTNodeType.WAIT && (
        <div className="prop-group">
          <label>等待时长 (ms)</label>
          <input
            type="number"
            value={data.duration ?? 1000}
            onChange={(e) =>
              updateNodeData(selectedNode.id, { duration: Number(e.target.value) })
            }
          />
        </div>
      )}

      {data.type === BTNodeType.REPEATER && (
        <div className="prop-group">
          <label>重复次数</label>
          <input
            type="number"
            value={data.repeatCount ?? 1}
            onChange={(e) =>
              updateNodeData(selectedNode.id, { repeatCount: Number(e.target.value) })
            }
          />
        </div>
      )}

      <div className="prop-group">
        <button className="btn btn-danger" onClick={() => removeNode(selectedNode.id)}>
          删除节点
        </button>
      </div>
    </div>
  );
}
