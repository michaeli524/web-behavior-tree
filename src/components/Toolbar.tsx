import { useCallback, useRef, useState } from 'react';
import { useBTStore } from '../store/useBTStore';
import { BehaviorTreeEngine } from '../engine/BehaviorTreeEngine';
import { BTExecutionStatus } from '../engine/types';

export function Toolbar() {
  const nodes = useBTStore((s) => s.nodes);
  const edges = useBTStore((s) => s.edges);
  const variables = useBTStore((s) => s.variables);
  const functions = useBTStore((s) => s.functions);
  const isRunning = useBTStore((s) => s.isRunning);
  const setRunning = useBTStore((s) => s.setRunning);
  const setExecutionResult = useBTStore((s) => s.setExecutionResult);
  const resetExecution = useBTStore((s) => s.resetExecution);
  const exportTree = useBTStore((s) => s.exportTree);
  const importTree = useBTStore((s) => s.importTree);
  const clearAll = useBTStore((s) => s.clearAll);

  const engineRef = useRef<BehaviorTreeEngine>(new BehaviorTreeEngine());
  const [engineLog, setEngineLog] = useState<string[]>([]);

  const handleRun = useCallback(() => {
    resetExecution();
    setEngineLog([]);

    const engine = engineRef.current;
    engine.load(nodes, edges, variables, functions);
    engine.onTick((nodeId, status) => {
      setExecutionResult(nodeId, status);
    });

    setRunning(true);

    // Use requestAnimationFrame for visual feedback, then complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { rootStatus, results } = engine.tick();
        const logLines: string[] = [];
        results.forEach((status, nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          const label = node?.data.label ?? nodeId;
          logLines.push(`[${label}] → ${status}`);
        });
        logLines.push(`--- Root: ${rootStatus} ---`);
        setEngineLog(logLines);
        setRunning(false);
      });
    });
  }, [nodes, edges, variables, functions, resetExecution, setExecutionResult, setRunning]);

  const handleReset = useCallback(() => {
    resetExecution();
    setEngineLog([]);
  }, [resetExecution]);

  const handleExport = () => {
    const json = exportTree();
    navigator.clipboard.writeText(json).then(() => {
      alert('行为树JSON已复制到剪贴板');
    });
  };

  const handleImport = () => {
    const json = prompt('粘贴行为树JSON:');
    if (json) {
      importTree(json);
    }
  };

  const handleClear = () => {
    if (confirm('确定要清空所有节点吗？此操作不可撤销。')) {
      clearAll();
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Web Behavior Tree</span>
        <span className="toolbar-subtitle">行为树可视化编辑器</span>
      </div>

      <div className="toolbar-center">
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? '⏳ 运行中...' : '▶ 运行'}
        </button>
        <button className="btn btn-secondary" onClick={handleReset}>
          ↺ 重置
        </button>
      </div>

      <div className="toolbar-right">
        <button className="btn btn-secondary" onClick={handleExport}>
          📋 导出
        </button>
        <button className="btn btn-secondary" onClick={handleImport}>
          📥 导入
        </button>
        <button className="btn btn-secondary" onClick={handleClear}>
          🗑 清空
        </button>
      </div>

      {engineLog.length > 0 && (
        <div className="engine-log">
          {engineLog.map((line, i) => (
            <div
              key={i}
              className={`log-line ${line.startsWith('---') ? 'log-summary' : ''}`}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
