import { getHamiltonianPathCellPosition } from "@/games/hamiltonian-path/puzzle/board";

/** マスの今の状態。`visited` は道が通ったマスで、始点と先端を含む。 */
export type HamiltonianPathCellState = "wall" | "unvisited" | "visited";

type HamiltonianPathCellProps = {
  size: number;
  cell: number;
  state: HamiltonianPathCellState;
  isStart: boolean;
  isHead: boolean;
  /** 先端から延ばせるマスが無いか。 */
  isDeadEnd: boolean;
  disabled: boolean;
  onPress: (cell: number) => void;
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
  isDeadEnd: boolean,
): string {
  const marks = [
    isStart && "始点",
    isHead && "先端",
    isDeadEnd && "行き止まり",
  ].filter(Boolean);
  return marks.length > 0 ? marks.join(" ") : cellStateLabels[state];
}

/**
 * キーボードと支援技術からマスを押す受け口。地・道・印は盤面の絵が下の層に描く。
 * ポインターでの押下は盤面がなぞりとして受けるので、ポインターから届く click（`detail` が 1 以上）は受けない。
 */
export function HamiltonianPathCell({
  size,
  cell,
  state,
  isStart,
  isHead,
  isDeadEnd,
  disabled,
  onPress,
}: HamiltonianPathCellProps) {
  const { row, column } = getHamiltonianPathCellPosition(size, cell);

  return (
    <button
      type="button"
      aria-label={`${row + 1}行${column + 1}列 ${describeCell(state, isStart, isHead, isDeadEnd)}`}
      disabled={disabled}
      onClick={(event) => {
        if (event.detail === 0) {
          onPress(cell);
        }
      }}
      className="relative min-h-0 min-w-0 outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default"
    />
  );
}
