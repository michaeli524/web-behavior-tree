import { useState } from 'react';
import { useBTStore } from '../store/useBTStore';
import type { BTVariable } from '../engine/types';

export function VariablePanel() {
  const variables = useBTStore((s) => s.variables);
  const addVariable = useBTStore((s) => s.addVariable);
  const updateVariable = useBTStore((s) => s.updateVariable);
  const removeVariable = useBTStore((s) => s.removeVariable);

  const [tab, setTab] = useState<'variables' | 'functions'>('variables');
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<BTVariable['type']>('boolean');
  const [newVarValue, setNewVarValue] = useState('false');

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    let value: boolean | number | string = newVarValue;
    if (newVarType === 'boolean') value = newVarValue === 'true';
    if (newVarType === 'number') value = Number(newVarValue);
    addVariable(newVarName, newVarType, value);
    setNewVarName('');
    setNewVarValue(newVarType === 'boolean' ? 'false' : newVarType === 'number' ? '0' : '');
  };

  const handleUpdateValue = (id: string, rawValue: string) => {
    const v = variables.find((v) => v.id === id);
    if (!v) return;
    let value: boolean | number | string = rawValue;
    if (v.type === 'boolean') value = rawValue === 'true';
    if (v.type === 'number') value = Number(rawValue);
    updateVariable(id, { value });
  };

  return (
    <div className="variable-panel">
      <h3>变量面板</h3>

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
          <div className="var-add">
            <input
              type="text"
              placeholder="变量名"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
            />
            <select
              value={newVarType}
              onChange={(e) => {
                const t = e.target.value as BTVariable['type'];
                setNewVarType(t);
                setNewVarValue(t === 'boolean' ? 'false' : t === 'number' ? '0' : '');
              }}
            >
              <option value="boolean">Boolean</option>
              <option value="number">Number</option>
              <option value="string">String</option>
            </select>
            <input
              type={newVarType === 'number' ? 'number' : 'text'}
              placeholder="值"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddVariable}>
              +
            </button>
          </div>

          <div className="var-list">
            {variables.map((v) => (
              <div key={v.id} className="var-item">
                <span className="var-name">{v.name}</span>
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
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => removeVariable(v.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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
  const [newFuncName, setNewFuncName] = useState('');

  const handleAdd = () => {
    if (!newFuncName.trim()) return;
    addFunction(newFuncName, '// 编写JavaScript代码\nreturn true;');
    setNewFuncName('');
  };

  return (
    <div className="var-section">
      <div className="var-add">
        <input
          type="text"
          placeholder="函数名"
          value={newFuncName}
          onChange={(e) => setNewFuncName(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          +
        </button>
      </div>

      <div className="var-list">
        {functions.map((f) => (
          <div key={f.id} className="func-item">
            <div className="func-header">
              <span className="func-name">{f.name}</span>
              <button
                className="btn btn-small btn-danger"
                onClick={() => removeFunction(f.id)}
              >
                ×
              </button>
            </div>
            <textarea
              rows={4}
              value={f.body}
              onChange={(e) => updateFunction(f.id, { body: e.target.value })}
              placeholder="// 编写JavaScript代码"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
