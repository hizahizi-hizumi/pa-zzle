import { getHamiltonianPathCellPosition } from "@/games/hamiltonian-path/puzzle/board";

/** マスの今の状態。`visited` は道が通ったマスで、始点と先端を含む。 */
export type HamiltonianPathCellState = "wall" | "unvisited" | "visited";

type HamiltonianPathCellProps = {
  size: number;
  cell: number;
  state: HamiltonianPathCellState;
  isStart: boolean;
  isHead: boolean;
  disabled: boolean;
  onSelect: (cell: number) => void;
};

const cellStateLabels = {
  wall: "壁",
  unvisited: "未通過",
  visited: "通過済み",
} as const satisfies Record<HamiltonianPathCellState, string>;

function describeCell(
  state: HamiltonianPathCellState,
  isStart: boolean,
  isHead: boolean,
): string {
  const marks = [isStart && "始点", isHead && "先端"].filter(Boolean);
  return marks.length > 0 ? marks.join(" ") : cellStateLabels[state];
}

/** 押す受け口だけを持つマス。地・道・印は盤面の絵が下の層に描く。 */
export function HamiltonianPathCell({
  size,
  cell,
  state,
  isStart,
  isHead,
  disabled,
  onSelect,
}: HamiltonianPathCellProps) {
  const { row, column } = getHamiltonianPathCellPosition(size, cell);

  return (
    <button
      type="button"
      aria-label={`${row + 1}行${column + 1}列 ${describeCell(state, isStart, isHead)}`}
      disabled={disabled}
      onClick={() => onSelect(cell)}
      className="relative min-h-0 min-w-0 touch-manipulation select-none outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default"
    />
  );
}
