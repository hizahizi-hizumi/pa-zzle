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
export function HitofudePuzzleCell({
  size,
  cell,
  state,
  isStart,
  isHead,
  isDeadEnd,
  disabled,
  focusable,
  onPress,
  onFocus,
}: HitofudePuzzleCellProps) {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  const label = [
    `${row + 1}行${column + 1}列`,
    describeCell(state, isStart, isHead, isDeadEnd),
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
      // フォーカスの枠は穴の縁（マスの辺に沿う角張った濃い線）と見分けられるよう、マスの内側へ下げた角の丸い
      // ring の色の太い枠にし、マスを ring の色で淡く染める。
      className="relative m-[10%] min-h-0 min-w-0 rounded-[22%] outline-none focus-visible:z-10 focus-visible:bg-ring/25 focus-visible:outline-4 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-default"
    />
  );
}
