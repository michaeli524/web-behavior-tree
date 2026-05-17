import { BaseEdge, getBezierPath, getStraightPath, type EdgeProps } from '@xyflow/react';

const STRAIGHT_THRESHOLD = 2; // px — only truly horizontal edges get a straight line

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
  const yDiff = Math.abs(sourceY - targetY);
  const useStraight = yDiff <= STRAIGHT_THRESHOLD;

  const [edgePath] = useStraight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

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
