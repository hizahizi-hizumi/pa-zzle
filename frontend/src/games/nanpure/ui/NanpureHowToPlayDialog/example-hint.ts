import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import type { NanpureSession } from "@/games/nanpure/session/session";
import { isSameNanpureExampleBoard } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";

/** 例で押す所。マスは、面に並べた盤面の番号と、9×9 の盤面での番号で指す。 */
export type NanpureExamplePress =
  | { kind: "cell"; board: number; cellIndex: number }
  | { kind: "digit"; digit: NanpureDigit }
  | { kind: "erase" }
  | { kind: "notes" };

/** 例の面の、押して変わるもの全体。マスを選んでいるのは、面の中で1つの盤面だけ。 */
export type NanpureExampleGroupState = {
  sessions: readonly NanpureSession[];
  selection: { board: number; cellIndex: number } | null;
  notesMode: boolean;
};

/**
 * 手がかりの進み具合。`step` は手がかりの列のうち押し終えた数、`baseline` はその時の盤面とメモの入れ方。
 * 盤面かメモの入れ方が `baseline` から離れたら、手がかりの手から外れたとして、手がかりを出さない。
 */
export type NanpureExampleHintProgress = {
  step: number;
  baseline: Pick<NanpureExampleGroupState, "sessions" | "notesMode">;
};

function isSameBoards(
  left: Pick<NanpureExampleGroupState, "sessions" | "notesMode">,
  right: Pick<NanpureExampleGroupState, "sessions" | "notesMode">,
): boolean {
  return (
    left.notesMode === right.notesMode &&
    left.sessions.every((session, index) => {
      const other = right.sessions[index];
      return other !== undefined && isSameNanpureExampleBoard(session, other);
    })
  );
}

function isSamePress(
  left: NanpureExamplePress,
  right: NanpureExamplePress,
): boolean {
  switch (left.kind) {
    case "cell":
      return (
        right.kind === "cell" &&
        right.board === left.board &&
        right.cellIndex === left.cellIndex
      );
    case "digit":
      return right.kind === "digit" && right.digit === left.digit;
    case "erase":
    case "notes":
      return right.kind === left.kind;
  }
}

/** 手がかりの列で `step` より前にある、最後に選ぶマス。手がかりの手はそのマスを選んだまま続ける。 */
function findRequiredSelection(
  hints: readonly NanpureExamplePress[],
  step: number,
): Extract<NanpureExamplePress, { kind: "cell" }> | null {
  for (let index = step - 1; index >= 0; index -= 1) {
    const hint = hints[index];
    if (hint?.kind === "cell") {
      return hint;
    }
  }
  return null;
}

function isSelected(
  state: NanpureExampleGroupState,
  cell: Extract<NanpureExamplePress, { kind: "cell" }>,
): boolean {
  return (
    state.selection?.board === cell.board &&
    state.selection.cellIndex === cell.cellIndex
  );
}

export function createNanpureExampleHintProgress(
  initial: NanpureExampleGroupState,
): NanpureExampleHintProgress {
  return {
    step: 0,
    baseline: { sessions: initial.sessions, notesMode: initial.notesMode },
  };
}

/**
 * 最初の盤面に戻ったときの進み具合。最初の手で選ぶマスをもう選んでいれば、その手は済んだものとして次の手から出し直す。
 */
function restartHint(
  hints: readonly NanpureExamplePress[],
  initial: NanpureExampleGroupState,
  next: NanpureExampleGroupState,
): NanpureExampleHintProgress {
  const restarted = createNanpureExampleHintProgress(initial);
  const [first] = hints;
  return first?.kind === "cell" && isSelected(next, first)
    ? { ...restarted, step: 1 }
    : restarted;
}

/**
 * 押した後の手がかりの進み具合。手がかりの次の手を押したら進める。
 * ほかの手で盤面かメモの入れ方を変えたら進めず、手がかりを出さない。最初の盤面に戻ったら、最初の手から出し直す（最初の手のマスを選んだままなら次の手から）。
 * マスを選び直すだけでは、盤面は変わらないので外れない。
 */
export function followNanpureExampleHint(
  hints: readonly NanpureExamplePress[],
  progress: NanpureExampleHintProgress,
  press: NanpureExamplePress,
  next: NanpureExampleGroupState,
  initial: NanpureExampleGroupState,
): NanpureExampleHintProgress {
  const expected = hints[progress.step];
  const required = findRequiredSelection(hints, progress.step);
  const onTrack =
    expected !== undefined &&
    isSamePress(expected, press) &&
    (press.kind === "cell" || required === null || isSelected(next, required));
  if (
    onTrack &&
    isSameBoards(next, progress.baseline) === (press.kind === "cell")
  ) {
    return {
      step: progress.step + 1,
      baseline: { sessions: next.sessions, notesMode: next.notesMode },
    };
  }
  if (isSameBoards(next, progress.baseline)) {
    return progress;
  }
  if (isSameBoards(next, initial)) {
    return restartHint(hints, initial, next);
  }
  return progress;
}

/**
 * 今出す手がかり。手がかりの手から外れている間と、手がかりの手を押し終えた後は出さない。
 * 選ぶマスを選んだ後に別のマスを選んだときは、選ぶマスに手がかりを戻す。
 */
export function findNanpureExampleHint(
  hints: readonly NanpureExamplePress[],
  progress: NanpureExampleHintProgress,
  state: NanpureExampleGroupState,
): NanpureExamplePress | null {
  if (!isSameBoards(state, progress.baseline)) {
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
