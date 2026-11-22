import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  listMagicSquareLines,
  listMagicSquareLinesThroughCell,
  type MagicSquareBoard,
  type MagicSquareLine,
  parseMagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  enterMagicSquareValue,
  isMagicSquareGivenCell,
  isMagicSquareLineViolation,
  isMagicSquareSolved,
  listMagicSquareLineEvaluations,
  type MagicSquareLineEvaluation,
} from "@/games/magic-square/puzzle/rules";
import {
  createMagicSquareInitialState,
  type MagicSquareState,
} from "@/games/magic-square/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/** 横の列・縦の列・斜めの列を1つずつ伝える。 */
export type MagicSquareTutorialRuleId = MagicSquareLine["kind"];

export type MagicSquareTutorialAction =
  | { type: "select"; cellIndex: number }
  | { type: "enter"; value: number };

/**
 * - `operation`: 印のマスを選び、印の数を押させる。操作を教える。
 * - `line`: `line` の空いたマスが1つになった所で、印のマスに足りない数を自分で選ばせる。
 * - `search`: 空いたマスが1つの列を自分で探させる。どの列で見つけてもよい。
 */
export type MagicSquareTutorialStep = TutorialStep<MagicSquareTutorialRuleId> &
  (
    | { kind: "operation"; cellIndex: number; value: number }
    | { kind: "line"; cellIndex: number; line: MagicSquareLine }
    | { kind: "search" }
  );

/**
 * 直前の手。`fitsStep` は手順を終えた手、`decidingLine` はその手の数を決めた列（決め手）。
 * 手順を終えた後、次の印を出すまでの間、決め手の列を見せるのに使う。
 */
export type MagicSquareTutorialMove = {
  cellIndex: number;
  fitsStep: boolean;
  decidingLine: MagicSquareLine | null;
};

export type MagicSquareTutorialBoardState = {
  puzzleState: MagicSquareState;
  selectedCellIndex: number | null;
  lastMove: MagicSquareTutorialMove | null;
};

export type MagicSquareTutorialSituation = TutorialSituation<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialStep
>;

/**
 * どの列も空いたマスが2つの盤面。左上に数を入れると、1行目・1列目・左上からの斜めの空いたマスが1つずつになり、
 * 横・縦・斜めの順に1つずつ決まる。
 */
const givens = parseMagicSquareBoard([
  ". 4 5 .",
  "9 . . 16",
  ". 13 12 .",
  "3 . . 6",
]);
const solution = parseMagicSquareBoard([
  "14 4 5 11",
  "9 2 7 16",
  "8 13 12 1",
  "3 15 10 6",
]);

const { size } = givens;
const magicSum = getMagicSquareMagicSum(size);
const maxValue = getMagicSquareMaxValue(size);
const lines = listMagicSquareLines(size);

function cellAt(oneBasedRow: number, oneBasedColumn: number): number {
  return (oneBasedRow - 1) * size + (oneBasedColumn - 1);
}

function getSolutionValue(cellIndex: number): number {
  const value = solution.cells[cellIndex];
  if (value === null || value === undefined) {
    throw new RangeError(
      `Magic square tutorial has no solution at ${cellIndex}`,
    );
  }
  return value;
}

const lineKindNames = {
  row: "横の列",
  column: "縦の列",
  diagonal: "斜めの列",
} as const satisfies Record<MagicSquareTutorialRuleId, string>;

const lineStepMessages = {
  row: {
    headline: `横の4つの数を足すと${magicSum}になります`,
    detail: `右に今の合計が出ます\n${magicSum}に足りない数を入れます`,
  },
  column: {
    headline: `縦の4つの数も足すと${magicSum}になります`,
    detail: `下に今の合計が出ます\n${magicSum}に足りない数を入れます`,
  },
  diagonal: {
    headline: `斜めの4つの数も足すと${magicSum}になります`,
    detail: `右下の角に今の合計が出ます\n${magicSum}に足りない数を入れます`,
  },
} as const satisfies Record<MagicSquareTutorialRuleId, TutorialMessage>;

const searchMessage: TutorialMessage = {
  headline: "空いたマスが1つの列を探します",
  detail: `その列で${magicSum}に足りない数を入れます`,
};

function createLineStep(
  cellIndex: number,
  line: MagicSquareLine,
): MagicSquareTutorialStep {
  return {
    kind: "line",
    message: lineStepMessages[line.kind],
    introducedRuleId: line.kind,
    cellIndex,
    line,
  };
}

const operationCellIndex = cellAt(1, 1);
const operationValue = getSolutionValue(operationCellIndex);

