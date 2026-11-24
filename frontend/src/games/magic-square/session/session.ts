import {
  assertMagicSquareProblem,
  type MagicSquareProblem,
} from "@/games/magic-square/problem/problem";
import { isMagicSquareCellIndex } from "@/games/magic-square/puzzle/board";
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
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/** 数の欄で押した数を、選んだマスに置くか（`value`）、選んだマスのメモに書くか（`memo`）。 */
export type MagicSquareInputMode = "value" | "memo";

/** 待ったで戻れる1つ前の盤面と、その盤面から変えたマス。 */
type MagicSquareSessionHistoryEntry = {
  puzzleState: MagicSquareState;
  cellIndex: number;
};

/**
 * ほかのマスを選ばずに同じマスを変え続けている間の記録。`quietValues` は、その間にそのマスに入った数（置いた数と、待ったで戻った数）
 * のうち、その数でそのマスを通る列の端の数の見え方が変わらなかった数（`changesMagicSquareLineVerdict`）。
 * 同じマスを変えている間はほかのマスが変わらないので、同じ数ならいつ入っても同じになる。
 */
type MagicSquareEditingCell = {
  cellIndex: number;
  quietValues: readonly number[];
};

export type MagicSquareSession = GameSession<
  MagicSquareProblem,
  MagicSquareState
> & {
  /** 数の欄で押した数を入れるマス。どのマスも選んでいなければ `null`。最初から置いてある数のマスも選べる。 */
  selectedCellIndex: number | null;
  /** 待ったで戻れる盤面。最後が直前の盤面。盤面を戻すと空になる。 */
  history: readonly MagicSquareSessionHistoryEntry[];
  /** 置き直しの回数。置いた数がマスから外れたときに、その場で数える。減ることはない。 */
  correctionCount: number;
  editingCell: MagicSquareEditingCell | null;
  undoCount: number;
  restartCount: number;
};

/**
 * - `correctionCount`: 置いた数がそのマスから外れた回数（置き直し）。外す・置き換える・待った・盤面を戻すのどれで外れても同じに
 *   数える。ただし、ほかのマスを選ぶ前に同じマスで直した数のうち、その間にそのマスに入って、列の端の数の見え方を変えなかった数は、
 *   押し間違いの直しとして数えない。列の端の数の見え方を変えた数（列が埋まって一致・違反になった、合計に届いた）は、盤面の知らせを
 *   見てから直したので数える。盤面を戻すは同じマスを直す操作ではないので、盤面にあった置いた数をどれも数える。
 */
export type MagicSquareSessionResult = {
  elapsedMs: number;
  correctionCount: number;
  undoCount: number;
  restartCount: number;
};

/** そのマスを変える前に、ほかのマスを変えていた記録を終え、そのマスを変え始めた記録にする。 */
function beginEditingCell(
  editingCell: MagicSquareEditingCell | null,
  cellIndex: number,
): MagicSquareEditingCell {
  return editingCell?.cellIndex === cellIndex
    ? editingCell
    : { cellIndex, quietValues: [] };
}

/**
 * そのマスの盤面を `puzzleState` に替える。外れた置いた数を置き直しに数え（変えている間に入って列の見え方を変えなかった数を除く）、
 * 入った数が列の見え方を変えなかったなら、変えている間に入った数として覚える。
 */
