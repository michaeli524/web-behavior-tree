import { useState } from 'react';
import { useBTStore } from '../store/useBTStore';
import type { BTVariable, BTNodeType } from '../engine/types';

export function VariablePanel() {
  const variables = useBTStore((s) => s.variables);
  const addVariable = useBTStore((s) => s.addVariable);
  const updateVariable = useBTStore((s) => s.updateVariable);
  const removeVariable = useBTStore((s) => s.removeVariable);

  const [tab, setTab] = useState<'variables' | 'functions'>('variables');
  const [varSearch, setVarSearch] = useState('');
  const [varRenaming, setVarRenaming] = useState<string | null>(null);
  const [varRenameVal, setVarRenameVal] = useState('');

  const handleAddVariable = () => {
    addVariable('newVar', 'number', 0);
    const state = useBTStore.getState();
    const newVar = state.variables[state.variables.length - 1];
    if (newVar) {
      setVarRenaming(newVar.id);
      setVarRenameVal('newVar');
    }
    setVarSearch('');
  };

  const commitVarRename = (id: string) => {
    if (varRenameVal.trim()) {
      updateVariable(id, { name: varRenameVal.trim() });
    }
    setVarRenaming(null);
    setVarRenameVal('');
  };

  const handleUpdateValue = (id: string, rawValue: string) => {
    const v = variables.find((v) => v.id === id);
    if (!v) return;
    let value: boolean | number | string = rawValue;
    if (v.type === 'boolean') value = rawValue === 'true';
    if (v.type === 'number') value = Number(rawValue);
    updateVariable(id, { value });
  };

  const [varCtxMenu, setVarCtxMenu] = useState<{ x: number; y: number; varId: string } | null>(null);

  const filteredVars = variables.filter((v) =>
    !varSearch.trim() || v.name.toLowerCase().includes(varSearch.toLowerCase())
  );

  return (
    <div className="variable-panel">
      <div className="panel-tabs">
        <button
          className={tab === 'variables' ? 'active' : ''}
          onClick={() => setTab('variables')}
        >
          变量
        </button>
        <button
          className={tab === 'functions' ? 'active' : ''}
          onClick={() => setTab('functions')}
        >
          函数
        </button>
      </div>

      {tab === 'variables' && (
        <div className="var-section">
          <div className="func-search-row">
            <input
              type="text"
              placeholder="搜索变量..."
              value={varSearch}
              onChange={(e) => setVarSearch(e.target.value)}
              className="func-search-input"
            />
            <button className="btn btn-primary func-add-btn" onClick={handleAddVariable} title="新建变量">
              +
            </button>
          </div>

          <div className="var-list">
            {filteredVars.map((v) => (
              <div
                key={v.id}
                className="var-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/variable-id', v.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setVarCtxMenu({ x: e.clientX, y: e.clientY, varId: v.id });
                }}
                onDoubleClick={() => { setVarRenaming(v.id); setVarRenameVal(v.name); }}
              >
                {varRenaming === v.id ? (
                  <input
                    className="func-rename-input"
                    value={varRenameVal}
                    onChange={(e) => setVarRenameVal(e.target.value)}
                    onBlur={() => commitVarRename(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitVarRename(v.id);
                      if (e.key === 'Escape') { setVarRenaming(null); setVarRenameVal(''); }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="var-name">{v.name}</span>
                )}
                <span className="var-type">({v.type})</span>
                {v.type === 'boolean' ? (
                  <select
                    value={String(v.value)}
                    onChange={(e) => handleUpdateValue(v.id, e.target.value)}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={v.type === 'number' ? 'number' : 'text'}
                    value={String(v.value)}
                    onChange={(e) => handleUpdateValue(v.id, e.target.value)}
                  />
                )}
              </div>
            ))}
            {filteredVars.length === 0 && (
              <div className="func-empty">无匹配变量</div>
            )}
          </div>

          {/* Variable context menu */}
          {varCtxMenu && (
            <>
              <div className="context-menu-overlay" onClick={() => setVarCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setVarCtxMenu(null); }} />
              <div className="context-menu" style={{ left: varCtxMenu.x, top: varCtxMenu.y }}>
                <button onClick={() => {
                  const v = variables.find((vr) => vr.id === varCtxMenu.varId);
                  if (v) { setVarRenaming(v.id); setVarRenameVal(v.name); }
                  setVarCtxMenu(null);
                }}>重命名</button>
                <button className="danger" onClick={() => {
                  removeVariable(varCtxMenu.varId);
                  setVarCtxMenu(null);
                }}>删除</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'functions' && (
        <FunctionSection />
      )}
    </div>
  );
}

function FunctionSection() {
  const functions = useBTStore((s) => s.functions);
  const addFunction = useBTStore((s) => s.addFunction);
  const updateFunction = useBTStore((s) => s.updateFunction);
  const removeFunction = useBTStore((s) => s.removeFunction);
  const setActivePageId = useBTStore((s) => s.setActivePageId);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; funcId: string } | null>(null);

  const handleAdd = () => {
    const newId = addFunction('New Function');
    setRenamingId(newId);
    setRenameVal('New Function');
    setSearch('');
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim()) {
      updateFunction(renamingId, { name: renameVal.trim() });
    }
    setRenamingId(null);
    setRenameVal('');
  };

  const filtered = functions.filter((f) =>
    !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="var-section">
      <div className="func-search-row">
        <input
          type="text"
          placeholder="搜索函数..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="func-search-input"
        />
        <button className="btn btn-primary func-add-btn" onClick={handleAdd} title="新建函数">
          +
        </button>
      </div>

      <div className="var-list">
        {filtered.map((f) => (
          <div
            key={f.id}
            className="func-item"
            onDoubleClick={() => setActivePageId(f.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, funcId: f.id });
            }}
          >
            {renamingId === f.id ? (
              <input
                className="func-rename-input"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setRenamingId(null); setRenameVal(''); }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="func-name">📦 {f.name}</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="func-empty">无匹配函数</div>
        )}
      </div>

      {ctxMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <button onClick={() => {
              const f = functions.find((fn) => fn.id === ctxMenu.funcId);
              if (f) { setRenamingId(f.id); setRenameVal(f.name); }
              setCtxMenu(null);
            }}>重命名</button>
            <button className="danger" onClick={() => {
              removeFunction(ctxMenu.funcId);
              setCtxMenu(null);
            }}>删除</button>
          </div>
        </>
      )}
    </div>
  );
}