const steps: readonly MagicSquareTutorialStep[] = [
  {
    kind: "operation",
    message: {
      headline: "マスを選んで下の数を押します",
      detail: `印のマスに${operationValue}を入れます`,
    },
    introducedRuleId: null,
    cellIndex: operationCellIndex,
    value: operationValue,
  },
  createLineStep(cellAt(1, 4), { kind: "row", index: 0 }),
  createLineStep(cellAt(3, 1), { kind: "column", index: 0 }),
  createLineStep(cellAt(2, 2), { kind: "diagonal", from: "top-left" }),
  { kind: "search", message: searchMessage, introducedRuleId: null },
];

function isEarnedLine(
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  line: MagicSquareLine,
): boolean {
  return earnedRuleIds.includes(line.kind);
}

function isWrongCell(state: MagicSquareState, cellIndex: number): boolean {
  const cell = state.cells[cellIndex] ?? null;
  return cell !== null && cell !== solution.cells[cellIndex];
}

function listWrongCellIndices(state: MagicSquareState): number[] {
  return state.cells.flatMap((_, cellIndex) =>
    isWrongCell(state, cellIndex) ? [cellIndex] : [],
  );
}

/** 答えと違う数を除いた盤面。決め手は、正しく入れた数と最初から置いてある数だけから読む。 */
function keepCorrectCells(state: MagicSquareState): MagicSquareBoard {
  return {
    size,
    cells: state.cells.map((cell, cellIndex) =>
      isWrongCell(state, cellIndex) ? null : cell,
    ),
  };
}

function countEmptyCells(board: MagicSquareBoard, line: MagicSquareLine) {
  return getMagicSquareLineCellIndices(size, line).filter(
    (cellIndex) => board.cells[cellIndex] === null,
  ).length;
}

/**
 * 空いたマスがそのマスだけの列のうち、手に入れたルールの列。最初に見つかった1本を、そのマスの数の決め手とする。
 * どの列も空いたマスが2つ以上なら `null`。
 */
export function findMagicSquareTutorialDecidingLine(
  board: MagicSquareBoard,
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  cellIndex: number,
): MagicSquareLine | null {
  if (board.cells[cellIndex] !== null) {
    return null;
  }
  return (
    listMagicSquareLinesThroughCell(size, cellIndex).find(
      (line) =>
        isEarnedLine(earnedRuleIds, line) && countEmptyCells(board, line) === 1,
    ) ?? null
  );
}

/**
 * 盤面に見せる列の状態。まだ伝えていない向きの列には、違反を出さない。
 * 伝えた向きの列の違反に必ず伴うものでもないので、その列だけを、そろっていない列として見せる。
 */
