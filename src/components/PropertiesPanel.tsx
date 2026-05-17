import { useBTStore } from '../store/useBTStore';
import { BTNodeType } from '../engine/types';

export function PropertiesPanel() {
  const nodes = useBTStore((s) => s.nodes);
  const variables = useBTStore((s) => s.variables);
  const selectedNodeIds = useBTStore((s) => s.selectedNodeIds);
  const updateNodeData = useBTStore((s) => s.updateNodeData);
  const updateVariable = useBTStore((s) => s.updateVariable);

  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0])
    : undefined;

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

      {data.type === BTNodeType.DIST_SELECTOR && (
        <div className="prop-group">
          <label>距离阈值 (最后一个为 "Farther")</label>
          <div className="dist-list">
            {(data.distances ?? [300, 650, 2000]).map((d, i) => (
              <div key={i} className="dist-row">
                <input
                  type="number"
                  value={d}
                  onChange={(e) => {
                    const newDistances = [...(data.distances ?? [300, 650, 2000])];
                    newDistances[i] = Number(e.target.value);
                    updateNodeData(selectedNode.id, { distances: newDistances });
                  }}
                />
                <span className="dist-unit">cm</span>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    const newDistances = [...(data.distances ?? [300, 650, 2000])];
                    if (newDistances.length <= 1) return;
                    newDistances.splice(i, 1);
                    updateNodeData(selectedNode.id, { distances: newDistances });
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-small"
            style={{ marginTop: 6 }}
            onClick={() => {
              const cur = data.distances ?? [300, 650, 2000];
              const last = cur[cur.length - 1] ?? 2000;
              updateNodeData(selectedNode.id, { distances: [...cur, last + 500] });
            }}
          >
            + 新增距离
          </button>
        </div>
      )}

      {(data.type === BTNodeType.GET_VARIABLE || data.type === BTNodeType.SET_VARIABLE) && (
        <div className="prop-group">
          <label>变量</label>
          <select
            value={data.variableId ?? ''}
            onChange={(e) => {
              const varId = e.target.value;
              const variable = variables.find((v) => v.id === varId);
              updateNodeData(selectedNode.id, {
                variableId: varId || undefined,
                label: variable?.name ?? 'Variable',
              });
            }}
          >
            <option value="">-- 选择变量 --</option>
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>
      )}

      {data.type === BTNodeType.COMPARE && (
        <>
          <div className="prop-group">
            <label>运算符</label>
            <select
              value={data.operator ?? '<'}
              onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value, label: e.target.value })}
            >
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="==">==</option>
            </select>
          </div>
          <div className="prop-group">
            <label>比较值</label>
            <input
              type="text"
              value={data.compareValue ?? '0'}
              onChange={(e) => updateNodeData(selectedNode.id, { compareValue: e.target.value })}
            />
          </div>
        </>
      )}

      {data.type === BTNodeType.GET_VARIABLE && data.variableId && (
        <div className="prop-group">
          <label>默认值</label>
          {(variables.find((v) => v.id === data.variableId)?.type === 'boolean') ? (
            <select
              value={String(variables.find((v) => v.id === data.variableId)?.value ?? 'false')}
              onChange={(e) => updateVariable(data.variableId!, { value: e.target.value === 'true' })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={variables.find((v) => v.id === data.variableId)?.type === 'number' ? 'number' : 'text'}
              value={String(variables.find((v) => v.id === data.variableId)?.value ?? '')}
              onChange={(e) => {
                const v = variables.find((vr) => vr.id === data.variableId);
                if (!v) return;
                let val: string | number | boolean = e.target.value;
                if (v.type === 'number') val = Number(e.target.value);
                updateVariable(data.variableId!, { value: val });
              }}
            />
          )}
        </div>
      )}

      {data.type === BTNodeType.SET_VARIABLE && (
        <div className="prop-group">
          <label>设置值 (支持表达式)</label>
          <input
            type="text"
            placeholder="e.g. 50, true, hp + 10"
            value={data.setValue ?? ''}
            onChange={(e) =>
              updateNodeData(selectedNode.id, { setValue: e.target.value })
            }
          />
        </div>
      )}

    </div>
  );
}
