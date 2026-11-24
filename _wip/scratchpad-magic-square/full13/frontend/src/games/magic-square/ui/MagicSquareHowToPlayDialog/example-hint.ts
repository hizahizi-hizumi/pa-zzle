import type {
  MagicSquareInputMode,
  MagicSquareSession,
} from "@/games/magic-square/session/session";
import { isSameMagicSquareExampleBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";

/**
 * 例で押す所。面に並べた盤面の番号で、どの盤面のマスか、どの盤面の下の数か、どの盤面の待ったかを指す。
 * `memo` はメモの切り替え（面に1つ）。
 */
export type MagicSquareExamplePress =
  | { kind: "cell"; board: number; cellIndex: number }
  | { kind: "value"; board: number; value: number }
  | { kind: "memo" }
  | { kind: "undo"; board: number };

/**
 * 例の面の、押して変わるもの全体。盤面ごとに、本番と同じく選んだマスを session に持つ（本番の画面を盤面の数だけ並べた形）。
 * 数を置く入れ方とメモを書く入れ方は面に1つ持つ。
 */
export type MagicSquareExampleGroupState = {
  sessions: readonly MagicSquareSession[];
  inputMode: MagicSquareInputMode;
};

type MagicSquareExampleBoards = MagicSquareExampleGroupState;

/**
 * 手がかりの進み具合。`step` は手がかりの列のうち押し終えた数、`baseline` はその時の盤面と入れ方。
 * 盤面か入れ方が `baseline` から離れたら、手がかりの手から外れたとして、手がかりを出さない。
 */
export type MagicSquareExampleHintProgress = {
  step: number;
  baseline: MagicSquareExampleBoards;
};

function isSameBoards(
  left: MagicSquareExampleBoards,
  right: MagicSquareExampleBoards,
): boolean {
  return (
    left.inputMode === right.inputMode &&
    left.sessions.every((session, index) => {
      const other = right.sessions[index];
      return (
        other !== undefined && isSameMagicSquareExampleBoard(session, other)
      );
    })
  );
}

function isSamePress(
  left: MagicSquareExamplePress,
  right: MagicSquareExamplePress,
): boolean {
  switch (left.kind) {
    case "cell":
      return (
        right.kind === "cell" &&
        right.board === left.board &&
        right.cellIndex === left.cellIndex
      );
    case "value":
      return (
        right.kind === "value" &&
        right.board === left.board &&
        right.value === left.value
      );
    case "memo":
      return right.kind === "memo";
    case "undo":
      return right.kind === "undo" && right.board === left.board;
  }
}

/** 手がかりの列で `step` より前にある、最後に選ぶマス。手がかりの手はそのマスを選んだまま続ける。 */
function findRequiredSelection(
  hints: readonly MagicSquareExamplePress[],
  step: number,
): Extract<MagicSquareExamplePress, { kind: "cell" }> | null {
  for (let index = step - 1; index >= 0; index -= 1) {
    const hint = hints[index];
    if (hint?.kind === "cell") {
      return hint;
    }
  }
  return null;
}

function isSelected(
  state: MagicSquareExampleGroupState,
  cell: Extract<MagicSquareExamplePress, { kind: "cell" }>,
): boolean {
  return state.sessions[cell.board]?.selectedCellIndex === cell.cellIndex;
}

function toBoards(
  state: MagicSquareExampleGroupState,
): MagicSquareExampleBoards {
  return { sessions: state.sessions, inputMode: state.inputMode };
}

export function createMagicSquareExampleHintProgress(
  initial: MagicSquareExampleGroupState,
): MagicSquareExampleHintProgress {
  return { step: 0, baseline: toBoards(initial) };
}

/** 最初の盤面に戻ったときの進み具合。最初の手で選ぶマスをもう選んでいれば、その手は済んだものとして次の手から出し直す。 */
function restartHint(
  hints: readonly MagicSquareExamplePress[],
  initial: MagicSquareExampleGroupState,
  next: MagicSquareExampleGroupState,
): MagicSquareExampleHintProgress {
  const restarted = createMagicSquareExampleHintProgress(initial);
  const [first] = hints;
  return first?.kind === "cell" && isSelected(next, first)
    ? { ...restarted, step: 1 }
    : restarted;
}

/**
 * 押した後の手がかりの進み具合。手がかりの姿（`baseline`）のまま手がかりの次の手を押したら、盤面が変わっても受け付けられなくても
 * 進める（受け付けられない手も、手がかりで見せる手のうち）。手がかりの姿から離れた盤面で同じ所を押しても進めない。
 * ほかの手で盤面か入れ方を変えたら進めず、手がかりの姿に戻るまで手がかりを出さない。最初の盤面に戻ったら、最初の手から出し直す
 * （最初の手のマスを選んだままなら次の手から）。
 */
export function followMagicSquareExampleHint(
  hints: readonly MagicSquareExamplePress[],
  progress: MagicSquareExampleHintProgress,
  press: MagicSquareExamplePress,
  previous: MagicSquareExampleGroupState,
  next: MagicSquareExampleGroupState,
  initial: MagicSquareExampleGroupState,
): MagicSquareExampleHintProgress {
  const expected = hints[progress.step];
  const required = findRequiredSelection(hints, progress.step);
  const onTrack =
    expected !== undefined &&
    isSameBoards(toBoards(previous), progress.baseline) &&
    isSamePress(expected, press) &&
    (press.kind === "cell" || required === null || isSelected(next, required));
  if (onTrack) {
    return { step: progress.step + 1, baseline: toBoards(next) };
  }
  if (
    !isSameBoards(toBoards(next), toBoards(previous)) &&
    isSameBoards(toBoards(next), toBoards(initial))
  ) {
    return restartHint(hints, initial, next);
  }
  return progress;
}

/**
 * 今出す手がかり。手がかりの手から外れている間・手がかりの手を押し終えた後は出さない。
 * 選ぶマスを選んだ後に別のマスを選んだときは、選ぶマスに手がかりを戻す。
 */
export function findMagicSquareExampleHint(
  hints: readonly MagicSquareExamplePress[],
  progress: MagicSquareExampleHintProgress,
  state: MagicSquareExampleGroupState,
): MagicSquareExamplePress | null {
  if (!isSameBoards(toBoards(state), progress.baseline)) {
    return null;
  }
  const expected = hints[progress.step];
  if (expected === undefined) {
    return null;
  }
  const required = findRequiredSelection(hints, progress.step);
  if (
    expected.kind !== "cell" &&
    required !== null &&
    !isSelected(state, required)
  ) {
    return required;
  }
  return expected;
}
