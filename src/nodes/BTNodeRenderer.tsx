import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useBTStore } from '../store/useBTStore';
import { BTNodeType, BTExecutionStatus, type BTNodeData } from '../engine/types';
import { useActionCatalog } from '../config/actionCatalog';
import { isShowcaseMode } from '../config/appMode';
import { ensureVideoThumbnail, getVideoThumbnail, subscribeVideoThumbnails } from '../utils/mediaPreloader';
import { getRandomHandleId, getRandomWeightIds, getRandomWeights } from '../utils/randomSelector';

const statusColors: Record<BTExecutionStatus, string> = {
  [BTExecutionStatus.IDLE]: '#555',
  [BTExecutionStatus.RUNNING]: '#3b82f6',
  [BTExecutionStatus.SUCCESS]: '#22c55e',
  [BTExecutionStatus.FAILURE]: '#ef4444',
};

const typeConfig: Record<BTNodeType, { color: string; icon: string }> = {
  [BTNodeType.ROOT]: { color: '#6b7b8f', icon: '🏠' },
  [BTNodeType.SELECTOR]: { color: '#8a7b5c', icon: '❓' },
  [BTNodeType.SEQUENCE]: { color: '#5a7a96', icon: '↓' },
  [BTNodeType.PARALLEL]: { color: '#776b8a', icon: '⇉' },
  [BTNodeType.CONDITION]: { color: '#5a8a82', icon: '◆' },
  [BTNodeType.ACTION]: { color: '#5a8a64', icon: '⚡' },
  [BTNodeType.WAIT]: { color: '#7a828c', icon: '⏱' },
  [BTNodeType.INVERTER]: { color: '#8c5a5a', icon: '¬' },
  [BTNodeType.REPEATER]: { color: '#8a6072', icon: '↻' },
  [BTNodeType.SUCCEEDER]: { color: '#7a8c5a', icon: '✓' },
  [BTNodeType.FUNCTION]: { color: '#8a6e4a', icon: '📦' },
  [BTNodeType.DIST_SELECTOR]: { color: '#6b8a7a', icon: '📏' },
  [BTNodeType.RANDOM_SELECTOR]: { color: '#8a6b78', icon: '🎲' },
  [BTNodeType.GET_VARIABLE]: { color: '#5f806a', icon: '📤' },
  [BTNodeType.SET_VARIABLE]: { color: '#6f8a62', icon: '📥' },
  [BTNodeType.COMMENT]: { color: '#5a6a5a', icon: '💬' },
  [BTNodeType.COMPARE]: { color: '#7a5a5a', icon: '' },
  [BTNodeType.TEST]: { color: '#7a8a6b', icon: '🧪' },
  [BTNodeType.APPROACH]: { color: '#6b7a8a', icon: '🏃' },
  [BTNodeType.DISTANCE_2D]: { color: '#7a6b8a', icon: '📐' },
  [BTNodeType.ANGLE_BETWEEN_CW]: { color: '#7a6b8a', icon: '↻' },
  [BTNodeType.ANGLE_BETWEEN_CW_LR_BOTH]: { color: '#7a6b8a', icon: '↻' },
  [BTNodeType.RESET]: { color: '#8a5a5a', icon: '🔄' },
  [BTNodeType.RETURN]: { color: '#8a5a5a', icon: '↩' },
  [BTNodeType.COMBO_SHOW]: { color: '#7a6b5a', icon: '🎬' },
};

const compositeTypes: BTNodeType[] = [
  BTNodeType.ROOT,
  BTNodeType.SELECTOR,
  BTNodeType.SEQUENCE,
  BTNodeType.PARALLEL,
  BTNodeType.TEST,
];

const decoratorTypes: BTNodeType[] = [
  BTNodeType.INVERTER,
  BTNodeType.REPEATER,
  BTNodeType.SUCCEEDER,
];

const leafTypes: BTNodeType[] = [
  BTNodeType.ACTION,
  BTNodeType.WAIT,
  BTNodeType.FUNCTION,
  BTNodeType.APPROACH,
];

type CommentResizeDirection = 'top' | 'right' | 'bottom' | 'left';