export function listMagicSquareTutorialLineEvaluations(
  { earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): MagicSquareLineEvaluation[] {
  return listMagicSquareLineEvaluations(state.puzzleState).map((evaluation) =>
    isMagicSquareLineViolation(evaluation.status) &&
    !isEarnedLine(earnedRuleIds, evaluation.line)
      ? { ...evaluation, status: "incomplete" }
      : evaluation,
  );
}

function findVisibleViolation(
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  puzzleState: MagicSquareState,
): MagicSquareLineEvaluation | null {
  return (
    listMagicSquareLineEvaluations(puzzleState).find(
      ({ line, status }) =>
        isEarnedLine(earnedRuleIds, line) && isMagicSquareLineViolation(status),
    ) ?? null
  );
}

/** 手順の間に選べるマス。違う数が入っている間は、そのマスを直させる。 */
export function isMagicSquareTutorialCellSelectable(
  { step }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
  cellIndex: number,
): boolean {
  if (step === null) {
    return true;
  }
  const wrongCellIndices = listWrongCellIndices(state.puzzleState);
  if (wrongCellIndices.length > 0) {
    return wrongCellIndices.includes(cellIndex);
  }
  if (step.kind !== "search") {
    return step.cellIndex === cellIndex;
  }
  return (
    state.puzzleState.cells[cellIndex] === null &&
    !isMagicSquareGivenCell(givens, cellIndex)
  );
}

/** 手順のマスに答えの数が入ったか。探す手順では、入れたマスの数がその時点で決まっていたか。 */
function completesStep(
  step: MagicSquareTutorialStep,
  cellIndex: number,
  decidingLine: MagicSquareLine | null,
): boolean {
  return step.kind === "search"
    ? decidingLine !== null
    : step.cellIndex === cellIndex;
}

function getDecidingLine(
  step: MagicSquareTutorialStep | null,
  before: MagicSquareTutorialBoardState,
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  cellIndex: number,
): MagicSquareLine | null {
  if (step?.kind === "operation") {
    return null;
  }
  if (step?.kind === "line") {
    return step.line;
  }
  return findMagicSquareTutorialDecidingLine(
    keepCorrectCells(before.puzzleState),
    earnedRuleIds,
    cellIndex,
  );
}

function selectCell(
  situation: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
  cellIndex: number,
): { state: MagicSquareTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (
    cellIndex === state.selectedCellIndex ||
    !isMagicSquareTutorialCellSelectable(situation, state, cellIndex)
  ) {
    return { state, outcome: "ignored" };
  }
  const next = { ...state, selectedCellIndex: cellIndex, lastMove: null };
  return {
    state: next,
    outcome:
      findVisibleViolation(situation.earnedRuleIds, state.puzzleState) === null
        ? "continued"
        : "violated",
  };
}

function enterValue(
  { step, earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
  value: number,
): { state: MagicSquareTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { selectedCellIndex: cellIndex } = state;
  if (
    cellIndex === null ||
    (step?.kind === "operation" && value !== step.value) ||
    !isMagicSquareTutorialCellSelectable(
      { step, earnedRuleIds },
      state,
      cellIndex,
    ) ||
    (step?.kind === "search" &&
      !isWrongCell(state.puzzleState, cellIndex) &&
      findMagicSquareTutorialDecidingLine(
        keepCorrectCells(state.puzzleState),
        earnedRuleIds,
        cellIndex,
      ) === null)
  ) {
    return { state, outcome: "ignored" };
  }
  const puzzleState = enterMagicSquareValue(
    givens,
    state.puzzleState,
    cellIndex,
    value,
  );
  if (puzzleState === state.puzzleState) {
    return { state, outcome: "ignored" };
  }
  const correct = puzzleState.cells[cellIndex] === solution.cells[cellIndex];
  const decidingLine = correct
    ? getDecidingLine(step, state, earnedRuleIds, cellIndex)
    : null;
  const fitsStep =
    step !== null && correct && completesStep(step, cellIndex, decidingLine);
  const next: MagicSquareTutorialBoardState = {
    puzzleState,
    selectedCellIndex: fitsStep ? null : cellIndex,
    lastMove: { cellIndex, fitsStep, decidingLine },
  };
  if (isMagicSquareSolved(puzzleState)) {
    return {
      state: { ...next, selectedCellIndex: null },
      outcome: "solved",
    };
  }
  if (findVisibleViolation(earnedRuleIds, puzzleState) !== null) {
    return { state: next, outcome: "violated" };
  }
  return { state: next, outcome: fitsStep ? "stepped" : "continued" };
}

function describeLines(lineKinds: readonly MagicSquareTutorialRuleId[]) {
  return [...new Set(lineKinds)].map((kind) => lineKindNames[kind]).join("と");
}

/**
 * 違反の一言。何に当たったかを、違反の出た列と合計で言う。
 * 直すマスを選んでいなければ、印を付けたそのマスを選ぶところから言う。
 */
function describeMagicSquareTutorialViolation(
  { earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): TutorialMessage {
  const violation = findVisibleViolation(earnedRuleIds, state.puzzleState);
  const lineName = violation ? lineKindNames[violation.line.kind] : "列";
  const wrongCellSelected =
    state.selectedCellIndex !== null &&
    state.selectedCellIndex === findMagicSquareTutorialWrongCellIndex(state);
  const detail = wrongCellSelected
    ? "別の数を押すと入れ直せます"
    : "印のマスを選んで\n別の数を押すと入れ直せます";
  if (violation?.status === "overreached") {
    const reached = violation.sum > magicSum ? "を超えました" : "になりました";
    return {
      headline: `この${lineName}は空いたマスがあるのに\n合計が${magicSum}${reached}`,
      detail,
    };
  }
  return {
    headline: `この${lineName}は合計が${magicSum}になっていません`,
    detail,
  };
}

/**
 * 探す手順で選んだマスへの一言。空いたマスが1つの列のマスなら、その列の向きの手順と同じ一言にする。
 * どの列も空いたマスが2つ以上なら、そのことと探し方を言う。マスを選んでいなければ `null`。
 */
export function describeMagicSquareTutorialSelection(
  { step, earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): TutorialMessage | null {
  const { selectedCellIndex } = state;
  if (step?.kind !== "search" || selectedCellIndex === null) {
    return null;
  }
  const board = keepCorrectCells(state.puzzleState);
  const decidingLine = findMagicSquareTutorialDecidingLine(
    board,
    earnedRuleIds,
    selectedCellIndex,
  );
  if (decidingLine !== null) {
    return lineStepMessages[decidingLine.kind];
  }
  if (board.cells[selectedCellIndex] !== null) {
    return null;
  }
  const lineNames = describeLines(
    listMagicSquareLinesThroughCell(size, selectedCellIndex).map(
      ({ kind }) => kind,
    ),
  );
  return {
    headline: `このマスを通る${lineNames}は\n空いたマスが2つ以上あります`,
    detail: "空いたマスが1つの列を探します",
  };
}

/** 違う数を入れたマス。直前の手のマスを先に返す。無ければ `null`。 */
export function findMagicSquareTutorialWrongCellIndex(
  state: MagicSquareTutorialBoardState,
): number | null {
  const wrongCellIndices = listWrongCellIndices(state.puzzleState);
  const lastCellIndex = state.lastMove?.cellIndex;
  return lastCellIndex !== undefined && wrongCellIndices.includes(lastCellIndex)
    ? lastCellIndex
    : (wrongCellIndices[0] ?? null);
}

export type MagicSquareTutorialHint =
  | { kind: "wrong-value"; cellIndex: number; message: TutorialMessage }
  | {
      kind: "line";
      cellIndex: number;
      line: MagicSquareLine;
      message: TutorialMessage;
    };

/**
 * 手を離した後に「ヒント」で見せる手がかり。違う数があればそのマス、無ければ空いたマスが1つの列。
 * 違う数は、列の合計に表れないまま残っていると、ほかのマスの読みを狂わせるので先に直させる。
 */
export function findMagicSquareTutorialHint(
  { earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): MagicSquareTutorialHint | null {
  const wrongCellIndex = findMagicSquareTutorialWrongCellIndex(state);
  if (wrongCellIndex !== null) {
    return {
      kind: "wrong-value",
      cellIndex: wrongCellIndex,
      message: {
        headline: "印のマスの数が違います",
        detail: "印のマスを選んで\n別の数を押すと入れ直せます",
      },
    };
  }
  const board = keepCorrectCells(state.puzzleState);
  for (const line of lines) {
    if (!isEarnedLine(earnedRuleIds, line)) {
      continue;
    }
    const [cellIndex, ...others] = getMagicSquareLineCellIndices(
      size,
      line,
    ).filter((lineCellIndex) => board.cells[lineCellIndex] === null);
    if (cellIndex !== undefined && others.length === 0) {
      return {
        kind: "line",
        cellIndex,
        line,
        message: lineStepMessages[line.kind],
      };
    }
  }
  return null;
}

/** 空いていたマスのうち、答えの数を入れたマスの割合。 */
export function getMagicSquareTutorialProgressRatio({
  puzzleState,
}: MagicSquareTutorialBoardState): number {
  const emptyCellIndices = givens.cells.flatMap((cell, cellIndex) =>
    cell === null ? [cellIndex] : [],
  );
  const solvedCount = emptyCellIndices.filter(
    (cellIndex) => puzzleState.cells[cellIndex] === solution.cells[cellIndex],
  ).length;
  return solvedCount / emptyCellIndices.length;
}

export const MAGIC_SQUARE_TUTORIAL_PROGRESS_STEP_COUNT = givens.cells.filter(
  (cell) => cell === null,
).length;

export const magicSquareTutorialPuzzle: { givens: MagicSquareBoard } = {
  givens,
};

function createBoardState(cells: MagicSquareBoard["cells"]) {
  return {
    puzzleState: { ...createMagicSquareInitialState(givens), cells },
    selectedCellIndex: null,
    lastMove: null,
  } satisfies MagicSquareTutorialBoardState;
}

export const magicSquareTutorial: Tutorial<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialStep,
  MagicSquareTutorialBoardState,
  MagicSquareTutorialAction
> = {
  intro: {
    purpose: `1〜${maxValue}を1つずつ入れて\n縦・横・斜めの合計を全て同じにするパズルです`,
    goalCaption: `列の端に合計が出ます\n全て${magicSum}になると完成です`,
  },
  rules: [
    { id: "row", label: `横の4つの数を足すと${magicSum}になります` },
    { id: "column", label: `縦の4つの数を足すと${magicSum}になります` },
    { id: "diagonal", label: `斜めの4つの数を足すと${magicSum}になります` },
  ],
  steps,
  freePlay: {
    headline: "残りも埋めてみましょう",
    detail: `空いたマスが1つの列を探して\n${magicSum}に足りない数を入れます`,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番も空いたマスが1つの列から埋めていくと進められます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
    },
  },
  start: () => createBoardState(givens.cells),
  goal: () => createBoardState(solution.cells),
  perform(situation, state, action) {
    return action.type === "select"
      ? selectCell(situation, state, action.cellIndex)
      : enterValue(situation, state, action.value);
  },
  describeViolation: describeMagicSquareTutorialViolation,
};

export const _private = {
  givens,
  solution,
  cellAt,
};
