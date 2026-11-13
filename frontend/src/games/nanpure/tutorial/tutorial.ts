import {
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  isNanpureDigit,
  NANPURE_CELL_COUNT,
  NANPURE_DIGITS,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureCell,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import {
  findNanpureConflictCellIndices,
  getNanpureCandidates,
  isNanpureSolved,
  NANPURE_UNIT_KINDS,
  type NanpureUnitKind,
} from "@/games/nanpure/puzzle/rules";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type NanpureTutorialRuleId = NanpureUnitKind;

/** `index` は0始まりで、ブロックは左上から行優先に数える。 */
export type NanpureTutorialUnit = {
  kind: NanpureTutorialRuleId;
  index: number;
};

/** マスを選ぶだけの操作は盤面を変えないので、ここでは扱わない。 */
export type NanpureTutorialAction = {
  cellIndex: number;
  digit: NanpureDigit;
};

/**
 * - `cuedCellIndex`: 手順の間はこのマスだけを選べる。
 * - `reasonUnits`: 印のマスの数字を決める行・列・ブロック（決め手）。
 * - `cuedDigit`: 押させる数字。操作を教える手順でだけ、数字のボタンにも印を付ける。
 */
export type NanpureTutorialStep = TutorialStep<NanpureTutorialRuleId> & {
  cuedCellIndex: number;
  reasonUnits: readonly NanpureTutorialUnit[];
  cuedDigit: NanpureDigit | null;
};

export type NanpureTutorialMove = {
  cellIndex: number;
  digit: NanpureDigit;
  violated: boolean;
  fitsStep: boolean;
  reasonUnits: readonly NanpureTutorialUnit[];
};

/** `moveCount` は、同じマスへの合図をやり直す目印に使う。 */
export type NanpureTutorialBoardState = {
  board: NanpureBoard;
  moveCount: number;
  lastMove: NanpureTutorialMove | null;
};

export type NanpureTutorialSituation = TutorialSituation<
  NanpureTutorialRuleId,
  NanpureTutorialStep
>;

type NanpureDeduction = {
  digit: NanpureDigit;
  reasonUnits: readonly NanpureTutorialUnit[];
};

function parseRows(rows: readonly string[]): NanpureCell[] {
  return rows.flatMap((row) =>
    Array.from(row, (character) => {
      const digit = Number(character);
      return isNanpureDigit(digit) ? digit : null;
    }),
  );
}

/** 本番の問題集の解を使う。 */
const givens: NanpureBoard = parseRows([
  "658729314",
  "3.145.278",
  "7243..96.",
  "46721.89.",
  "582937641",
  "13.86452.",
  ".4.193786",
  "8736.2159",
  "916578432",
]);
const solution: NanpureBoard = parseRows([
  "658729314",
  "391456278",
  "724381965",
  "467215893",
  "582937641",
  "139864527",
  "245193786",
  "873642159",
  "916578432",
]);

function cellAt(oneBasedRow: number, oneBasedColumn: number): number {
  return (oneBasedRow - 1) * NANPURE_SIZE + (oneBasedColumn - 1);
}

function getSolutionDigit(cellIndex: number): NanpureDigit {
  const digit = solution[cellIndex];
  if (digit === null || digit === undefined) {
    throw new RangeError(`Nanpure tutorial has no solution at ${cellIndex}`);
  }
  return digit;
}

const ruleIds = NANPURE_UNIT_KINDS;

const unitIndexGetters = {
  row: getNanpureRowIndex,
  column: getNanpureColumnIndex,
  block: getNanpureBlockIndex,
} as const satisfies Record<
  NanpureTutorialRuleId,
  (cellIndex: number) => number
>;

const allCellIndices = Array.from(
  { length: NANPURE_CELL_COUNT },
  (_, cellIndex) => cellIndex,
);

function getCellUnit(
  cellIndex: number,
  kind: NanpureTutorialRuleId,
): NanpureTutorialUnit {
  return { kind, index: unitIndexGetters[kind](cellIndex) };
}

function listUnitCellIndices(kind: NanpureTutorialRuleId): number[][] {
  return Array.from({ length: NANPURE_SIZE }, (_, index) =>
    allCellIndices.filter(
      (cellIndex) => unitIndexGetters[kind](cellIndex) === index,
    ),
  );
}

const unitCellIndices = {
  row: listUnitCellIndices("row"),
  column: listUnitCellIndices("column"),
  block: listUnitCellIndices("block"),
} as const satisfies Record<NanpureTutorialRuleId, readonly number[][]>;

export function getNanpureTutorialUnitCellIndices({
  kind,
  index,
}: NanpureTutorialUnit): readonly number[] {
  return unitCellIndices[kind][index] ?? [];
}

/** 操作で入れる6行3列の9で、6行目の空きは6行9列だけになる。 */
const steps: readonly NanpureTutorialStep[] = [
  {
    message: {
      headline: "マスを選んで、下の数字を押します",
      detail: `印の付いたマスに${getSolutionDigit(cellAt(6, 3))}を入れてください`,
    },
    introducedRuleId: null,
    cuedCellIndex: cellAt(6, 3),
    reasonUnits: [],
    cuedDigit: getSolutionDigit(cellAt(6, 3)),
  },
  {
    message: {
      headline: "どの行にも\n1〜9が1つずつ入ります",
      detail: "この行にない数字を入れてください",
    },
    introducedRuleId: "row",
    cuedCellIndex: cellAt(6, 9),
    reasonUnits: [getCellUnit(cellAt(6, 9), "row")],
    cuedDigit: null,
  },
  {
    message: {
      headline: "どの列にも\n1〜9が1つずつ入ります",
      detail: "この列にない数字を入れてください",
    },
    introducedRuleId: "column",
    cuedCellIndex: cellAt(7, 1),
    reasonUnits: [getCellUnit(cellAt(7, 1), "column")],
    cuedDigit: null,
  },
  {
    message: {
      headline: "太線で区切ったブロックにも\n1〜9が1つずつ入ります",
      detail: "このブロックにない数字を入れてください",
    },
    introducedRuleId: "block",
    cuedCellIndex: cellAt(4, 9),
    reasonUnits: [getCellUnit(cellAt(4, 9), "block")],
    cuedDigit: null,
  },
  {
    message: {
      headline: "行・列・ブロックを合わせると\n入る数字が1つに決まります",
      detail: "3つのどこにもない数字を入れてください",
    },
    introducedRuleId: null,
    cuedCellIndex: cellAt(3, 6),
    reasonUnits: ruleIds.map((kind) => getCellUnit(cellAt(3, 6), kind)),
    cuedDigit: null,
  },
];

function isGiven(cellIndex: number): boolean {
  return (givens[cellIndex] ?? null) !== null;
}

function listEarnedKinds(
  earnedRuleIds: readonly NanpureTutorialRuleId[],
): NanpureTutorialRuleId[] {
  return ruleIds.filter((kind) => earnedRuleIds.includes(kind));
}

/**
 * 空きマスの数字が、手に入れたルールだけで決まるか。入り得る数字は本番と同じ求め方で、手に入れたまとまりだけから求める。
 * まとまりで最後に空いたマスなら、そのまとまりに無い数字に決まる。決め手はそのまとまり。
 * それで決まらなければ、手に入れたまとまりを合わせて入らない数字を除き、残りが1つなら決まる。決め手は合わせたまとまり。
 */
function deduceCell(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
  cellIndex: number,
): NanpureDeduction | null {
  if (board[cellIndex] !== null) {
    return null;
  }
  const kinds = listEarnedKinds(earnedRuleIds);
  for (const kind of kinds) {
    const [digit, ...others] = getNanpureCandidates(board, cellIndex, [kind]);
    if (digit !== undefined && others.length === 0) {
      return { digit, reasonUnits: [getCellUnit(cellIndex, kind)] };
    }
  }

  const [digit, ...others] = getNanpureCandidates(board, cellIndex, kinds);
  return digit !== undefined && others.length === 0
    ? { digit, reasonUnits: kinds.map((kind) => getCellUnit(cellIndex, kind)) }
    : null;
}

function findVisibleConflictCellIndices(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
): number[] {
  return findNanpureConflictCellIndices(board, listEarnedKinds(earnedRuleIds));
}

function findConflictingUnits(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
  cellIndex: number,
): NanpureTutorialUnit[] {
  return listEarnedKinds(earnedRuleIds)
    .filter((kind) =>
      findNanpureConflictCellIndices(board, [kind]).includes(cellIndex),
    )
    .map((kind) => getCellUnit(cellIndex, kind));
}

function keepCorrectDigits(board: NanpureBoard): NanpureCell[] {
  return board.map((digit, cellIndex) =>
    digit === solution[cellIndex] ? digit : null,
  );
}

function getMoveReasonUnits(
  before: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
  { cellIndex, digit }: NanpureTutorialAction,
): readonly NanpureTutorialUnit[] {
  // 決め手は、正しく入れた数字と最初の数字だけから読む。
  const board = keepCorrectDigits(before);
  board[cellIndex] = null;
  const deduction = deduceCell(board, earnedRuleIds, cellIndex);
  return deduction?.digit === digit ? deduction.reasonUnits : [];
}

function startNanpureTutorial(): NanpureTutorialBoardState {
  return { board: givens, moveCount: 0, lastMove: null };
}

function getNanpureTutorialGoal(): NanpureTutorialBoardState {
  return { board: solution, moveCount: 0, lastMove: null };
}

function performNanpureTutorialAction(
  { step, earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  action: NanpureTutorialAction,
): { state: NanpureTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { cellIndex, digit } = action;
  const current = state.board[cellIndex];
  const outsideStep =
    step !== null &&
    (step.cuedCellIndex !== cellIndex ||
      (step.cuedDigit !== null && step.cuedDigit !== digit));
  if (
    current === undefined ||
    current === digit ||
    isGiven(cellIndex) ||
    outsideStep
  ) {
    return { state, outcome: "ignored" };
  }

  const board = [...state.board];
  board[cellIndex] = digit;
  const correct = digit === solution[cellIndex];
  const violated =
    !correct &&
    findVisibleConflictCellIndices(board, earnedRuleIds).includes(cellIndex);
  const next: NanpureTutorialBoardState = {
    board,
    moveCount: state.moveCount + 1,
    lastMove: {
      cellIndex,
      digit,
      violated,
      fitsStep: step !== null && correct,
      reasonUnits: correct
        ? getMoveReasonUnits(state.board, earnedRuleIds, action)
        : [],
    },
  };

  if (isNanpureSolved(board)) {
    return { state: next, outcome: "solved" };
  }
  // 前に入れた違う数字との重なりが残っていれば、正しい手でも、重なりを直させる一言を続ける。
  if (findVisibleConflictCellIndices(board, earnedRuleIds).length > 0) {
    return { state: next, outcome: "violated" };
  }
  if (step !== null && correct) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "continued" };
}

const unitNames = {
  row: "行",
  column: "列",
  block: "ブロック",
} as const satisfies Record<NanpureTutorialRuleId, string>;

/**
 * 直前の手は正しく、前に入れた違う数字との重なりが残っているなら、その違う数字のマスを直させる。マスには印を付ける。
 */
function describeNanpureTutorialViolation(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): TutorialMessage {
  const { lastMove } = state;
  const units = lastMove?.violated
    ? findConflictingUnits(state.board, earnedRuleIds, lastMove.cellIndex)
    : [];
  if (!lastMove || units.length === 0) {
    return {
      headline: "印のマスの数字が違います",
      detail: "印のマスを選んで、別の数字を押してください",
    };
  }
  const unitNameList = units.map((unit) => unitNames[unit.kind]).join("と");
  return {
    headline: `この${unitNameList}には、もう${lastMove.digit}があります`,
    detail: "別の数字を押すと変わります",
  };
}

export const NANPURE_TUTORIAL_GIVENS = givens;

export function isNanpureTutorialCellSelectable(
  { step }: NanpureTutorialSituation,
  cellIndex: number,
): boolean {
  return step === null || step.cuedCellIndex === cellIndex;
}

export function getNanpureTutorialConflictCellIndices(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number[] {
  return findVisibleConflictCellIndices(state.board, earnedRuleIds);
}

export function getNanpureTutorialMistakeCellIndices(
  state: NanpureTutorialBoardState,
): number[] {
  return allCellIndices.filter((cellIndex) => {
    const digit = state.board[cellIndex];
    return digit !== null && digit !== solution[cellIndex];
  });
}

export function getNanpureTutorialCompletedDigits(
  state: NanpureTutorialBoardState,
): NanpureDigit[] {
  return NANPURE_DIGITS.filter(
    (digit) =>
      state.board.filter(
        (cell, cellIndex) => cell === digit && solution[cellIndex] === digit,
      ).length === NANPURE_SIZE,
  );
}

export function getNanpureTutorialStepCellIndex(
  { step }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number | null {
  return step !== null &&
    state.board[step.cuedCellIndex] !== solution[step.cuedCellIndex]
    ? step.cuedCellIndex
    : null;
}

/** 重なった2つのマスのどちらが違うかは盤面だけでは分からないので、違反の一言と一緒に印で示す。 */
export function findNanpureTutorialWrongCellIndex(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number | null {
  const wrongCellIndices = getNanpureTutorialMistakeCellIndices(state);
  const conflictCellIndices = findVisibleConflictCellIndices(
    state.board,
    earnedRuleIds,
  );
  return (
    wrongCellIndices.find((cellIndex) =>
      conflictCellIndices.includes(cellIndex),
    ) ??
    wrongCellIndices[0] ??
    null
  );
}

/**
 * 手を離した後、手が止まったときに示すマス。
 * 答えと違う数字があれば、まずそれを直させる。無ければ、今の盤面と手に入れたルールだけで決まる空きマスを、
 * まとまりで最後に空いたマスから先に示す。無ければ `null`。
 */
export function findNanpureTutorialHintCellIndex(
  situation: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number | null {
  const { earnedRuleIds } = situation;
  const wrongCellIndex = findNanpureTutorialWrongCellIndex(situation, state);
  if (wrongCellIndex !== null) {
    return wrongCellIndex;
  }
  const deductions = allCellIndices.flatMap((cellIndex) => {
    const deduction = deduceCell(state.board, earnedRuleIds, cellIndex);
    return deduction ? [{ cellIndex, ...deduction }] : [];
  });
  const hint =
    deductions.find(({ reasonUnits }) => reasonUnits.length === 1) ??
    deductions[0];
  return hint?.cellIndex ?? null;
}

export const nanpureTutorial: Tutorial<
  NanpureTutorialRuleId,
  NanpureTutorialStep,
  NanpureTutorialBoardState,
  NanpureTutorialAction
> = {
  intro: {
    purpose: "空いたマスに1〜9の数字を入れて\n盤面を完成させるパズルです",
    goalCaption: "この盤面がゴールです",
    startCaption: "最初はいくつかのマスが空いています",
  },
  rules: [
    { id: "row", label: "行に1つずつ" },
    { id: "column", label: "列に1つずつ" },
    { id: "block", label: "ブロックに1つずつ" },
  ],
  steps,
  freePlay: {
    headline: "あとは残りを埋めれば完成です",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも同じルールです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
    },
  },
  start: startNanpureTutorial,
  goal: getNanpureTutorialGoal,
  perform: performNanpureTutorialAction,
  describeViolation: describeNanpureTutorialViolation,
};

export const _private = { givens, solution, cellAt, deduceCell };
