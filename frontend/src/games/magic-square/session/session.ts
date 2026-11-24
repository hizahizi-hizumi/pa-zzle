import {
  assertMagicSquareProblem,
  type MagicSquareProblem,
} from "@/games/magic-square/problem/problem";
import {
  isMagicSquareCellIndex,
  type MagicSquareCell,
} from "@/games/magic-square/puzzle/board";
import {
  changesMagicSquareLineVerdict,
  enterMagicSquareValue,
  isMagicSquareGivenCell,
  isMagicSquareSolved,
  listMagicSquareMemoValueStates,
  listMagicSquareValueStates,
  type MagicSquareValueState,
  toggleMagicSquareMemo,
} from "@/games/magic-square/puzzle/rules";
import {
  createMagicSquareInitialState,
  isSameMagicSquareState,
  type MagicSquareState,
} from "@/games/magic-square/puzzle/state";
import { areMagicSquareNumberPadNeighbors } from "@/games/magic-square/session/number-pad";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/** 数の欄で押した数を、選んだマスに置くか（`value`）、選んだマスのメモに書くか（`memo`）。 */
export type MagicSquareInputMode = "value" | "memo";

/** 待ったで戻れる1つ前の盤面と、その盤面から変えたマス。 */
type MagicSquareSessionHistoryEntry = {
  puzzleState: MagicSquareState;
  cellIndex: number;
};

/**
 * 同じマスを変えている間にそのマスへ置いた数。`changedLineVerdict` は、その数でそのマスを通る列の端の数の見え方が変わったか
 * （`changesMagicSquareLineVerdict`）。同じマスを変えている間はほかのマスが変わらないので、同じ数ならいつ置いても同じになる。
 */
type MagicSquareTriedValue = {
  value: number;
  changedLineVerdict: boolean;
};

/**
 * ほかのマスに触れずに同じマスを変え続けている間の記録。`valueBeforeEditing` は変え始める前のそのマスの数、
 * `triedValues` は変えている間に置いた数（初めて置いた順。変え始める前の数と、2度目に置いた数は足さない）。
 */
type MagicSquareEditingCell = {
  cellIndex: number;
  valueBeforeEditing: MagicSquareCell;
  triedValues: readonly MagicSquareTriedValue[];
};

export type MagicSquareSession = GameSession<
  MagicSquareProblem,
  MagicSquareState
> & {
  /** 数の欄で押した数を入れるマス。どのマスも選んでいなければ `null`。最初から置いてある数のマスも選べる。 */
  selectedCellIndex: number | null;
  /** 待ったで戻れる盤面。最後が直前の盤面。盤面を戻すと空になる。 */
  history: readonly MagicSquareSessionHistoryEntry[];
  /** 確かめ終えた置き直しの回数。変えている途中のマスの分は `editingCell` から数える。 */
  settledCorrectionCount: number;
  editingCell: MagicSquareEditingCell | null;
  undoCount: number;
  restartCount: number;
};

/**
 * - `correctionCount`: 置いた数をそのマスから外した・別の数に替えた回数（置き直し）。外す・置き換える・待った・盤面を戻すの
 *   どれで外れても同じに数える。ほかのマスに触れる前に同じマスで直した数は、押し間違いの直しとして数えない。ただし、
 *   列の端の数の見え方を変えた数（列が埋まって一致・違反になった、合計に届いた）は、盤面の知らせを見てから直したので数える。
 *   その中でも、そのマスで初めて見え方を変えた数を、数の欄で隣り合う数へ直したときは、隣の数を押し間違えた形なので数えない。
 */
export type MagicSquareSessionResult = {
  elapsedMs: number;
  correctionCount: number;
  undoCount: number;
  restartCount: number;
};

/** 変えているマスで初めて列の見え方を変えた数と、そのすぐ後に置いた数（無ければ今の数）が、数の欄で隣り合うか。 */
function isNeighborMistypeCorrected(
  size: number,
  triedValues: readonly MagicSquareTriedValue[],
  currentValue: MagicSquareCell,
): boolean {
  const changedIndex = triedValues.findIndex(
    ({ changedLineVerdict }) => changedLineVerdict,
  );
  const mistyped = triedValues[changedIndex];
  if (!mistyped || mistyped.value === currentValue) {
    return false;
  }
  const corrected = triedValues[changedIndex + 1]?.value ?? currentValue;
  return (
    corrected !== null &&
    areMagicSquareNumberPadNeighbors(size, mistyped.value, corrected)
  );
}

