import type {
  MagicSquareInputMode,
  MagicSquareSession,
} from "@/games/magic-square/session/session";
import { isSameMagicSquareExampleBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";

/** 例で押す所。マスは、面に並べた盤面の番号と、盤面でのマスの番号で指す。`memo` はメモの切り替え。 */
export type MagicSquareExamplePress =
  | { kind: "cell"; board: number; cellIndex: number }
  | { kind: "value"; value: number }
  | { kind: "memo" };

/** 例の面の、押して変わるもの全体。マスを選んでいるのは、面の中で1つの盤面だけ。 */
export type MagicSquareExampleGroupState = {
  sessions: readonly MagicSquareSession[];
  selection: { board: number; cellIndex: number } | null;
  inputMode: MagicSquareInputMode;
};

type MagicSquareExampleBoards = Pick<
  MagicSquareExampleGroupState,
  "sessions" | "inputMode"
>;

/**
 * 手がかりの進み具合。`step` は手がかりの列のうち押し終えた数、`baseline` はその時の盤面と入れ方。
 * 盤面か入れ方が `baseline` から離れたら、手がかりの手から外れたとして、手がかりを出さない。
 * `rejected` は、手がかりの手を押して受け付けられなかったこと。盤面が変わるかマスを選び直すまで手がかりを出さない。
 */
export type MagicSquareExampleHintProgress = {
  step: number;
  baseline: MagicSquareExampleBoards;
  rejected: boolean;
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
      return right.kind === "value" && right.value === left.value;
    case "memo":
      return right.kind === "memo";
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
  return (
    state.selection?.board === cell.board &&
    state.selection.cellIndex === cell.cellIndex
  );
}

function toBoards(
  state: MagicSquareExampleGroupState,
): MagicSquareExampleBoards {
  return { sessions: state.sessions, inputMode: state.inputMode };
}

export function createMagicSquareExampleHintProgress(
  initial: MagicSquareExampleGroupState,
): MagicSquareExampleHintProgress {
  return { step: 0, baseline: toBoards(initial), rejected: false };
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
 * 押した後の手がかりの進み具合。手がかりの次の手を押して盤面が変わったら（マスを選ぶ手では選んだら）進める。
 * 手がかりの手が受け付けられなかったら、進めずに手がかりを隠し、マスを選び直すか盤面が変わったら出し直す。
 * ほかの手で盤面か入れ方を変えたら進めず、手がかりを出さない。最初の盤面に戻ったら、最初の手から出し直す（最初の手のマスを選んだままなら次の手から）。
 */
export function followMagicSquareExampleHint(
  hints: readonly MagicSquareExamplePress[],
  progress: MagicSquareExampleHintProgress,
  press: MagicSquareExamplePress,
  next: MagicSquareExampleGroupState,
  initial: MagicSquareExampleGroupState,
): MagicSquareExampleHintProgress {
  const expected = hints[progress.step];
  const required = findRequiredSelection(hints, progress.step);
  const onTrack =
    expected !== undefined &&
    isSamePress(expected, press) &&
    (press.kind === "cell" || required === null || isSelected(next, required));
  const boardsKept = isSameBoards(toBoards(next), progress.baseline);
  if (onTrack && boardsKept === (press.kind === "cell")) {
    return {
      step: progress.step + 1,
      baseline: toBoards(next),
      rejected: false,
    };
  }
  if (boardsKept) {
    return { ...progress, rejected: press.kind !== "cell" && onTrack };
  }
  if (isSameBoards(toBoards(next), toBoards(initial))) {
    return restartHint(hints, initial, next);
  }
  return progress;
}

/**
 * 今出す手がかり。手がかりの手から外れている間・受け付けられなかった後・手がかりの手を押し終えた後は出さない。
 * 選ぶマスを選んだ後に別のマスを選んだときは、選ぶマスに手がかりを戻す。
 */
export function findMagicSquareExampleHint(
  hints: readonly MagicSquareExamplePress[],
  progress: MagicSquareExampleHintProgress,
  state: MagicSquareExampleGroupState,
): MagicSquareExamplePress | null {
  if (progress.rejected || !isSameBoards(toBoards(state), progress.baseline)) {
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
