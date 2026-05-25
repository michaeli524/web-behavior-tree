import { useBTStore } from '../store/useBTStore';

export function VariableDetail() {
  const variables = useBTStore((s) => s.variables);
  const selectedId = useBTStore((s) => s.selectedVariableId);
  const updateVariable = useBTStore((s) => s.updateVariable);
  const setSelectedVariableId = useBTStore((s) => s.setSelectedVariableId);

  const variable = variables.find((v) => v.id === selectedId);
  if (!variable) return null;

  return (
    <div className="variable-detail">
      <div className="var-detail-header">
        <h3>变量详情</h3>
        <button
          className="btn btn-small"
          onClick={() => setSelectedVariableId(null)}
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3, padding: '2px 6px', fontSize: 14 }}
        >
          ×
        </button>
      </div>

      <div className="prop-group">
        <label>变量名</label>
        <input
          type="text"
          value={variable.name}
          onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
        />
      </div>

      <div className="prop-group">
        <label>数据类型</label>
        <select
          value={variable.type}
          onChange={(e) => {
            const newType = e.target.value as 'boolean' | 'number' | 'string';
            let newValue: boolean | number | string;
            if (newType === 'boolean') newValue = false;
            else if (newType === 'number') newValue = 0;
            else newValue = '';
            updateVariable(variable.id, { type: newType, value: newValue });
          }}
        >
          <option value="boolean">Boolean</option>
          <option value="number">Number</option>
          <option value="string">String</option>
        </select>
      </div>

      <div className="prop-group">
        <label>默认值</label>
        {variable.type === 'boolean' ? (
          <select
            value={String(variable.value)}
            onChange={(e) => updateVariable(variable.id, { value: e.target.value === 'true' })}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={variable.type === 'number' ? 'number' : 'text'}
            value={String(variable.value)}
            onChange={(e) => {
              let val: boolean | number | string = e.target.value;
              if (variable.type === 'number') val = Number(e.target.value);
              updateVariable(variable.id, { value: val });
            }}
          />
        )}
      </div>

      <div className="prop-group">
        <label>注释</label>
        <textarea
          rows={4}
          placeholder="变量说明..."
          value={variable.note ?? ''}
          onChange={(e) => updateVariable(variable.id, { note: e.target.value })}
        />
      </div>
    </div>
  );
}
