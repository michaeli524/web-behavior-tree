import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import type { BTEdgeReroutePoint } from '../engine/types';

const STRAIGHT_THRESHOLD = 2; // px - only truly horizontal edges get a straight line

type BTEdgeRenderData = {
  reroutePoints?: BTEdgeReroutePoint[];
  selectedReroutePointId?: string | null;
  onReroutePointSelect?: (edgeId: string, pointId: string) => void;
  onReroutePointMove?: (
    edgeId: string,
    pointId: string,
    position: { x: number; y: number }
  ) => void;
  onReroutePointAdd?: (edgeId: string, position: { x: number; y: number }) => void;
};

function stripMoveCommand(path: string) {
  return path.replace(/^M\s*[-\d.]+[,\s]+[-\d.]+\s*/, '');
}

function getReroutedBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: EdgeProps['sourcePosition'],
  targetPosition: EdgeProps['targetPosition'],
  points: BTEdgeReroutePoint[]
) {
  const pathPoints = [
    { x: sourceX, y: sourceY },
    ...points,
    { x: targetX, y: targetY },
  ];

  return pathPoints
    .slice(0, -1)
    .map((point, index) => {
      const nextPoint = pathPoints[index + 1];
      const [segmentPath] = getBezierPath({
        sourceX: point.x,
        sourceY: point.y,
        sourcePosition,
        targetX: nextPoint.x,
        targetY: nextPoint.y,
        targetPosition,
      });
      return index === 0 ? segmentPath : stripMoveCommand(segmentPath);
    })
    .join(' ');
}

export function BTEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
}: EdgeProps) {
  const reactFlow = useReactFlow();
  const edgeData = (data ?? {}) as BTEdgeRenderData;
  const reroutePoints = edgeData.reroutePoints ?? [];
  const yDiff = Math.abs(sourceY - targetY);
  const useStraight = yDiff <= STRAIGHT_THRESHOLD;

  const [defaultPath] = useStraight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const edgePath = reroutePoints.length > 0
    ? getReroutedBezierPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, reroutePoints)
    : defaultPath;

  const startPointDrag = (event: React.MouseEvent, point: BTEdgeReroutePoint) => {
    event.preventDefault();
    event.stopPropagation();
    edgeData.onReroutePointSelect?.(id, point.id);

    const handleMove = (moveEvent: MouseEvent) => {
      edgeData.onReroutePointMove?.(
        id,
        point.id,
        reactFlow.screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      );
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        className="bt-edge-hit-area"
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          edgeData.onReroutePointAdd?.(
            id,
            reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
          );
        }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={0}
        style={{
          stroke: selected ? '#6366f1' : '#475569',
          strokeWidth: selected ? 3 : 2,
        }}
      />
      {reroutePoints.length > 0 && (
        <EdgeLabelRenderer>
          {reroutePoints.map((point) => {
            const pointSelected = edgeData.selectedReroutePointId === point.id;
            return (
              <button
                key={point.id}
                type="button"
                aria-label="Reroute point"
                className="bt-edge-reroute-point"
                onMouseDown={(event) => startPointDrag(event, point)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  edgeData.onReroutePointSelect?.(id, point.id);
                }}
                style={{
                  transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
                  borderColor: pointSelected ? '#f8fafc' : '#64748b',
                  boxShadow: pointSelected
                    ? '0 0 0 2px rgba(99, 102, 241, 0.45)'
                    : '0 0 0 1px rgba(15, 23, 42, 0.85)',
                }}
              />
            );
          })}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
