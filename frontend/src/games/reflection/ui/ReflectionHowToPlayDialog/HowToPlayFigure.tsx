import {
  getReflectionCellPosition,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  getReflectionBoardOrigin,
  getReflectionClueCenter,
  getReflectionFigureExtent,
} from "@/games/reflection/ui/board/board-geometry";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { renderReflectionOutcomeShape } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import {
  REFLECTION_PIECE_HALO_WIDTH,
  REFLECTION_PIECE_STROKE_WIDTH,
  renderReflectionPieceShape,
} from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";

type HowToPlayFigureProps = {
  /** 盤面の記法（`/ \ | = o @ .`）。 */
  rows: readonly string[];
  /** 光を入れる外周の位置。この位置の外周ヒントと光路だけを描く。 */
  entry: ReflectionEntry;
};

const PIECE_SCALE = 0.008;

/** 盤面と同じ形・線で、1本の光路と外周ヒントを小さく描く。 */
export function HowToPlayFigure({ rows, entry }: HowToPlayFigureProps) {
  const board = parseReflectionBoard(rows);
  const { size } = board;
  const extent = getReflectionFigureExtent(size);
  const { x: offset } = getReflectionBoardOrigin();
  const trace = traceReflectionLaser(board, entry);
  const clueCenter = getReflectionClueCenter(size, entry);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${extent} ${extent}`}
      className="size-24 shrink-0"
    >
      <rect
        x={offset}
        y={offset}
        width={size}
        height={size}
        className="fill-background stroke-border"
        strokeWidth={0.03}
      />
      {Array.from({ length: size - 1 }, (_, index) => (
        <g
          // biome-ignore lint/suspicious/noArrayIndexKey: 格子線は位置だけで決まる
          key={index}
          className="stroke-border"
          strokeWidth={0.02}
        >
          <line
            x1={offset + index + 1}
            y1={offset}
            x2={offset + index + 1}
            y2={offset + size}
          />
          <line
            x1={offset}
            y1={offset + index + 1}
            x2={offset + size}
            y2={offset + index + 1}
          />
        </g>
      ))}
      <rect
        x={offset}
        y={offset}
        width={size}
        height={size}
        fill="none"
        className="stroke-foreground/55"
        strokeWidth={0.06}
      />
      <g className={reflectionToneClassNames.laserText}>
        <ReflectionLaserPath size={size} entry={entry} trace={trace} />
      </g>
      {board.cells.map(function renderPiece(cell, cellIndex) {
        if (cell === null) return null;
        const { row, column } = getReflectionCellPosition(size, cellIndex);
        const x = offset + column + 0.1;
        const y = offset + row + 0.1;
        return (
          <g
            key={`${row}:${column}`}
            transform={`translate(${x} ${y}) scale(${PIECE_SCALE})`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g
              className="fill-background stroke-background"
              strokeWidth={
                REFLECTION_PIECE_STROKE_WIDTH + REFLECTION_PIECE_HALO_WIDTH
              }
            >
              {renderReflectionPieceShape(cell, REFLECTION_PIECE_HALO_WIDTH)}
            </g>
            <g
              className="text-foreground"
              stroke="currentColor"
              strokeWidth={REFLECTION_PIECE_STROKE_WIDTH}
            >
              {renderReflectionPieceShape(cell)}
            </g>
          </g>
        );
      })}
      <text
        x={clueCenter.x}
        y={clueCenter.y - 0.02}
        textAnchor="middle"
        className="fill-foreground font-semibold"
        fontSize={0.6}
      >
        {trace.distance}
      </text>
      <g
        transform={`translate(${clueCenter.x - 0.18} ${clueCenter.y + 0.08}) scale(${0.36 / 12})`}
        className="text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {renderReflectionOutcomeShape(trace.outcome)}
      </g>
    </svg>
  );
}
