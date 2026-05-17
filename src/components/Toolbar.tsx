import { useBTStore } from "../store/useBTStore";

export function Toolbar() {
  const exportTree = useBTStore((s) => s.exportTree);
  const importTree = useBTStore((s) => s.importTree);

  const handleExport = () => {
    const json = exportTree();
    navigator.clipboard.writeText(json).catch(() => {});
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'behavior-tree.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const json = ev.target?.result as string;
        if (json) importTree(json);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Behavior Tree Editor</span>
      </div>

      <div className="toolbar-right" style={{ marginLeft: 'auto' }}>
        <button className="btn btn-secondary toolbar-btn" onClick={handleExport}>
          <span className="toolbar-btn-icon">📤</span>
          <span>导出</span>
        </button>
        <button className="btn btn-secondary toolbar-btn" onClick={handleImport}>
          <span className="toolbar-btn-icon">📥</span>
          <span>导入</span>
        </button>
      </div>
    </div>
  );
}