function countEditingCorrection(
  size: number,
  puzzleState: MagicSquareState,
  editingCell: MagicSquareEditingCell | null,
): number {
  if (!editingCell) {
    return 0;
  }
  const { cellIndex, valueBeforeEditing, triedValues } = editingCell;
  const currentValue = puzzleState.cells[cellIndex] ?? null;
  const replacedBeforeValue =
    valueBeforeEditing !== null && currentValue !== valueBeforeEditing ? 1 : 0;
  const correctedAfterVerdict = triedValues.filter(
    ({ value, changedLineVerdict }) =>
      changedLineVerdict && value !== currentValue,
  ).length;
  const forgivenMistype = isNeighborMistypeCorrected(
    size,
    triedValues,
    currentValue,
  )
    ? 1
    : 0;
  return replacedBeforeValue + correctedAfterVerdict - forgivenMistype;
}

function settleEditingCell(session: MagicSquareSession): MagicSquareSession {
  return session.editingCell === null
    ? session
    : {
        ...session,
        settledCorrectionCount: getMagicSquareSessionCorrectionCount(session),
        editingCell: null,
      };
}

/** そのマスを変える前に、ほかのマスを変えていた記録を確かめ終え、そのマスを変え始めた記録にする。 */
function beginEditingCell(
  session: MagicSquareSession,
  cellIndex: number,
): MagicSquareSession {
  if (session.editingCell?.cellIndex === cellIndex) {
    return session;
  }
  return {
    ...settleEditingCell(session),
    editingCell: {
      cellIndex,
      valueBeforeEditing: session.puzzleState.cells[cellIndex] ?? null,
      triedValues: [],
    },
  };
}

/** 変えているマスに今ある数を、変えている間に置いた数として覚える。 */
function recordTriedValue(session: MagicSquareSession): MagicSquareSession {
  const { editingCell, puzzleState } = session;
  if (!editingCell) {
    return session;
  }
  const value = puzzleState.cells[editingCell.cellIndex] ?? null;
  if (
    value === null ||
    value === editingCell.valueBeforeEditing ||
    editingCell.triedValues.some((tried) => tried.value === value)
  ) {
    return session;
  }
  return {
    ...session,
    editingCell: {
      ...editingCell,
      triedValues: [
        ...editingCell.triedValues,
        {
          value,
          changedLineVerdict: changesMagicSquareLineVerdict(
            puzzleState,
            editingCell.cellIndex,
          ),
        },
      ],
    },
  };
}

function editCell(
  session: MagicSquareSession,
  cellIndex: number,
  puzzleState: MagicSquareState,
  editedAt: number,
): MagicSquareSession {
  if (puzzleState === session.puzzleState) {
    return session;
  }
  const edited = recordTriedValue({
    ...beginEditingCell(session, cellIndex),
    puzzleState,
    history: [
      ...session.history,
      { puzzleState: session.puzzleState, cellIndex },
    ],
  });
  if (!isMagicSquareSolved(puzzleState)) {
    return edited;
  }
  return {
    ...settleEditingCell(edited),
    status: "cleared",
    clearedAt: editedAt,
    selectedCellIndex: null,
  };
}

export function createMagicSquareSession(
  problem: MagicSquareProblem,
  startedAt: number,
): MagicSquareSession {
  assertMagicSquareProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createMagicSquareInitialState(problem.givens),
    startedAt,
    clearedAt: null,
    selectedCellIndex: null,
    history: [],
    settledCorrectionCount: 0,
    editingCell: null,
    undoCount: 0,
    restartCount: 0,
  };
}

/** マスを選ぶ。置いた数のマスを押しても選ぶだけにする。ほかのマスに触れたので、変えていたマスの記録を確かめ終える。 */
export function selectMagicSquareSessionCell(
  session: MagicSquareSession,
  cellIndex: number,
): MagicSquareSession {
  if (
    session.status !== "playing" ||
    !isMagicSquareCellIndex(session.problem.givens.size, cellIndex) ||
    session.selectedCellIndex === cellIndex
  ) {
    return session;
  }
  const touched =
    session.editingCell !== null && session.editingCell.cellIndex !== cellIndex
      ? settleEditingCell(session)
      : session;
  return { ...touched, selectedCellIndex: cellIndex };
}

