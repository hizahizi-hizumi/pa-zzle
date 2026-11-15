import { GRID_DOT_RADIUS } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import {
  type BoardPoint,
  type BoardView,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type GridDotsProps = { view: BoardView };

export function GridDots({ view }: GridDotsProps) {
  const { board } = view;
  const occupied = new Set(
    board.islands.map(({ row, column }) => row * board.width + column),
  );
  const dots: BoardPoint[] = [];
  for (let row = 0; row < board.height; row += 1) {
    for (let column = 0; column < board.width; column += 1) {
      if (!occupied.has(row * board.width + column)) {
        dots.push(toViewPoint(view, { x: column + 0.5, y: row + 0.5 }));
      }
    }
  }
  return (
    <g className={bridgesToneClassNames.gridDot}>
      {dots.map(({ x, y }) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r={GRID_DOT_RADIUS} />
      ))}
    </g>
  );
}
