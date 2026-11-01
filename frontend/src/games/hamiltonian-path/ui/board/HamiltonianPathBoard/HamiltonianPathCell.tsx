import {
  getHamiltonianPathCellPosition,
  type HamiltonianPathDirection,
} from "@/games/hamiltonian-path/puzzle/board";

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
  /** 取り残しとして知らせるマスか。 */
  isStranded: boolean;
  /** 隣のマスとの間に仕切りがある向き。 */
  partitionDirections: readonly HamiltonianPathDirection[];
  disabled: boolean;
  onPress: (cell: number) => void;
};

const cellStateLabels = {
  wall: "壁",
  unvisited: "未通過",
  visited: "通過済み",
} as const satisfies Record<HamiltonianPathCellState, string>;

const directionLabels = {
  up: "上",
  right: "右",
  down: "下",
  left: "左",
} as const satisfies Record<HamiltonianPathDirection, string>;

function describePartitions(
  directions: readonly HamiltonianPathDirection[],
): string | null {
  return directions.length > 0
    ? `${directions.map((direction) => directionLabels[direction]).join("・")}に仕切り`
    : null;
}

function describeCell(
  state: HamiltonianPathCellState,
  isStart: boolean,
  isHead: boolean,
  isDeadEnd: boolean,
  isStranded: boolean,
): string {
  const marks = [
    isStart && "始点",
    isHead && "先端",
    isDeadEnd && "行き止まり",
    isStranded && "取り残し",
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
  isStranded,
  partitionDirections,
  disabled,
  onPress,
}: HamiltonianPathCellProps) {
  const { row, column } = getHamiltonianPathCellPosition(size, cell);
  const label = [
    `${row + 1}行${column + 1}列`,
    describeCell(state, isStart, isHead, isDeadEnd, isStranded),
    describePartitions(partitionDirections),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      aria-label={label}
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
