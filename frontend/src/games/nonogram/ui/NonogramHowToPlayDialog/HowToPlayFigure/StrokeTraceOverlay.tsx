import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/** なぞった道筋。押し始めたマスから離したマスまで、同じ行・列のマスを結ぶ。 */
export type StrokeTrace = {
  fromCellIndex: number;
  toCellIndex: number;
};

/** 図の1マスの辺と、マスの間の線の太さ（px）。マスは `size-6`、線は `gap-px`。 */
const FIGURE_CELL_SIZE = 24;
const FIGURE_GRID_LINE_WIDTH = 1;
const FIGURE_CELL_PITCH = FIGURE_CELL_SIZE + FIGURE_GRID_LINE_WIDTH;
const TRACE_START_RADIUS = 4.5;
const TRACE_ARROW_LENGTH = 6;

function findCellCenter(
  cellIndex: number,
  boardWidth: number,
): { x: number; y: number } {
  const row = Math.floor(cellIndex / boardWidth);
  const column = cellIndex % boardWidth;
  return {
    x: column * FIGURE_CELL_PITCH + FIGURE_CELL_SIZE / 2,
    y: row * FIGURE_CELL_PITCH + FIGURE_CELL_SIZE / 2,
  };
}

type StrokeTraceOverlayProps = {
  trace: StrokeTrace;
  boardWidth: number;
  boardHeight: number;
};

/** 図の格子に重ねて、押し始めたマスの点と、離したマスへ向かう矢印を描く。親は `relative` にする。 */
export function StrokeTraceOverlay({
  trace,
  boardWidth,
  boardHeight,
}: StrokeTraceOverlayProps) {
  const start = findCellCenter(trace.fromCellIndex, boardWidth);
  const end = findCellCenter(trace.toCellIndex, boardWidth);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const direction = {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
  };
  const arrowBase = {
    x: end.x - direction.x * TRACE_ARROW_LENGTH,
    y: end.y - direction.y * TRACE_ARROW_LENGTH,
  };
  const arrowSide = {
    x: -direction.y * TRACE_ARROW_LENGTH,
    y: direction.x * TRACE_ARROW_LENGTH,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${boardWidth * FIGURE_CELL_PITCH - FIGURE_GRID_LINE_WIDTH} ${boardHeight * FIGURE_CELL_PITCH - FIGURE_GRID_LINE_WIDTH}`}
      className={cn(
        "pointer-events-none absolute inset-0 size-full",
        nonogramToneClassNames.strokeTrace,
      )}
    >
      <circle
        cx={start.x}
        cy={start.y}
        r={TRACE_START_RADIUS}
        fill="currentColor"
      />
      <path
        d={`M${start.x} ${start.y} L${end.x} ${end.y} M${arrowBase.x + arrowSide.x} ${arrowBase.y + arrowSide.y} L${end.x} ${end.y} L${arrowBase.x - arrowSide.x} ${arrowBase.y - arrowSide.y}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
    </svg>
  );
}