/**
 * 選んだマスに、数の欄で押した数を入れる。選んだマスに同じ数が置いてあれば外し、別の数なら置き換える。
 * マスを選んでいない・最初から置いてある数のマス・ほかのマスに置いた数では、受け取った session をそのまま返す。
 */
export function enterMagicSquareSessionValue(
  session: MagicSquareSession,
  value: number,
  enteredAt: number,
): MagicSquareSession {
  const { selectedCellIndex: cellIndex, problem, puzzleState } = session;
  if (session.status !== "playing" || cellIndex === null) {
    return session;
  }
  return editCell(
    session,
    cellIndex,
    enterMagicSquareValue(problem.givens, puzzleState, cellIndex, value),
    enteredAt,
  );
}

/** 選んだ空きマスのメモに数を書く。書いてあれば消す。書けないときは、受け取った session をそのまま返す。 */
export function toggleMagicSquareSessionMemo(
  session: MagicSquareSession,
  value: number,
  editedAt: number,
): MagicSquareSession {
  const { selectedCellIndex: cellIndex, problem, puzzleState } = session;
  if (session.status !== "playing" || cellIndex === null) {
    return session;
  }
  return editCell(
    session,
    cellIndex,
    toggleMagicSquareMemo(problem.givens, puzzleState, cellIndex, value),
    editedAt,
  );
}

/** 直前の盤面操作を取り消す。取り消しでそのマスから外れた置いた数も、ほかの操作で外れたときと同じに置き直しとして数える。 */
export function undoMagicSquareSession(
  session: MagicSquareSession,
): MagicSquareSession {
  if (!canUndoMagicSquareSession(session)) {
    return session;
  }
  const { puzzleState, cellIndex } = session.history.at(-1)!;
  return recordTriedValue({
    ...beginEditingCell(session, cellIndex),
    puzzleState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  });
}

/**
 * 同じプレイのまま盤面を初期状態へ戻す（盤面を戻す）。経過時間と計数は引き継ぎ、盤面にあった置いた数はどれも置き直しとして数える。
 * 戻す前の操作は待ったで戻せない。
 */
export function restartMagicSquareSession(
  session: MagicSquareSession,
): MagicSquareSession {
  if (!canRestartMagicSquareSession(session)) {
    return session;
  }
  const settled = settleEditingCell(session);
  const { givens } = session.problem;
  const placedCount = session.puzzleState.cells.filter(
    (cell, cellIndex) =>
      cell !== null && !isMagicSquareGivenCell(givens, cellIndex),
  ).length;
  return {
    ...settled,
    puzzleState: createMagicSquareInitialState(givens),
    history: [],
    settledCorrectionCount: settled.settledCorrectionCount + placedCount,
    restartCount: session.restartCount + 1,
  };
}

export function canUndoMagicSquareSession(
  session: MagicSquareSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function canRestartMagicSquareSession(
  session: MagicSquareSession,
): boolean {
  return (
    session.status === "playing" &&
    !isSameMagicSquareState(
      session.puzzleState,
      createMagicSquareInitialState(session.problem.givens),
    )
  );
}

export function getMagicSquareSessionCorrectionCount(
  session: MagicSquareSession,
): number {
  return (
    session.settledCorrectionCount +
    countEditingCorrection(
      session.problem.givens.size,
      session.puzzleState,
      session.editingCell,
    )
  );
}

/** 数の欄の 1 から n² までの、その入れ方での状態。並びは数の小さい順。 */
export function listMagicSquareSessionValueStates(
  session: MagicSquareSession,
  inputMode: MagicSquareInputMode,
): MagicSquareValueState[] {
  return inputMode === "memo"
    ? listMagicSquareMemoValueStates(
        session.puzzleState,
        session.selectedCellIndex,
      )
    : listMagicSquareValueStates(
        session.problem.givens,
        session.puzzleState,
        session.selectedCellIndex,
      );
}

export function getMagicSquareSessionResult(
  session: MagicSquareSession,
): MagicSquareSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }
  return {
    elapsedMs,
    correctionCount: getMagicSquareSessionCorrectionCount(session),
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