function BTNodeComponent({ data, selected, id }: NodeProps) {
  const isReadonly = isShowcaseMode;
  const nodeData = data as unknown as BTNodeData & {
    commentTitleEditRequestNonce?: number;
    onCommentTitleEditStarted?: () => void;
    onActionPreviewClick?: () => void;
    onComboTitleClick?: () => void;
    onComboPreviewClick?: () => void;
  };
  const config = typeConfig[nodeData.type] ?? typeConfig[BTNodeType.ACTION];
  const status = nodeData.status ?? BTExecutionStatus.IDLE;
  const borderColor = status !== BTExecutionStatus.IDLE ? statusColors[status] : config.color;
  const reactFlow = useReactFlow();

  const isComposite = compositeTypes.includes(nodeData.type);
  const isDecorator = decoratorTypes.includes(nodeData.type);
  const isCondition = nodeData.type === BTNodeType.CONDITION;
  const isSequence = nodeData.type === BTNodeType.SEQUENCE;
  const isLeaf = leafTypes.includes(nodeData.type);
  const isDist = nodeData.type === BTNodeType.DIST_SELECTOR;
  const isRandom = nodeData.type === BTNodeType.RANDOM_SELECTOR;
  const isDistance2D = nodeData.type === BTNodeType.DISTANCE_2D;
  const isAngleBetweenCW =
    nodeData.type === BTNodeType.ANGLE_BETWEEN_CW ||
    nodeData.type === BTNodeType.ANGLE_BETWEEN_CW_LR_BOTH;
  const isReset = nodeData.type === BTNodeType.RESET;
  const isReturn = nodeData.type === BTNodeType.RETURN;
  const isApproach = nodeData.type === BTNodeType.APPROACH;
  const isComboShow = nodeData.type === BTNodeType.COMBO_SHOW;
  const isComboDisplay = isComboShow && nodeData.isCombo !== false;
  const isDataCalcNode = isDistance2D || isAngleBetweenCW;
  const isMultiOutputSelector = isDist || isRandom;
  const isGetVar = nodeData.type === BTNodeType.GET_VARIABLE;
  const isSetVar = nodeData.type === BTNodeType.SET_VARIABLE;
  const isComment = nodeData.type === BTNodeType.COMMENT;
  const isCompare = nodeData.type === BTNodeType.COMPARE;
  const isFunction = nodeData.type === BTNodeType.FUNCTION;
  const { actionById } = useActionCatalog();
  const actionConfig = nodeData.actionId ? actionById.get(nodeData.actionId) : undefined;
  const variables = useBTStore((s) => s.variables);
  const functions = useBTStore((s) => s.functions);
  const pages = useBTStore((s) => s.pages);
  const edges = useBTStore((s) => s.edges);

  const showInput = nodeData.type !== BTNodeType.ROOT && !isGetVar && !isCondition && !isCompare;
  const showOutput = isComposite || isDecorator || isSetVar || isFunction || isComboShow || nodeData.type === BTNodeType.APPROACH || nodeData.type === BTNodeType.ACTION;

  const distances = nodeData.distances ?? [300, 650, 2000];
  const randomWeights = getRandomWeights(nodeData);
  const randomWeightIds = getRandomWeightIds(nodeData);
  const variableDisplayName =
    nodeData.variableId
      ? variables.find((variable) => variable.id === nodeData.variableId)?.name ?? 'Variable'
      : 'Variable';
  const functionDisplayName =
    nodeData.functionId
      ? functions.find((func) => func.id === nodeData.functionId)?.name
        ?? pages
          .find((page) => page.id === nodeData.functionId)
          ?.nodes.find((node) => node.data.type === BTNodeType.ROOT)?.data.label
        ?? nodeData.label
        ?? 'Function'
      : nodeData.label ?? 'Function';
  const headerLabel =
    isSetVar
      ? `SET: ${variableDisplayName}`
      : isGetVar
        ? variableDisplayName
        : nodeData.type === BTNodeType.FUNCTION
          ? functionDisplayName
          : isComboShow
            ? (nodeData.label === 'ComboShow' ? 'Combo' : nodeData.label)
          : isCompare
            ? nodeData.operator ?? '<'
            : nodeData.type === BTNodeType.ACTION
              ? 'Action'
              : nodeData.label;

  // Set node inline editing
  const updateNodeData = useBTStore((s) => s.updateNodeData);
  const [localSetVal, setLocalSetVal] = useState<string | null>(null);
  const [commentTitleDraft, setCommentTitleDraft] = useState<string | null>(null);
  const commentTitleInputRef = useRef<HTMLTextAreaElement>(null);
  const shouldSelectCommentTitleRef = useRef(false);
  const handledCommentTitleEditNonceRef = useRef<number | null>(null);
  const displaySetVal = localSetVal ?? nodeData.setValue ?? '';

  const commitSetValue = useCallback(() => {
    if (localSetVal !== null) {
      updateNodeData(id, { setValue: localSetVal });
      setLocalSetVal(null);
    }
  }, [id, localSetVal, updateNodeData]);

  useEffect(() => {
    const requestNonce = nodeData.commentTitleEditRequestNonce;
    if (!isComment || requestNonce == null || handledCommentTitleEditNonceRef.current === requestNonce) return;
    handledCommentTitleEditNonceRef.current = requestNonce;
    shouldSelectCommentTitleRef.current = true;
    setCommentTitleDraft(nodeData.label || 'Comment');
    nodeData.onCommentTitleEditStarted?.();
  }, [isComment, nodeData.commentTitleEditRequestNonce, nodeData.label, nodeData]);

  useEffect(() => {
    if (commentTitleDraft === null || !shouldSelectCommentTitleRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      commentTitleInputRef.current?.focus();
      commentTitleInputRef.current?.select();
    });
    shouldSelectCommentTitleRef.current = false;
    return () => window.cancelAnimationFrame(frame);
  }, [commentTitleDraft]);

  // Command/Ctrl + click handle → disconnect
  const handleClick = useCallback((e: React.MouseEvent, handleId?: string) => {
    if (isReadonly) return;
    if (!e.metaKey && !e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const state = useBTStore.getState();
    const isHandleEdge = (edge: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) =>
      (edge.source === id && (edge.sourceHandle ?? undefined) === handleId) ||
      (edge.target === id && (edge.targetHandle ?? undefined) === handleId);

    if (state.activePageId === 'main') {
      state.edges.filter(isHandleEdge).forEach((edge) => state.removeEdge(edge.id));
      return;
    }

    const page = state.pages.find((p) => p.id === state.activePageId);
    if (page) {
      page.edges.filter(isHandleEdge).forEach((edge) => state.removePageEdge(page.id, edge.id));
      return;
    }

    const func = state.functions.find((f) => f.id === state.activePageId);
    func?.edges.filter(isHandleEdge).forEach((edge) => state.removeFunctionEdge(func.id, edge.id));
  }, [id, isReadonly]);

  // ── Comment node: simple styled box ──
  if (isComment) {
    const w = nodeData.commentWidth ?? 300;
    const h = nodeData.commentHeight ?? 150;
    const isEditingCommentTitle = commentTitleDraft !== null;
    const commitCommentTitle = () => {
      if (commentTitleDraft === null) return;
      updateNodeData(id, { label: commentTitleDraft.trim() || 'Comment' });
      setCommentTitleDraft(null);
    };

    const handleResizeStart = (e: React.MouseEvent, direction: CommentResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();
      if (isReadonly) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = w;
      const startH = h;
      const state = useBTStore.getState();
      const activePageId = state.activePageId;
      const page = activePageId === 'main' ? undefined : state.pages.find((p) => p.id === activePageId);
      const func = activePageId === 'main' || page ? undefined : state.functions.find((f) => f.id === activePageId);
      const currentNode = activePageId === 'main'
        ? state.nodes.find((node) => node.id === id)
        : page?.nodes.find((node) => node.id === id) ?? func?.nodes.find((node) => node.id === id);
      const startPosition = currentNode?.position;
      const minW = 200;
      const minH = 80;

      const updateCommentPosition = (position: { x: number; y: number }) => {
        const latestState = useBTStore.getState();
        if (activePageId === 'main') {
          latestState.updateNodePosition(id, position);
          return;
        }
        if (page) {
          latestState.updatePageNodePosition(activePageId, id, position);
          return;
        }
        if (func) {
          latestState.updateFunctionNodePosition(activePageId, id, position);
        }
      };

      const onMove = (ev: MouseEvent) => {
        const zoom = reactFlow.getZoom() || 1;
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        const nextWidth = direction === 'left' ? Math.max(minW, startW - dx)
          : direction === 'right' ? Math.max(minW, startW + dx)
            : startW;
        const nextHeight = direction === 'top' ? Math.max(minH, startH - dy)
          : direction === 'bottom' ? Math.max(minH, startH + dy)
            : startH;

        updateNodeData(id, {
          commentWidth: nextWidth,
          commentHeight: nextHeight,
        });
        if (startPosition && (direction === 'left' || direction === 'top')) {
          updateCommentPosition({
            x: direction === 'left' ? startPosition.x + (startW - nextWidth) : startPosition.x,
            y: direction === 'top' ? startPosition.y + (startH - nextHeight) : startPosition.y,
          });
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    return (
      <div
        className={`bt-comment ${selected ? 'bt-comment-selected' : ''}`}
        style={{ width: w, height: h }}
      >
        {isEditingCommentTitle ? (
          <textarea
            ref={commentTitleInputRef}
            className="bt-comment-title-input"
            value={commentTitleDraft}
            disabled={isReadonly}
            autoFocus
            onChange={(e) => setCommentTitleDraft(e.target.value)}
            onBlur={commitCommentTitle}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setCommentTitleDraft(null);
              }
            }}
          />
        ) : (
          <div
            className="bt-comment-title bt-comment-title-bar"
            onClick={(e) => {
              e.stopPropagation();
              (nodeData as BTNodeData & { onCommentTitleSelect?: () => void }).onCommentTitleSelect?.();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isReadonly) return;
              shouldSelectCommentTitleRef.current = true;
              setCommentTitleDraft(nodeData.label || 'Comment');
            }}
          >
            {nodeData.label || 'Comment'}
          </div>
        )}
        <div
          className="bt-comment-resize-edge bt-comment-resize-edge-top"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />
        <div
          className="bt-comment-resize-edge bt-comment-resize-edge-right"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        <div
          className="bt-comment-resize-edge bt-comment-resize-edge-bottom"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        <div
          className="bt-comment-resize-edge bt-comment-resize-edge-left"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
      </div>
    );
  }

  if (isCompare) {
    const operator = nodeData.operator ?? '<';
    const hasLeftInput = edges.some((edge) => edge.target === id && edge.targetHandle === 'data-in-a');
    const hasRightInput = edges.some((edge) => edge.target === id && edge.targetHandle === 'data-in-b');
    return (
      <div
        className={`bt-node bt-compare-node ${selected ? 'selected' : ''}`}
        style={{ borderColor }}
      >
        <div className="bt-compare-pin-row">
          <Handle
            type="target"
            position={Position.Left}
            id="data-in-a"
            className="bt-handle bt-handle-data bt-compare-pin bt-compare-pin-left"
            onClick={(e) => handleClick(e, 'data-in-a')}
          />
          {!hasLeftInput && (
            <input
              className="bt-compare-value-input"
              type="text"
              value={nodeData.compareLeftValue ?? '0'}
              disabled={isReadonly}
              onChange={(e) => updateNodeData(id, { compareLeftValue: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
        <div className="bt-compare-center">
          <span className="bt-compare-op">{operator}</span>
          <Handle
            type="source"
            position={Position.Right}
            id="data-out"
            className="bt-handle bt-handle-data bt-compare-pin bt-compare-pin-right"
            onClick={(e) => handleClick(e, 'data-out')}
          />
        </div>
        <div className="bt-compare-pin-row">
          <Handle
            type="target"
            position={Position.Left}
            id="data-in-b"
            className="bt-handle bt-handle-data bt-compare-pin bt-compare-pin-left"
            onClick={(e) => handleClick(e, 'data-in-b')}
          />
          {!hasRightInput && (
            <input
              className="bt-compare-value-input"
              type="text"
              value={nodeData.compareValue ?? '0'}
              disabled={isReadonly}
              onChange={(e) => updateNodeData(id, { compareValue: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bt-node ${nodeData.type === BTNodeType.TEST ? 'bt-node-test' : ''} ${isApproach ? 'bt-node-approach' : ''} ${selected ? 'selected' : ''}`}
      style={{
        borderColor,
        borderRadius: '6px',
        minWidth: isComboDisplay ? 250 : isComboShow ? 130 : isApproach ? 180 : isMultiOutputSelector ? 150 : isGetVar ? 80 : isCompare ? 70 : isSetVar ? 100 : isCondition ? 140 : isLeaf ? 100 : 130,
        background: nodeData.type === BTNodeType.ROOT ? '#484850' : '#484848',
      }}
    >
      {/* ── Header bar ── */}
        <div
          className={`bt-node-header ${isComboShow ? 'bt-node-header-has-action' : ''}`}
          style={{ background: config.color }}
        >
        <span className={`bt-node-header-text ${isGetVar ? 'bt-node-header-text-get' : ''}`}>
          {nodeData.type !== BTNodeType.ROOT && <span className="bt-node-header-icon">{config.icon}</span>}
          {headerLabel}
        </span>

        {isComboShow && (
          <button
            type="button"
            className="bt-combo-expand-btn nodrag nopan"
            title="展开对应页面"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              nodeData.onComboTitleClick?.();
            }}
          >
            <span className="bt-combo-expand-icon">›</span>
            展开
          </button>
        )}

        {/* Get red data output */}
        {isGetVar && (
          <Handle type="source" position={Position.Right} id="data-out" className="bt-handle bt-handle-data bt-hdr-handle" onClick={(e) => handleClick(e, 'data-out')} />
        )}
      </div>

      {/* ── Execution row ── */}
      {!isMultiOutputSelector && !isGetVar && !isComment && !isCompare && !isDataCalcNode && (
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

      {/* ── RandomSelector body ── */}
      {isRandom && (
        <div className="bt-node-body bt-node-dist-body">
          <div className="bt-node-exec-row">
            <Handle type="target" position={Position.Left} id="exec-in" className="bt-handle bt-handle-exec-row" onClick={(e) => handleClick(e, 'exec-in')} />
          </div>
          {randomWeights.map((weight, i) => {
            const handleId = getRandomHandleId(randomWeightIds[i]);
            return (
            <div key={handleId} className="bt-node-dist-row">
              <span className="bt-node-dist-label">{weight}</span>
              <Handle type="source" position={Position.Right} id={handleId} className="bt-handle bt-handle-dist" onClick={(e) => handleClick(e, handleId)} />
            </div>
            );
          })}
        </div>
      )}

      {/* ── Regular composite/decorator body ── */}
      {(isComposite || isDecorator) && !isMultiOutputSelector && (
        <div className="bt-node-body">
          {nodeData.type === BTNodeType.REPEATER && (
            <div className="bt-node-cond">{nodeData.repeatCount === '' ? '' : `×${nodeData.repeatCount ?? 1}`}</div>
          )}
          {isSequence && (
            <div className="bt-node-cond-row bt-node-sequence-next-row">
              <span className="bt-node-branch-label">Next</span>
              <Handle type="source" position={Position.Right} id="exec-next" className="bt-handle bt-handle-row-right" onClick={(e) => handleClick(e, 'exec-next')} />
            </div>
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
                <ActionThumb
                  src={actionConfig.gifPath}
                  posterSrc={actionConfig.posterPath}
                  alt={actionConfig.actionId}
                  onPreviewClick={nodeData.onActionPreviewClick}
                />
              ) : (
                <div className="bt-action-thumb bt-action-thumb-empty">MP4</div>
              )}
              <div className="bt-action-meta">
                <div className="bt-action-id">
                  {actionConfig?.actionId ?? nodeData.actionId ?? '请选择动作'}
                </div>
                <div className="bt-action-name">
                  {actionConfig?.actionName ?? (nodeData.actionId ? '未找到对应 Action 配置' : '资源未配置')}
                </div>
              </div>
            </div>
          )}
          {nodeData.type === BTNodeType.WAIT && (
            <div className="bt-node-cond">{nodeData.duration === '' ? '' : `${nodeData.duration ?? 1000}ms`}</div>
          )}
          {nodeData.type === BTNodeType.APPROACH && (
            <div className="bt-approach-card">
              <div className="bt-approach-label">目标距离</div>
              <div className="bt-approach-value">
                <span className="bt-approach-op">≤</span>
                <span>{nodeData.approachDistance === '' ? '未设置' : nodeData.approachDistance ?? 500}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Data calculation node body ── */}
      {isDataCalcNode && (
        <div className="bt-node-body bt-distance2d-body">
          {/* Row 1: Start */}
          <div className="bt-distance2d-row">
            <input
              className="bt-distance2d-input"
              type="text"
              placeholder="0"
              value={nodeData.startValue ?? '0'}
              disabled={isReadonly}
              onChange={(e) => updateNodeData(id, { startValue: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="bt-distance2d-label">Start</span>
          </div>
          {/* Row 2: End + data out */}
          <div className="bt-distance2d-row">
            <input
              className="bt-distance2d-input"
              type="text"
              placeholder="0"
              value={nodeData.endValue ?? '0'}
              disabled={isReadonly}
              onChange={(e) => updateNodeData(id, { endValue: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="bt-distance2d-label">End</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="data-out"
            className="bt-handle bt-handle-data bt-distance2d-pin"
            onClick={(e) => handleClick(e, 'data-out')}
          />
        </div>
      )}

      {/* ── Reset/Return node — terminal, empty body ── */}
      {(isReset || isReturn) && (
        <div className="bt-node-body" />
      )}

      {/* ── Combo node — Action card without execution ports ── */}
      {isComboDisplay && (
        <div className="bt-node-body">
          <div className="bt-combo-card">
            {actionConfig?.gifPath ? (
              <ActionThumb
                src={actionConfig.gifPath}
                posterSrc={actionConfig.posterPath}
                alt={actionConfig.actionId}
                onPreviewClick={nodeData.onComboPreviewClick}
              />
            ) : (
              <div className="bt-action-thumb bt-action-thumb-empty">MP4</div>
            )}
            <div className="bt-action-meta">
              <div className="bt-action-id">
                {actionConfig?.actionId ?? nodeData.actionId ?? '请选择动作'}
              </div>
              <div className="bt-action-name">
                {actionConfig?.actionName ?? (nodeData.actionId ? '未找到对应 Action 配置' : '资源未配置')}
              </div>
            </div>
          </div>
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
            disabled={isReadonly}
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

function ActionThumb({
  src,
  posterSrc,
  alt,
  onPreviewClick,
}: {
  src: string;
  posterSrc?: string;
  alt: string;
  onPreviewClick?: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(() => posterSrc || getVideoThumbnail(src));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (posterSrc) {
      setThumbnailUrl(posterSrc);
      setFailed(false);
      return;
    }
    if (isShowcaseMode) {
      setThumbnailUrl(undefined);
      setFailed(false);
      return;
    }
    let active = true;
    setThumbnailUrl(getVideoThumbnail(src));
    setFailed(false);
    const unsubscribe = subscribeVideoThumbnails((updatedSrc) => {
      if (updatedSrc === src) {
        setThumbnailUrl(getVideoThumbnail(src));
      }
    });
    ensureVideoThumbnail(src).then((url) => {
      if (!active) return;
      if (url) setThumbnailUrl(url);
      else setFailed(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [posterSrc, src]);

  if (failed) {
    return <div className="bt-action-thumb bt-action-thumb-empty">MP4</div>;
  }

  return (
    <div className="bt-action-thumb-wrap">
      {thumbnailUrl ? (
        <img
          className="bt-action-thumb"
          src={thumbnailUrl}
          alt={alt}
          draggable={false}
          onError={() => {
            setThumbnailUrl(undefined);
            setFailed(true);
          }}
        />
      ) : (
        <div
          className="bt-action-thumb bt-action-thumb-empty bt-action-thumb-deferred"
          title={alt}
        >
          MP4
        </div>
      )}
      {onPreviewClick && (
        <button
          type="button"
          className="bt-action-play-button"
          title="播放 MP4"
          aria-label="播放 MP4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPreviewClick();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span />
        </button>
      )}
    </div>
  );
}
