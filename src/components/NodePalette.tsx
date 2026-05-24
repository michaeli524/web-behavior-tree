import { useState, useEffect, useRef } from 'react';
import { useBTStore } from '../store/useBTStore';
import { BTNodeType } from '../engine/types';
import type { BTVariable } from '../engine/types';

interface Props {
  width: number;
  onToggleCollapse: () => void;
}

export function NodePalette({ width, onToggleCollapse }: Props) {
  const pages = useBTStore((s) => s.pages);
  const mainPageName = useBTStore((s) => s.mainPageName);
  const activePageId = useBTStore((s) => s.activePageId);
  const setActivePageId = useBTStore((s) => s.setActivePageId);
  const addPage = useBTStore((s) => s.addPage);
  const renamePage = useBTStore((s) => s.renamePage);
  const deletePage = useBTStore((s) => s.deletePage);

  const [splitRatio, setSplitRatio] = useState(0.35);
  const paletteRef = useRef<HTMLDivElement>(null);
  const splitDragging = useRef(false);
  const [contextPageId, setContextPageId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [bottomTab, setBottomTab] = useState<'variables' | 'functions'>('variables');

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !paletteRef.current) return;
      const rect = paletteRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setSplitRatio(Math.min(0.7, Math.max(0.15, y / rect.height)));
    };
    const onMouseUp = () => { splitDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const closeContextMenu = () => { setContextPageId(null); setContextMenuPos(null); };
  const handleRenameStart = (pageId: string, currentName: string) => {
    setRenamingPageId(pageId);
    setRenameValue(currentName);
    closeContextMenu();
  };
  const handleRenameConfirm = () => {
    if (renamingPageId && renameValue.trim()) renamePage(renamingPageId, renameValue.trim());
    setRenamingPageId(null);
    setRenameValue('');
  };

  const pageList = [
    { id: 'main', name: mainPageName, nodeCount: useBTStore.getState().nodes.length },
    ...pages.map((p) => ({ id: p.id, name: p.name, nodeCount: p.nodes.length })),
  ];

  return (
    <div className="node-palette" style={{ width }} ref={paletteRef}>
      {/* Top: Pages */}
      <div className="palette-top-section" style={{ height: `${splitRatio * 100}%` }}>
        <div className="palette-header">
          <span className="palette-section-title">页面</span>
          <div className="palette-header-actions">
            <button className="btn btn-primary func-add-btn" onClick={() => addPage('New Page')} title="新增页面">+</button>
            <button className="palette-collapse-btn" onClick={onToggleCollapse} title="收起面版">
              <span className="palette-collapse-icon">◀</span>
            </button>
          </div>
        </div>
        <div className="page-list">
          {pageList.map((page) => (
            <div
              key={page.id}
              className={`page-item ${activePageId === page.id ? 'active' : ''}`}
              onClick={() => setActivePageId(page.id)}
              onContextMenu={(e) => { e.preventDefault(); setContextPageId(page.id); setContextMenuPos({ x: e.clientX, y: e.clientY }); }}
              onDoubleClick={() => handleRenameStart(page.id, page.name)}
              draggable={page.id !== 'main' && page.id !== activePageId}
              onDragStart={(e) => {
                if (page.id === 'main' || page.id === activePageId) { e.preventDefault(); return; }
                e.dataTransfer.setData('application/node-type', BTNodeType.FUNCTION);
                e.dataTransfer.setData('application/function-id', page.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              {renamingPageId === page.id ? (
                <input className="page-rename-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') { setRenamingPageId(null); setRenameValue(''); } }}
                  autoFocus onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="page-icon">{page.id === 'main' ? '🏠' : '📄'}</span>
                  <span className="page-name">{page.name}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Split */}
      <div className="palette-split-handle" onMouseDown={(e) => { e.preventDefault(); splitDragging.current = true; }} />

      {/* Bottom: Variables / Functions */}
      <div className="palette-bottom-section">
        <div className="palette-header palette-templates-header">
          <div className="panel-tabs" style={{ margin: 0, flex: 1 }}>
            <button className={bottomTab === 'variables' ? 'active' : ''} onClick={() => setBottomTab('variables')}>变量</button>
            <button className={bottomTab === 'functions' ? 'active' : ''} onClick={() => setBottomTab('functions')}>函数</button>
          </div>
        </div>
        <div className="palette-bottom-content">
          {bottomTab === 'variables' ? <VariableList /> : <FunctionList />}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuPos && contextPageId && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
          <div className="context-menu" style={{ left: contextMenuPos.x, top: contextMenuPos.y }}>
            <button onClick={() => handleRenameStart(contextPageId, pageList.find(p => p.id === contextPageId)?.name ?? '')}>重命名</button>
            {contextPageId !== 'main' && (
              <button className="danger" onClick={() => { deletePage(contextPageId); closeContextMenu(); }}>删除页面</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Variable List ──
function VariableList() {
  const variables = useBTStore((s) => s.variables);
  const addVariable = useBTStore((s) => s.addVariable);
  const updateVariable = useBTStore((s) => s.updateVariable);
  const removeVariable = useBTStore((s) => s.removeVariable);
  const selectedVariableId = useBTStore((s) => s.selectedVariableId);
  const setSelectedVariableId = useBTStore((s) => s.setSelectedVariableId);
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; varId: string } | null>(null);

  const handleAdd = () => {
    addVariable('newVar', 'boolean', false);
    const state = useBTStore.getState();
    const v = state.variables[state.variables.length - 1];
    if (v) { setRenaming(v.id); setRenameVal('newVar'); }
    setSearch('');
  };

  const commitRename = (id: string) => {
    if (renameVal.trim()) updateVariable(id, { name: renameVal.trim() });
    setRenaming(null); setRenameVal('');
  };

  const filtered = variables.filter((v) => !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="palette-list-section">
      <div className="func-search-row">
        <input type="text" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} className="func-search-input" />
        <button className="btn btn-primary func-add-btn" onClick={handleAdd}>+</button>
      </div>
      <div className="var-list">
        {filtered.map((v) => (
          <div key={v.id}
            className={`var-item ${selectedVariableId === v.id ? 'var-item-active' : ''}`}
            draggable
            onClick={() => setSelectedVariableId(v.id)}
            onDragStart={(e) => { e.dataTransfer.setData('application/variable-id', v.id); e.dataTransfer.effectAllowed = 'move'; }}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, varId: v.id }); }}
          >
            {renaming === v.id ? (
              <input className="func-rename-input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => commitRename(v.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(v.id); if (e.key === 'Escape') { setRenaming(null); setRenameVal(''); } }}
                autoFocus onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="var-name" onDoubleClick={() => { setRenaming(v.id); setRenameVal(v.name); }}>{v.name}</span>
            )}
            <div className="var-type-group">
              <span className={`var-type-dot dot-${v.type}`} />
              <select
                className="var-type-select"
                value={v.type}
                onChange={(e) => updateVariable(v.id, { type: e.target.value as BTVariable['type'] })}
              >
              <option value="boolean">Boolean</option>
              <option value="number">Number</option>
              <option value="string">String</option>
            </select>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="func-empty">无匹配</div>}
      </div>
      {ctxMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <button onClick={() => { const v = variables.find((vr) => vr.id === ctxMenu.varId); if (v) { setRenaming(v.id); setRenameVal(v.name); } setCtxMenu(null); }}>重命名</button>
            <button className="danger" onClick={() => { removeVariable(ctxMenu.varId); setCtxMenu(null); }}>删除</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Function List ──
function FunctionList() {
  const functions = useBTStore((s) => s.functions);
  const addFunction = useBTStore((s) => s.addFunction);
  const updateFunction = useBTStore((s) => s.updateFunction);
  const removeFunction = useBTStore((s) => s.removeFunction);
  const setActivePageId = useBTStore((s) => s.setActivePageId);
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; funcId: string } | null>(null);

  const handleAdd = () => {
    const newId = addFunction('New Function');
    setRenaming(newId); setRenameVal('New Function'); setSearch('');
  };

  const commitRename = () => {
    if (renaming && renameVal.trim()) updateFunction(renaming, { name: renameVal.trim() });
    setRenaming(null); setRenameVal('');
  };

  const filtered = functions.filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="palette-list-section">
      <div className="func-search-row">
        <input type="text" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} className="func-search-input" />
        <button className="btn btn-primary func-add-btn" onClick={handleAdd}>+</button>
      </div>
      <div className="var-list">
        {filtered.map((f) => (
          <div key={f.id} className="func-item"
            onClick={() => setActivePageId(f.id)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, funcId: f.id }); }}
          >
            {renaming === f.id ? (
              <input className="func-rename-input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(null); setRenameVal(''); } }}
                autoFocus onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="func-name">📄 {f.name}</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="func-empty">无匹配</div>}
      </div>
      {ctxMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <button onClick={() => { const f = functions.find((fn) => fn.id === ctxMenu.funcId); if (f) { setRenaming(f.id); setRenameVal(f.name); } setCtxMenu(null); }}>重命名</button>
            <button className="danger" onClick={() => { removeFunction(ctxMenu.funcId); setCtxMenu(null); }}>删除</button>
          </div>
        </>
      )}
    </div>
  );
}
