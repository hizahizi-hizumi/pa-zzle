import { getHitofudePuzzleCellPosition } from "@/games/hitofude-puzzle/puzzle/board";

/** マスの今の状態。`visited` は道が通ったマスで、始点と先端を含む。 */
export type HitofudePuzzleCellState = "hole" | "unvisited" | "visited";

type HitofudePuzzleCellProps = {
  size: number;
  cell: number;
  state: HitofudePuzzleCellState;
  isStart: boolean;
  isHead: boolean;
  /** 先端から延ばせるマスが無いか。 */
  isDeadEnd: boolean;
  /** 取り残しとして知らせるマスか。 */
  isStranded: boolean;
  disabled: boolean;
  /** 盤面の Tab の止まり先か。 */
  focusable: boolean;
  onPress: (cell: number) => void;
  onFocus: (cell: number) => void;
};

const CELL_ATTRIBUTE = "data-cell";

/** 盤面の中から、マスのボタンを探す。 */
export function findCellButton(
  board: HTMLElement,
  cell: number,
): HTMLButtonElement | null {
  return board.querySelector<HTMLButtonElement>(
    `[${CELL_ATTRIBUTE}="${cell}"]`,
  );
}

const cellStateLabels = {
  hole: "穴",
  unvisited: "未通過",
  visited: "通過済み",
} as const satisfies Record<HitofudePuzzleCellState, string>;

function describeCell(
  state: HitofudePuzzleCellState,
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
export function HitofudePuzzleCell({
  size,
  cell,
  state,
  isStart,
  isHead,
  isDeadEnd,
  isStranded,
  disabled,
  focusable,
  onPress,
  onFocus,
}: HitofudePuzzleCellProps) {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  const label = [
    `${row + 1}行${column + 1}列`,
    describeCell(state, isStart, isHead, isDeadEnd, isStranded),
  ].join(" ");

  return (
    <button
      type="button"
      aria-label={label}
      {...{ [CELL_ATTRIBUTE]: cell }}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onFocus={() => onFocus(cell)}
      onClick={(event) => {
        if (event.detail === 0) {
          onPress(cell);
        }
      }}
      className="relative min-h-0 min-w-0 outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default"
    />
  );
}
