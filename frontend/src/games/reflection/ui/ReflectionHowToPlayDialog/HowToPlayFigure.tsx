import { parseReflectionBoard } from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { getReflectionFigureExtent } from "@/games/reflection/ui/board/board-geometry";
import { ReflectionFigureClue } from "@/games/reflection/ui/board/figure/ReflectionFigureClue";
import { ReflectionFigureGrid } from "@/games/reflection/ui/board/figure/ReflectionFigureGrid";
import { ReflectionFigurePiece } from "@/games/reflection/ui/board/figure/ReflectionFigurePiece";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";

type HowToPlayFigureProps = {
  /** 盤面の記法（`/ \ | = o @ .`）。 */
  rows: readonly string[];
  /** 光を入れる外周の位置。この位置の外周ヒントと光路だけを描く。 */
  entry: ReflectionEntry;
};

/** 盤面と同じ形・線で、1本の光路と外周ヒントを小さく描く。 */
export function HowToPlayFigure({ rows, entry }: HowToPlayFigureProps) {
  const board = parseReflectionBoard(rows);
  const { size } = board;
  const extent = getReflectionFigureExtent(size);
  const trace = traceReflectionLaser(board, entry);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${extent} ${extent}`}
      className="size-24 shrink-0"
    >
      <ReflectionFigureGrid size={size} />
      <g className={reflectionToneClassNames.laserText}>
        <ReflectionLaserPath size={size} entry={entry} trace={trace} />
      </g>
      {board.cells.map(function renderPiece(cell, cellIndex) {
        return cell === null ? null : (
          <ReflectionFigurePiece
            // biome-ignore lint/suspicious/noArrayIndexKey: マスの位置で決まる
            key={cellIndex}
            size={size}
            cellIndex={cellIndex}
            piece={cell}
          />
        );
      })}
      <ReflectionFigureClue size={size} entry={entry} clue={trace} />
    </svg>
  );
}
