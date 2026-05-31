import { useCallback, useEffect, useRef, useState } from 'react';
import { useBTStore } from '../store/useBTStore';
import { exportActionCatalogFromExcel } from '../config/actionCatalog';
import {
  openDefaultTreeFile,
  openTreeFile,
  saveDefaultTreeFile,
  saveTreeFile,
  saveTreeFileAs,
  type TreeFileHandle,
} from '../utils/filePersistence';
import { isShowcaseMode } from '../config/appMode';

const DEFAULT_FILE_NAME = 'behavior-tree.json';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TableState = 'idle' | 'exporting' | 'exported' | 'error';

export function Toolbar() {
  const exportTree = useBTStore((s) => s.exportTree);
  const importTree = useBTStore((s) => s.importTree);
  const [fileHandle, setFileHandle] = useState<TreeFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [tableState, setTableState] = useState<TableState>('idle');
  const tracksDirtyRef = useRef(false);
  const ignoreNextStoreChangeRef = useRef(false);
  const tableResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isShowcaseMode) return;
    const trackingTimer = window.setTimeout(() => {
      tracksDirtyRef.current = true;
    }, 0);

    const unsub = useBTStore.subscribe(() => {
      if (!tracksDirtyRef.current) {
        return;
      }
      if (ignoreNextStoreChangeRef.current) {
        ignoreNextStoreChangeRef.current = false;
        return;
      }
      setIsDirty(true);
      setSaveState('idle');
    });
    return () => {
      window.clearTimeout(trackingTimer);
      unsub();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tableResetTimerRef.current !== null) {
        window.clearTimeout(tableResetTimerRef.current);
      }
    };
  }, []);

  const currentFileName = fileName ?? DEFAULT_FILE_NAME;

  const handleSaveAs = useCallback(async () => {
    const json = exportTree();
    setSaveState('saving');
    try {
      const result = await saveTreeFileAs(json, currentFileName);
      setFileHandle(result.handle ?? null);
      setFileName(result.name);
      setLocalFilePath(null);
      setIsDirty(false);
      setSaveState('saved');
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        console.error('Failed to save tree:', error);
        setSaveState('error');
      } else {
        setSaveState('idle');
      }
    }
  }, [currentFileName, exportTree]);

  const handleSave = useCallback(async () => {
    if (!fileHandle) {
      const json = exportTree();
      setSaveState('saving');
      try {
        const result = await saveDefaultTreeFile(json);
        setFileName(result.name);
        setLocalFilePath(result.path);
        setIsDirty(false);
        setSaveState('saved');
      } catch (error) {
        console.warn('Default file save failed, falling back to Save As:', error);
        await handleSaveAs();
      }
      return;
    }

    const json = exportTree();
    setSaveState('saving');
    try {
      await saveTreeFile(fileHandle, json);
      setIsDirty(false);
      setSaveState('saved');
    } catch (error) {
      if (isAbortError(error)) {
        setSaveState('idle');
        return;
      }

      console.warn('Bound file save failed, falling back to Save As:', error);
      setFileHandle(null);
      await handleSaveAs();
    }
  }, [exportTree, fileHandle, handleSaveAs]);

  const handleOpenDefault = async () => {
    try {
      const result = await openDefaultTreeFile();
      ignoreNextStoreChangeRef.current = true;
      importTree(result.json);
      setFileHandle(null);
      setFileName(result.name);
      setLocalFilePath(result.path);
      setIsDirty(false);
      setSaveState('saved');
    } catch (error) {
      console.error('Failed to open default tree:', error);
      setSaveState('error');
    }
  };

  const handleOpen = async () => {
    try {
      const result = await openTreeFile();
      ignoreNextStoreChangeRef.current = true;
      importTree(result.json);
      setFileHandle(result.handle ?? null);
      setFileName(result.name);
      setLocalFilePath(null);
      setIsDirty(false);
      setSaveState('saved');
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        console.error('Failed to open tree:', error);
        setSaveState('error');
      }
    }
  };

  const handleExportActions = async () => {
    if (tableResetTimerRef.current !== null) {
      window.clearTimeout(tableResetTimerRef.current);
      tableResetTimerRef.current = null;
    }
    setTableState('exporting');
    try {
      const result = await exportActionCatalogFromExcel();
      console.info(`Action 导表完成: ${result.source} -> ${result.target}, ${result.count} rows`);
      setTableState('exported');
      tableResetTimerRef.current = window.setTimeout(() => {
        setTableState('idle');
        tableResetTimerRef.current = null;
      }, 2400);
    } catch (error) {
      console.error('Action 导表失败:', error);
      setTableState('error');
    }
  };

  useEffect(() => {
    if (isShowcaseMode) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      void handleSave();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const saveLabel = saveState === 'saving' ? '保存中' : '保存';
  const statusText =
    saveState === 'saving'
      ? '保存中...'
      : saveState === 'saved'
        ? '已保存'
        : saveState === 'error'
          ? '保存失败'
          : fileHandle
            ? '已绑定文件'
            : localFilePath
              ? '已绑定默认文件'
              : '保存到默认文件';
  const tableLabel =
    tableState === 'exporting'
      ? '导表中'
      : tableState === 'exported'
        ? '导表完成'
        : tableState === 'error'
          ? '导表失败'
        : '导表';

  if (isShowcaseMode) {
    return (
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="toolbar-title">Astaroth AI Behavior Tree</span>
          <span className="toolbar-file" title="展示模式会加载已发布的电龙AI.json">
            展示模式
          </span>
          <span className="toolbar-save-status">只读浏览</span>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Behavior Tree Editor</span>
        <span className="toolbar-file" title={localFilePath ?? (fileHandle ? '已绑定到本地 JSON 文件' : '未绑定文件，保存会写入开发服务器默认 JSON')}>
          {currentFileName}
          {isDirty ? ' *' : ''}
        </span>
        <span className={`toolbar-save-status toolbar-save-status-${saveState}`}>
          {statusText}
        </span>
      </div>

      <div className="toolbar-right" style={{ marginLeft: 'auto' }}>
        <button className="btn btn-secondary toolbar-btn" onClick={handleOpenDefault}>
          <span className="toolbar-btn-icon">⌂</span>
          <span>打开默认</span>
        </button>
        <button className="btn btn-secondary toolbar-btn" onClick={handleOpen}>
          <span className="toolbar-btn-icon">📂</span>
          <span>打开</span>
        </button>
        <button
          className="btn btn-secondary toolbar-btn"
          onClick={handleExportActions}
          disabled={tableState === 'exporting'}
          title="将 public/config/Actions.xlsx 导出为 Actions.json"
        >
          <span className="toolbar-btn-icon">⇄</span>
          <span>{tableLabel}</span>
        </button>
        <button className="btn btn-primary toolbar-btn" onClick={handleSave} disabled={saveState === 'saving'}>
          <span className="toolbar-btn-icon">💾</span>
          <span>{saveLabel}</span>
        </button>
        <button className="btn btn-secondary toolbar-btn" onClick={handleSaveAs} disabled={saveState === 'saving'}>
          <span className="toolbar-btn-icon">↗</span>
          <span>另存为</span>
        </button>
      </div>
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
