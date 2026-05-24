import { useState } from 'react';
import { useBTStore } from '../store/useBTStore';
import { BTNodeType } from '../engine/types';
import { useActionCatalog } from '../config/actionCatalog';

export function PropertiesPanel() {
  const nodes = useBTStore((s) => s.nodes);
  const pages = useBTStore((s) => s.pages);
  const functions = useBTStore((s) => s.functions);
  const activePageId = useBTStore((s) => s.activePageId);
  const variables = useBTStore((s) => s.variables);
  const selectedNodeIds = useBTStore((s) => s.selectedNodeIds);
  const updateNodeData = useBTStore((s) => s.updateNodeData);
  const updateVariable = useBTStore((s) => s.updateVariable);
  const [isActionPickerOpen, setIsActionPickerOpen] = useState(false);
  const [highlightedActionIndex, setHighlightedActionIndex] = useState(0);

  const activeNodes = activePageId === 'main'
    ? nodes
    : pages.find((p) => p.id === activePageId)?.nodes
      ?? functions.find((f) => f.id === activePageId)?.nodes
      ?? [];
  const selectedNode = selectedNodeIds.length === 1
    ? activeNodes.find((n) => n.id === selectedNodeIds[0])
    : undefined;
  const { actions, actionById, error: actionCatalogError } = useActionCatalog();

  if (!selectedNode) {
    return (
      <div className="properties-panel">
        <h3>属性面板</h3>
        <p className="panel-hint">选择一个节点查看和编辑属性</p>
      </div>
    );
  }

  const { data } = selectedNode;
  const selectedAction = data.actionId ? actionById.get(data.actionId) : undefined;
  const actionQuery = data.actionId ?? '';
  const filteredActions = actions.filter((action) =>
    action.actionId.toLowerCase().includes(actionQuery.toLowerCase())
  );
  const actionOptions = actionQuery ? filteredActions : actions;
  const activeActionIndex = actionOptions.length > 0
    ? Math.min(highlightedActionIndex, actionOptions.length - 1)
    : -1;

  const selectActionId = (actionId: string) => {
    updateNodeData(selectedNode.id, { actionId: actionId || undefined });
    setIsActionPickerOpen(false);
    setHighlightedActionIndex(0);
  };

  return (
    <div className="properties-panel">
      <h3>属性面板</h3>

      <div className="prop-group">
        <label>节点类型</label>
        <input type="text" value={data.type} disabled />
      </div>

      {data.type === BTNodeType.COMMENT && (
        <div className="prop-group">
          <label>注释标题</label>
          <input
            type="text"
            value={data.label ?? ''}
            placeholder="Comment"
            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          />
        </div>
      )}

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
        <>
          <div className="prop-group">
            <label>技能配置</label>
            <div className="action-id-combobox">
              <input
                type="text"
                className="action-id-input"
                placeholder="Search ActionId..."
                value={actionQuery}
                autoComplete="off"
                onFocus={() => {
                  setIsActionPickerOpen(true);
                  setHighlightedActionIndex(0);
                }}
                onBlur={() => window.setTimeout(() => setIsActionPickerOpen(false), 120)}
                onChange={(e) => {
                  updateNodeData(selectedNode.id, {
                    actionId: e.target.value.trim() || undefined,
                  });
                  setIsActionPickerOpen(true);
                  setHighlightedActionIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsActionPickerOpen(false);
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIsActionPickerOpen(true);
                    setHighlightedActionIndex((index) =>
                      actionOptions.length ? (index + 1) % actionOptions.length : 0
                    );
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIsActionPickerOpen(true);
                    setHighlightedActionIndex((index) =>
                      actionOptions.length ? (index - 1 + actionOptions.length) % actionOptions.length : 0
                    );
                    return;
                  }
                  if (e.key === 'Enter' && activeActionIndex >= 0) {
                    e.preventDefault();
                    selectActionId(actionOptions[activeActionIndex].actionId);
                  }
                }}
              />
              {actionQuery && (
                <button
                  type="button"
                  className="action-id-clear"
                  title="清空 ActionId"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectActionId('')}
                >
                  ×
                </button>
              )}
              <button
                type="button"
                className="action-id-toggle"
                title="展开 ActionId 列表"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setIsActionPickerOpen((open) => !open);
                  setHighlightedActionIndex(0);
                }}
              >
                ▾
              </button>
              {isActionPickerOpen && (
                <div className="action-id-menu">
                  {actionOptions.length > 0 ? (
                    actionOptions.map((action, index) => (
                      <button
                        type="button"
                        key={action.actionId}
                        className={`action-id-option ${index === activeActionIndex ? 'highlighted' : ''} ${action.actionId === data.actionId ? 'selected' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlightedActionIndex(index)}
                        onClick={() => selectActionId(action.actionId)}
                      >
                        {action.actionId}
                      </button>
                    ))
                  ) : (
                    <div className="action-id-empty">无匹配 ActionId</div>
                  )}
                </div>
              )}
            </div>
            {actionCatalogError && (
              <div className="prop-error">{actionCatalogError}</div>
            )}
          </div>

          <div className="prop-group">
            <label>中文名称</label>
            <input
              type="text"
              value={selectedAction?.actionName ?? ''}
              placeholder="根据 ActionId 自动映射"
              disabled
            />
          </div>

          <div className="action-preview-panel">
            {selectedAction?.gifPath ? (
              <ActionPreviewImage src={selectedAction.gifPath} alt={selectedAction.actionId} />
            ) : data.actionId ? (
              <div className="action-preview-empty">未找到 ActionId: {data.actionId}</div>
            ) : (
              <div className="action-preview-empty">选择一个 ActionId 后显示 GIF 预览</div>
            )}
            {selectedAction && (
              <>
                <div className="action-preview-title">{selectedAction.actionId}</div>
                <div className="action-preview-grid">
                  <span>ActionId</span><strong>{selectedAction.actionId}</strong>
                  <span>GIF</span><strong>{selectedAction.gifPath}</strong>
                </div>
              </>
            )}
          </div>

          <div className="prop-group">
            <label>临时动作代码</label>
            <textarea
              rows={3}
              placeholder="e.g. set('attacking', true)"
              value={data.action ?? ''}
              onChange={(e) => updateNodeData(selectedNode.id, { action: e.target.value })}
            />
          </div>
        </>
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
              updateNodeData(selectedNode.id, {
                variableId: varId || undefined,
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
              onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value })}
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

function ActionPreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="action-preview-empty">GIF 文件待放入项目资源目录</div>;
  }
  return (
    <img
      className="action-preview-gif"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
