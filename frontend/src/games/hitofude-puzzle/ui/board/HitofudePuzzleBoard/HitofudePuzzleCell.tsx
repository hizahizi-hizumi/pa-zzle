import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { getHitofudePuzzleCellPosition } from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleCellCue } from "@/games/hitofude-puzzle/ui/board/cell-cue";

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
  cue: HitofudePuzzleCellCue | undefined;
  /** チュートリアルで手を引いている間、画面全体の覆いからこのマスを抜く。 */
  spotlit: boolean;
  onPress: (cell: number) => void;
  onFocus: (cell: number) => void;
};

const CELL_ATTRIBUTE = "data-cell";

/**
 * 印と応えは、盤面の絵のマスと同じ四角に沿って囲む。マスの縁の格子線や外形の線と重ねると線に紛れるので、
 * マスの内側へ少し寄せて、格子線と離した四角にする。
 */
const cuePlacementClassName = "pointer-events-none absolute inset-[7%]";

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
 * キーボードと支援技術からマスを押す受け口。地・道・印は盤面の絵が下の層に描き、チュートリアルの印と合図だけをこのマスの上に重ねる。
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
  cue,
  spotlit,
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
      // フォーカスの枠は先端の輪（マス幅の8割強の円）と重ならないよう、マスの外側に沿わせる。穴の縁（マスの辺に沿う
      // 角張った濃い線）とは、角の丸い ring の色の枠と、マスを ring の色で淡く染めることで見分けさせる。
      className="relative min-h-0 min-w-0 rounded-[22%] outline-none focus-visible:z-10 focus-visible:bg-ring/25 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default"
    >
      <TutorialSpotlight active={spotlit} className="inset-0" />
      {cue?.kind === "extended" && (
        <span
          aria-hidden="true"
          data-cell-cue={cue.kind}
          className={cuePlacementClassName}
        >
          <TutorialCue kind="acknowledgement" id={cue.id} />
        </span>
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-cell-cue="hint"
          className={cuePlacementClassName}
        >
          <TutorialCue
            kind="mark"
            recallId={cue.kind === "recall" ? cue.id : null}
          />
        </span>
      )}
    </button>
  );
}
