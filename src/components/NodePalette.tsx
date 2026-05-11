import { type DragEvent } from 'react';
import { BTNodeType } from '../engine/types';

interface NodeTemplate {
  type: BTNodeType;
  label: string;
  category: string;
  icon: string;
}

const nodeTemplates: NodeTemplate[] = [
  { type: BTNodeType.ROOT, label: 'Root', category: 'Core', icon: '🏠' },
  { type: BTNodeType.SELECTOR, label: 'Selector', category: 'Composite', icon: '❓' },
  { type: BTNodeType.SEQUENCE, label: 'Sequence', category: 'Composite', icon: '→' },
  { type: BTNodeType.PARALLEL, label: 'Parallel', category: 'Composite', icon: '⇉' },
  { type: BTNodeType.CONDITION, label: 'Condition', category: 'Decorator', icon: '◆' },
  { type: BTNodeType.INVERTER, label: 'Inverter', category: 'Decorator', icon: '¬' },
  { type: BTNodeType.REPEATER, label: 'Repeater', category: 'Decorator', icon: '↻' },
  { type: BTNodeType.SUCCEEDER, label: 'Succeeder', category: 'Decorator', icon: '✓' },
  { type: BTNodeType.ACTION, label: 'Action', category: 'Leaf', icon: '⚡' },
  { type: BTNodeType.WAIT, label: 'Wait', category: 'Leaf', icon: '⏱' },
];

const categoryOrder = ['Core', 'Composite', 'Decorator', 'Leaf'];

export function NodePalette() {
  const onDragStart = (event: DragEvent, nodeType: BTNodeType) => {
    event.dataTransfer.setData('application/node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const grouped = new Map<string, NodeTemplate[]>();
  categoryOrder.forEach((cat) => grouped.set(cat, []));
  nodeTemplates.forEach((t) => {
    const arr = grouped.get(t.category) ?? [];
    arr.push(t);
    if (!grouped.has(t.category)) grouped.set(t.category, arr);
  });

  return (
    <div className="node-palette">
      <h3>节点面板</h3>
      {categoryOrder.map((category) => {
        const items = grouped.get(category);
        if (!items || items.length === 0) return null;
        return (
          <div key={category} className="palette-category">
            <div className="palette-cat-title">{category}</div>
            {items.map((t) => (
              <div
                key={t.type}
                className="palette-item"
                draggable
                onDragStart={(e) => onDragStart(e, t.type)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
