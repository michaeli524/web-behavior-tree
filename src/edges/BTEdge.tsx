import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function BTEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#6366f1' : '#475569',
        strokeWidth: selected ? 3 : 2,
      }}
    />
  );
}