function changeCell(
  session: MagicSquareSession,
  cellIndex: number,
  puzzleState: MagicSquareState,
): MagicSquareSession {
  const editingCell = beginEditingCell(session.editingCell, cellIndex);
  const departed = session.puzzleState.cells[cellIndex] ?? null;
  const entered = puzzleState.cells[cellIndex] ?? null;
  if (departed === entered) {
    return { ...session, puzzleState, editingCell };
  }
  const counted =
    departed !== null && !editingCell.quietValues.includes(departed) ? 1 : 0;
  const quiet =
    entered !== null &&
    !editingCell.quietValues.includes(entered) &&
    !changesMagicSquareLineVerdict(puzzleState, cellIndex);
  return {
    ...session,
    puzzleState,
    correctionCount: session.correctionCount + counted,
    editingCell: quiet
      ? { cellIndex, quietValues: [...editingCell.quietValues, entered] }
      : editingCell,
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
  const edited = changeCell(
    {
      ...session,
      history: [
        ...session.history,
        { puzzleState: session.puzzleState, cellIndex },
      ],
    },
    cellIndex,
    puzzleState,
  );
  if (!isMagicSquareSolved(puzzleState)) {
    return edited;
  }
  return {
    ...edited,
    status: "cleared",
    clearedAt: editedAt,
    selectedCellIndex: null,
    editingCell: null,
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
    correctionCount: 0,
    editingCell: null,
    undoCount: 0,
    restartCount: 0,
  };
}

/** マスを選ぶ。置いた数のマスを押しても選ぶだけにする。ほかのマスを選んだので、変えていたマスの記録を終える。 */
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
  return {
    ...session,
    selectedCellIndex: cellIndex,
    editingCell:
      session.editingCell?.cellIndex === cellIndex ? session.editingCell : null,
  };
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

/**
 * 数の欄で数を押した結果。`placed`・`removed` は数を置いた・外した、`memo-written`・`memo-erased` はメモを書いた・消した、
 * `rejected` は受け付けなかった（マスを選んでいない・最初から置いてある数のマス・書けないメモなど）。
 */
export type MagicSquareInputType =
  | "placed"
  | "removed"
  | "memo-written"
  | "memo-erased"
  | "rejected";

function describeAcceptedInput(
  inputMode: MagicSquareInputMode,
  session: MagicSquareSession,
  cellIndex: number,
  value: number,
): Exclude<MagicSquareInputType, "rejected"> {
  const { cells, memos } = session.puzzleState;
  if (inputMode === "memo") {
    return memos[cellIndex]?.includes(value) ? "memo-written" : "memo-erased";
  }
  return cells[cellIndex] === value ? "placed" : "removed";
}

/**
 * 数の欄で数を押した後の session と、その結果。入れ方がメモならメモを書く・消し、数なら置く・置き換える・外す。
 * 受け付けなかったときは、受け取った session と `rejected` を返す。プレイ中と遊び方の例で同じに求める。
 */
export function inputMagicSquareSessionValue(
  session: MagicSquareSession,
  inputMode: MagicSquareInputMode,
  value: number,
  inputAt: number,
): { session: MagicSquareSession; type: MagicSquareInputType } {
  const { selectedCellIndex: cellIndex } = session;
  const operated =
    inputMode === "memo"
      ? toggleMagicSquareSessionMemo(session, value, inputAt)
      : enterMagicSquareSessionValue(session, value, inputAt);
  if (operated === session || cellIndex === null) {
    return { session, type: "rejected" };
  }
  return {
    session: operated,
    type: describeAcceptedInput(inputMode, operated, cellIndex, value),
  };
}

/**
 * 直前の盤面操作を取り消す。取り消しでそのマスから外れた置いた数も、ほかの操作で外れたときと同じに置き直しとして数え、
 * 戻った数は、そのマスに入った数として扱う。
 */
export function undoMagicSquareSession(
  session: MagicSquareSession,
): MagicSquareSession {
  if (!canUndoMagicSquareSession(session)) {
    return session;
  }
  const { puzzleState, cellIndex } = session.history.at(-1)!;
  return changeCell(
    {
      ...session,
      history: session.history.slice(0, -1),
      undoCount: session.undoCount + 1,
    },
    cellIndex,
    puzzleState,
  );
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
  const { givens } = session.problem;
  const placedCount = session.puzzleState.cells.filter(
    (cell, cellIndex) =>
      cell !== null && !isMagicSquareGivenCell(givens, cellIndex),
  ).length;
  return {
    ...session,
    puzzleState: createMagicSquareInitialState(givens),
    history: [],
    correctionCount: session.correctionCount + placedCount,
    editingCell: null,
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
  return session.correctionCount;
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
