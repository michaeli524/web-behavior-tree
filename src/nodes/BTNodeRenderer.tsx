import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useBTStore } from '../store/useBTStore';
import { BTNodeType, BTExecutionStatus, type BTNodeData } from '../engine/types';
import { useActionCatalog } from '../config/actionCatalog';

const statusColors: Record<BTExecutionStatus, string> = {
  [BTExecutionStatus.IDLE]: '#555',
  [BTExecutionStatus.RUNNING]: '#3b82f6',
  [BTExecutionStatus.SUCCESS]: '#22c55e',
  [BTExecutionStatus.FAILURE]: '#ef4444',
};

const typeConfig: Record<BTNodeType, { color: string; icon: string }> = {
  [BTNodeType.ROOT]: { color: '#6b7b8f', icon: '🏠' },
  [BTNodeType.SELECTOR]: { color: '#8a7b5c', icon: '❓' },
  [BTNodeType.SEQUENCE]: { color: '#5a7a96', icon: '→' },
  [BTNodeType.PARALLEL]: { color: '#776b8a', icon: '⇉' },
  [BTNodeType.CONDITION]: { color: '#5a8a82', icon: '◆' },
  [BTNodeType.ACTION]: { color: '#5a8a64', icon: '⚡' },
  [BTNodeType.WAIT]: { color: '#7a828c', icon: '⏱' },
  [BTNodeType.INVERTER]: { color: '#8c5a5a', icon: '¬' },
  [BTNodeType.REPEATER]: { color: '#8a6072', icon: '↻' },
  [BTNodeType.SUCCEEDER]: { color: '#7a8c5a', icon: '✓' },
  [BTNodeType.FUNCTION]: { color: '#8a6e4a', icon: '📦' },
  [BTNodeType.DIST_SELECTOR]: { color: '#6b8a7a', icon: '📏' },
  [BTNodeType.GET_VARIABLE]: { color: '#8a5a6a', icon: '📤' },
  [BTNodeType.SET_VARIABLE]: { color: '#6a7a5a', icon: '📥' },
  [BTNodeType.COMMENT]: { color: '#5a6a5a', icon: '💬' },
  [BTNodeType.COMPARE]: { color: '#7a5a5a', icon: '' },
  [BTNodeType.TEST]: { color: '#7a8a6b', icon: '🧪' },
};

function BTNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as unknown as BTNodeData;
  const config = typeConfig[nodeData.type] ?? typeConfig[BTNodeType.ACTION];
  const status = nodeData.status ?? BTExecutionStatus.IDLE;
  const borderColor = status !== BTExecutionStatus.IDLE ? statusColors[status] : config.color;

  const isComposite = [BTNodeType.ROOT, BTNodeType.SELECTOR, BTNodeType.SEQUENCE, BTNodeType.PARALLEL, BTNodeType.TEST].includes(nodeData.type);
  const isDecorator = [BTNodeType.INVERTER, BTNodeType.REPEATER, BTNodeType.SUCCEEDER].includes(nodeData.type);
  const isCondition = nodeData.type === BTNodeType.CONDITION;
  const isLeaf = [BTNodeType.ACTION, BTNodeType.WAIT, BTNodeType.FUNCTION].includes(nodeData.type);
  const isDist = nodeData.type === BTNodeType.DIST_SELECTOR;
  const isGetVar = nodeData.type === BTNodeType.GET_VARIABLE;
  const isSetVar = nodeData.type === BTNodeType.SET_VARIABLE;
  const isComment = nodeData.type === BTNodeType.COMMENT;
  const isCompare = nodeData.type === BTNodeType.COMPARE;
  const { actionById } = useActionCatalog();
  const actionConfig = nodeData.actionId ? actionById.get(nodeData.actionId) : undefined;
  const actionTitle = actionConfig?.actionName ?? nodeData.label;

  const showInput = nodeData.type !== BTNodeType.ROOT && !isGetVar && !isCondition && !isCompare;
  const showOutput = isComposite || isDecorator || isSetVar;

  const distances = nodeData.distances ?? [300, 650, 2000];

  // Set node inline editing
  const updateNodeData = useBTStore((s) => s.updateNodeData);
  const [localSetVal, setLocalSetVal] = useState<string | null>(null);
  const displaySetVal = localSetVal ?? nodeData.setValue ?? '';

  const commitSetValue = useCallback(() => {
    if (localSetVal !== null) {
      updateNodeData(id, { setValue: localSetVal });
      setLocalSetVal(null);
    }
  }, [id, localSetVal, updateNodeData]);

  // Command/Ctrl + click handle → disconnect
  const handleClick = useCallback((e: React.MouseEvent, handleId?: string) => {
    if (!e.metaKey && !e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const state = useBTStore.getState();
    const edges = state.edges.filter(
      (edge) =>
        (edge.source === id && (edge.sourceHandle ?? undefined) === handleId) ||
        (edge.target === id && (edge.targetHandle ?? undefined) === handleId)
    );
    edges.forEach((edge) => state.removeEdge(edge.id));
  }, [id]);

  // ── Comment node: simple styled box ──
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');

  if (isComment) {
    const w = nodeData.commentWidth ?? 300;
    const h = nodeData.commentHeight ?? 150;

    const handleResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = w;
      const startH = h;

      const onMove = (ev: MouseEvent) => {
        updateNodeData(id, {
          commentWidth: Math.max(200, startW + ev.clientX - startX),
          commentHeight: Math.max(80, startH + ev.clientY - startY),
        });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    const startEdit = () => {
      setEditingTitle(true);
      setTitleVal(nodeData.label);
    };
    const commitEdit = () => {
      if (titleVal.trim()) updateNodeData(id, { label: titleVal.trim() });
      setEditingTitle(false);
    };

    return (
      <div
        className={`bt-comment ${selected ? 'bt-comment-selected' : ''}`}
        style={{ width: w, height: h }}
      >
        {editingTitle ? (
          <input
            className="bt-comment-title"
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            autoFocus
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="bt-comment-title bt-comment-title-bar"
            onDoubleClick={startEdit}
          >
            {nodeData.label || 'Comment'}
          </div>
        )}
        <div
          className="bt-comment-resize-handle"
          onMouseDown={handleResizeStart}
        />
      </div>
    );
  }

  return (
    <div
      className={`bt-node ${nodeData.type === BTNodeType.TEST ? 'bt-node-test' : ''} ${selected ? 'selected' : ''}`}
      style={{
        borderColor,
        borderRadius: '6px',
        minWidth: isDist ? 150 : isGetVar ? 80 : isCompare ? 70 : isSetVar ? 100 : isCondition ? 140 : isLeaf ? 100 : 130,
        background: nodeData.type === BTNodeType.ROOT ? '#484850' : '#484848',
      }}
    >
      {/* ── Header bar ── */}
        <div className="bt-node-header" style={{ background: config.color }}>
        <span className={`bt-node-header-text ${isGetVar ? 'bt-node-header-text-get' : ''}`}>
          {nodeData.type !== BTNodeType.ROOT && <span className="bt-node-header-icon">{config.icon}</span>}
          {isSetVar && 'SET: '}
          {nodeData.type === BTNodeType.ACTION ? actionTitle : nodeData.label}
        </span>

        {/* Get red data output */}
        {isGetVar && (
          <Handle type="source" position={Position.Right} id="data-out" className="bt-handle bt-handle-data bt-hdr-handle" onClick={(e) => handleClick(e, 'data-out')} />
        )}
      </div>

      {/* ── Execution row ── */}
      {!isDist && !isGetVar && !isComment && !isCompare && (
        <div className="bt-node-exec-row">
          {(showInput || isCondition) && (
            <Handle type="target" position={Position.Left} id="exec-in" className="bt-handle bt-handle-exec-row" onClick={(e) => handleClick(e, 'exec-in')} />
          )}
          {showOutput && !isCondition && (
            <Handle type="source" position={Position.Right} id="exec-out" className="bt-handle bt-handle-exec-row" onClick={(e) => handleClick(e, 'exec-out')} />
          )}
        </div>
      )}

      {/* ── DistSelector body ── */}
      {isDist && (
        <div className="bt-node-body bt-node-dist-body">
          <div className="bt-node-exec-row">
            <Handle type="target" position={Position.Left} id="exec-in" className="bt-handle bt-handle-exec-row" onClick={(e) => handleClick(e, 'exec-in')} />
          </div>
          {distances.map((d, i) => (
            <div key={`dist-${i}`} className="bt-node-dist-row">
              <span className="bt-node-dist-label">&lt; {d}</span>
              <Handle type="source" position={Position.Right} id={`dist-${i}`} className="bt-handle bt-handle-dist" onClick={(e) => handleClick(e, `dist-${i}`)} />
            </div>
          ))}
          <div className="bt-node-dist-row">
            <span className="bt-node-dist-label">Farther</span>
            <Handle type="source" position={Position.Right} id="dist-last" className="bt-handle bt-handle-dist" onClick={(e) => handleClick(e, 'dist-last')} />
          </div>
        </div>
      )}

      {/* ── Regular composite/decorator body ── */}
      {(isComposite || isDecorator) && !isDist && (
        <div className="bt-node-body">
          {nodeData.type === BTNodeType.REPEATER && (
            <div className="bt-node-cond">×{nodeData.repeatCount ?? 1}</div>
          )}
        </div>
      )}

      {/* ── Condition body ── */}
      {isCondition && (
        <div className="bt-node-body bt-node-cond-body">
          {nodeData.condition && (
            <div className="bt-node-cond-text">{nodeData.condition}</div>
          )}
          <div className="bt-node-cond-rows">
            <div className="bt-node-cond-row">
              <span className="bt-node-branch-label">True</span>
              <Handle type="source" position={Position.Right} id="exec-true" className="bt-handle bt-handle-row-right" onClick={(e) => handleClick(e, 'exec-true')} />
            </div>
            <div className="bt-node-cond-row">
              <Handle type="target" position={Position.Left} id="data-in" className="bt-handle bt-handle-data bt-handle-row-left" onClick={(e) => handleClick(e, 'data-in')} />
              <span className="bt-node-branch-label">False</span>
              <Handle type="source" position={Position.Right} id="exec-false" className="bt-handle bt-handle-row-right" onClick={(e) => handleClick(e, 'exec-false')} />
            </div>
          </div>
        </div>
      )}

      {/* ── Leaf body ── */}
      {isLeaf && (
        <div className="bt-node-body">
          {nodeData.type === BTNodeType.ACTION && (
            <div className="bt-action-card">
              {actionConfig?.gifPath ? (
                <ActionThumb src={actionConfig.gifPath} alt={actionConfig.actionName} />
              ) : (
                <div className="bt-action-thumb bt-action-thumb-empty">GIF</div>
              )}
              <div className="bt-action-meta">
                <div className="bt-action-id">
                  {actionConfig?.actionId ?? nodeData.actionId ?? '请选择动作'}
                </div>
                <div className="bt-action-comment">
                  {actionConfig?.comment ?? '资源未配置'}
                </div>
              </div>
            </div>
          )}
          {nodeData.type === BTNodeType.WAIT && (
            <div className="bt-node-cond">{nodeData.duration ?? 1000}ms</div>
          )}
        </div>
      )}

      {/* ── Compare data row ── */}
      {isCompare && (
        <div className="bt-node-exec-row">
          <Handle type="target" position={Position.Left} id="data-in" className="bt-handle bt-handle-data bt-handle-exec-row" onClick={(e) => handleClick(e, 'data-in')} />
          <Handle type="source" position={Position.Right} id="data-out" className="bt-handle bt-handle-data bt-handle-exec-row" onClick={(e) => handleClick(e, 'data-out')} />
        </div>
      )}

      {/* ── Compare node ── */}
      {isCompare && (
        <div className="bt-node-body bt-compare-body">
          <span className="bt-compare-op">{nodeData.operator ?? '<'}</span>
          <input
            className="bt-node-set-input"
            type="text"
            value={nodeData.compareValue ?? '0'}
            onChange={(e) => updateNodeData(id, { compareValue: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Set Variable body ── */}
      {isSetVar && (
        <div className="bt-node-body">
          <input
            className="bt-node-set-input"
            type="text"
            placeholder="value"
            value={displaySetVal}
            onChange={(e) => setLocalSetVal(e.target.value)}
            onBlur={commitSetValue}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSetValue(); }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {status !== BTExecutionStatus.IDLE && (
        <div className="bt-node-status" style={{ background: statusColors[status] }}>
          {status}
        </div>
      )}
    </div>
  );
}

export const BTNodeRenderer = memo(BTNodeComponent);

function ActionThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="bt-action-thumb bt-action-thumb-empty">GIF</div>;
  }
  return (
    <img
      className="bt-action-thumb"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
