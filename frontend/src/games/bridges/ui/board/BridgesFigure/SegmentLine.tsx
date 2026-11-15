import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";

type SegmentLineProps = {
  segment: BoardSegment;
  className: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity?: number;
};

export function SegmentLine({
  segment: { start, end },
  className,
  strokeWidth,
  strokeDasharray,
  ...attributes
}: SegmentLineProps) {
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      className={className}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      {...attributes}
    />
  );
}
