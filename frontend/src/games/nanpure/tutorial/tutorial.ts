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
export type NanpureTutorialMarkedCellStep =
  TutorialStep<NanpureTutorialRuleId> & {
    kind: "marked-cell";
    cuedCellIndex: number;
    reasonUnits: readonly NanpureTutorialUnit[];
    cuedDigit: NanpureDigit | null;
  };

export type NanpureTutorialPlacementStep =
  TutorialStep<NanpureTutorialRuleId> & {
    kind: "placement";
    digit: NanpureDigit;
    block: NanpureTutorialUnit;
    cellIndex: number;
  };

export type NanpureTutorialStep =
  | NanpureTutorialMarkedCellStep
  | NanpureTutorialPlacementStep;

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

type NanpureLastEmptyDeduction = {
  digit: NanpureDigit;
  unit: NanpureTutorialUnit;
};

/** `eliminatingCellIndices` は、ブロックの空きマスと同じ行・列にあり、そこに `digit` が入らないと分からせる `digit` のマス。 */
export type NanpureTutorialPlacement = {
  digit: NanpureDigit;
  block: NanpureTutorialUnit;
  cellIndex: number;
  eliminatingCellIndices: readonly number[];
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
  "658.29314",
  "3..456278",
  "72.3.1965",
  "467215893",
  "58.937..1",
  "139.6.5..",
  "245193786",
  "8..6421.9",
  "91.578..2",
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

const unitNames = {
  row: "行",
  column: "列",
  block: "ブロック",
} as const satisfies Record<NanpureTutorialRuleId, string>;

const ruleStepMessages = {
  row: {
    headline: "全ての行に1〜9が1つずつ入ります",
    detail: "この行にまだ無い数字を入れます",
  },
  column: {
    headline: "全ての列に1〜9が1つずつ入ります",
    detail: "この列にまだ無い数字を入れます",
  },
  block: {
    headline: "太線で区切ったブロックにも\n1〜9が1つずつ入ります",
    detail: "このブロックにまだ無い\n数字を入れます",
  },
} as const satisfies Record<NanpureTutorialRuleId, TutorialMessage>;

function describePlacementSearch(digit: NanpureDigit): TutorialMessage {
  return {
    headline: `このブロックで${digit}が入るマスを探します`,
    detail: `${digit}がある行と列を除いて探します`,
  };
}

function describePlacementHint(digit: NanpureDigit): TutorialMessage {
  return {
    headline: `このブロックで${digit}が入るマスを\n探します`,
    detail: `${digit}がある行と列を除いて探します`,
  };
}

function createRuleStep(
  kind: NanpureTutorialRuleId,
  cellIndex: number,
): NanpureTutorialMarkedCellStep {
  return {
    kind: "marked-cell",
    message: ruleStepMessages[kind],
    introducedRuleId: kind,
    cuedCellIndex: cellIndex,
    reasonUnits: [getCellUnit(cellIndex, kind)],
    cuedDigit: null,
  };
}

function createPlacementStep(cellIndex: number): NanpureTutorialPlacementStep {
  const digit = getSolutionDigit(cellIndex);
  return {
    kind: "placement",
    message: describePlacementSearch(digit),
    introducedRuleId: null,
    digit,
    block: getCellUnit(cellIndex, "block"),
    cellIndex,
  };
}

const operationCellIndex = cellAt(3, 5);
const operationDigit = getSolutionDigit(operationCellIndex);

/**
 * 操作で入れる3行5列の8で、3行目の空きは3行3列だけになる。
 * ブロックの手順で入れた5行3列の2も、最後の手順で2の置き場所を絞る数字の1つになる。
 */
const steps: readonly NanpureTutorialStep[] = [
  {
    kind: "marked-cell",
    message: {
      headline: "マスを選んで下の数字を押します",
      detail: `印のマスに${operationDigit}を入れます`,
    },
    introducedRuleId: null,
    cuedCellIndex: operationCellIndex,
    reasonUnits: [],
    cuedDigit: operationDigit,
  },
  createRuleStep("row", cellAt(3, 3)),
  createRuleStep("column", cellAt(6, 6)),
  createRuleStep("block", cellAt(5, 3)),
  createPlacementStep(cellAt(6, 8)),
];

function isGiven(cellIndex: number): boolean {
  return (givens[cellIndex] ?? null) !== null;
}

function listEarnedKinds(
  earnedRuleIds: readonly NanpureTutorialRuleId[],
): NanpureTutorialRuleId[] {
  return ruleIds.filter((kind) => earnedRuleIds.includes(kind));
}

function deduceLastEmptyCell(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
  cellIndex: number,
): NanpureLastEmptyDeduction | null {
  if (board[cellIndex] !== null) {
    return null;
  }
  for (const kind of listEarnedKinds(earnedRuleIds)) {
    const [digit, ...others] = getNanpureCandidates(board, cellIndex, [kind]);
    if (digit !== undefined && others.length === 0) {
      return { digit, unit: getCellUnit(cellIndex, kind) };
    }
  }
  return null;
}

function findDigitCellIndices(
  board: NanpureBoard,
  unit: NanpureTutorialUnit,
  digit: NanpureDigit,
): number[] {
  return getNanpureTutorialUnitCellIndices(unit).filter(
    (cellIndex) => board[cellIndex] === digit,
  );
}

function findCrossingDigitCellIndices(
  board: NanpureBoard,
  cellIndex: number,
  digit: NanpureDigit,
): number[] {
  return (["row", "column"] as const).flatMap((kind) =>
    findDigitCellIndices(board, getCellUnit(cellIndex, kind), digit),
  );
}

function findEmptyCellIndices(
  board: NanpureBoard,
  unit: NanpureTutorialUnit,
): number[] {
  return getNanpureTutorialUnitCellIndices(unit).filter(
    (cellIndex) => board[cellIndex] === null,
  );
}

function findEliminatingCellIndices(
  board: NanpureBoard,
  block: NanpureTutorialUnit,
  digit: NanpureDigit,
): number[] {
  const cellIndices = new Set(
    findEmptyCellIndices(board, block).flatMap((cellIndex) =>
      findCrossingDigitCellIndices(board, cellIndex, digit),
    ),
  );
  return [...cellIndices].sort((left, right) => left - right);
}

function findPlacement(
  board: NanpureBoard,
  blockIndex: number,
  digit: NanpureDigit,
): NanpureTutorialPlacement | null {
  const block: NanpureTutorialUnit = { kind: "block", index: blockIndex };
  if (findDigitCellIndices(board, block, digit).length > 0) {
    return null;
  }
  const [cellIndex, ...others] = findEmptyCellIndices(board, block).filter(
    (emptyCellIndex) =>
      findCrossingDigitCellIndices(board, emptyCellIndex, digit).length === 0,
  );
  return cellIndex !== undefined && others.length === 0
    ? {
        digit,
        block,
        cellIndex,
        eliminatingCellIndices: findEliminatingCellIndices(board, block, digit),
      }
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
  const deduction = deduceLastEmptyCell(board, earnedRuleIds, cellIndex);
  return deduction?.digit === digit ? [deduction.unit] : [];
}

function startNanpureTutorial(): NanpureTutorialBoardState {
  return { board: givens, moveCount: 0, lastMove: null };
}

function getNanpureTutorialGoal(): NanpureTutorialBoardState {
  return { board: solution, moveCount: 0, lastMove: null };
}

function getStepAnswerCellIndex(step: NanpureTutorialStep): number {
  return step.kind === "marked-cell" ? step.cuedCellIndex : step.cellIndex;
}

function isOutsideStep(
  step: NanpureTutorialStep | null,
  { cellIndex, digit }: NanpureTutorialAction,
): boolean {
  if (step === null) {
    return false;
  }
  if (getStepAnswerCellIndex(step) !== cellIndex) {
    return true;
  }
  return (
    step.kind === "marked-cell" &&
    step.cuedDigit !== null &&
    step.cuedDigit !== digit
  );
}

function performNanpureTutorialAction(
  { step, earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  action: NanpureTutorialAction,
): { state: NanpureTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { cellIndex, digit } = action;
  const current = state.board[cellIndex];
  if (
    current === undefined ||
    current === digit ||
    isGiven(cellIndex) ||
    isOutsideStep(step, action)
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
      detail: "印のマスを選んで\n別の数字を入れます",
    };
  }
  const unitNameList = units.map((unit) => unitNames[unit.kind]).join("と");
  return {
    headline: `この${unitNameList}にはもう${lastMove.digit}があります`,
    detail: "別の数字を押すと入れ直せます",
  };
}

/** 直前に入れた数字が、どこにも重ならないのに答えと違うときの一言。そうでなければ `null`。 */
export function describeNanpureTutorialMistake({
  lastMove,
}: NanpureTutorialBoardState): TutorialMessage | null {
  if (
    !lastMove ||
    lastMove.violated ||
    lastMove.digit === getSolutionDigit(lastMove.cellIndex)
  ) {
    return null;
  }
  return {
    headline: `${lastMove.digit}は別のマスに入ります`,
    detail: "本番では入れ間違いが\nミスに数えられます",
  };
}

export const NANPURE_TUTORIAL_GIVENS = givens;

export const NANPURE_TUTORIAL_PROGRESS_STEP_COUNT = givens.filter(
  (cell) => cell === null,
).length;

/** 空いていたマスのうち、解の数字を入れたマスの割合。 */
export function getNanpureTutorialProgressRatio({
  board,
}: NanpureTutorialBoardState): number {
  const solvedCount = board.filter(
    (cell, cellIndex) =>
      givens[cellIndex] === null && cell === solution[cellIndex],
  ).length;
  return solvedCount / NANPURE_TUTORIAL_PROGRESS_STEP_COUNT;
}

export function isNanpureTutorialCellSelectable(
  { step }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  cellIndex: number,
): boolean {
  if (step === null) {
    return true;
  }
  return step.kind === "marked-cell"
    ? step.cuedCellIndex === cellIndex
    : findEmptyCellIndices(keepCorrectDigits(state.board), step.block).includes(
        cellIndex,
      );
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
  return step?.kind === "marked-cell" &&
    state.board[step.cuedCellIndex] !== solution[step.cuedCellIndex]
    ? step.cuedCellIndex
    : null;
}

export type NanpureTutorialFocus = {
  cellIndices: readonly number[];
  units: readonly NanpureTutorialUnit[];
};

export function getNanpureTutorialStepFocus(
  { step }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): NanpureTutorialFocus | null {
  if (step === null) {
    return null;
  }
  return step.kind === "marked-cell"
    ? { cellIndices: [step.cuedCellIndex], units: step.reasonUnits }
    : {
        cellIndices: findEliminatingCellIndices(
          keepCorrectDigits(state.board),
          step.block,
          step.digit,
        ),
        units: [step.block],
      };
}

export function describeNanpureTutorialStep(
  situation: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  selectedCellIndex: number | null,
): TutorialMessage | null {
  const { step } = situation;
  if (
    step === null ||
    step.kind === "marked-cell" ||
    selectedCellIndex === null ||
    !isNanpureTutorialCellSelectable(situation, state, selectedCellIndex)
  ) {
    return step?.message ?? null;
  }
  const { digit } = step;
  if (selectedCellIndex === step.cellIndex) {
    return {
      headline: `ここが${digit}の入るマスです`,
      detail: `下の${digit}を押します`,
    };
  }
  const board = keepCorrectDigits(state.board);
  const unitNameList = (["row", "column"] as const)
    .filter(
      (kind) =>
        findDigitCellIndices(board, getCellUnit(selectedCellIndex, kind), digit)
          .length > 0,
    )
    .map((kind) => unitNames[kind])
    .join("と");
  return {
    headline: `この${unitNameList}にはもう${digit}があります`,
    detail: "ほかのマスを選びます",
  };
}

export function getNanpureTutorialCuedDigit(
  { step }: NanpureTutorialSituation,
  selectedCellIndex: number | null,
): NanpureDigit | null {
  if (step === null || selectedCellIndex !== getStepAnswerCellIndex(step)) {
    return null;
  }
  return step.kind === "placement" ? step.digit : step.cuedDigit;
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

export type NanpureTutorialHint =
  | { kind: "wrong-digit"; cellIndex: number }
  | {
      kind: "last-empty";
      cellIndex: number;
      unit: NanpureTutorialUnit;
      message: TutorialMessage;
    }
  | {
      kind: "placement";
      placement: NanpureTutorialPlacement;
      message: TutorialMessage;
    };

function findLastEmptyHint(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
): NanpureTutorialHint | null {
  for (const cellIndex of allCellIndices) {
    const deduction = deduceLastEmptyCell(board, earnedRuleIds, cellIndex);
    if (deduction) {
      return {
        kind: "last-empty",
        cellIndex,
        unit: deduction.unit,
        message: ruleStepMessages[deduction.unit.kind],
      };
    }
  }
  return null;
}

function findPlacementHint(board: NanpureBoard): NanpureTutorialHint | null {
  for (const blockIndex of unitCellIndices.block.keys()) {
    for (const digit of NANPURE_DIGITS) {
      const placement = findPlacement(board, blockIndex, digit);
      if (placement) {
        return {
          kind: "placement",
          placement,
          message: describePlacementHint(digit),
        };
      }
    }
  }
  return null;
}

export function findNanpureTutorialHint(
  situation: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): NanpureTutorialHint | null {
  const wrongCellIndex = findNanpureTutorialWrongCellIndex(situation, state);
  if (wrongCellIndex !== null) {
    return { kind: "wrong-digit", cellIndex: wrongCellIndex };
  }
  return (
    findLastEmptyHint(state.board, situation.earnedRuleIds) ??
    findPlacementHint(state.board)
  );
}

export const nanpureTutorial: Tutorial<
  NanpureTutorialRuleId,
  NanpureTutorialStep,
  NanpureTutorialBoardState,
  NanpureTutorialAction
> = {
  intro: {
    purpose: "空いたマスに1〜9の数字を入れて\n盤面を完成させるパズルです",
    goalCaption: "紫の数字を入れていきます",
  },
  rules: [
    { id: "row", label: "全ての行に1〜9が1つずつ入ります" },
    { id: "column", label: "全ての列に1〜9が1つずつ入ります" },
    { id: "block", label: "全てのブロックに1〜9が1つずつ入ります" },
  ],
  steps,
  freePlay: {
    headline: "残りも埋めてみましょう",
    detail: "ブロックごとに数字が入るマスを探します",
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番もブロックごとに数字が入るマスを探すと進められます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
    },
  },
  start: startNanpureTutorial,
  goal: getNanpureTutorialGoal,
  perform: performNanpureTutorialAction,
  describeViolation: describeNanpureTutorialViolation,
};

export const _private = {
  givens,
  solution,
  cellAt,
  getStepAnswerCellIndex,
  deduceLastEmptyCell,
  findPlacement,
};
