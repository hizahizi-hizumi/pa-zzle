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
import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * 1〜9が1つずつ入るまとまり。ルールは、まとまりの種類ごとに1つずつ示す。
 * - `row`: どの行にも1〜9が1つずつ入る。
 * - `column`: どの列にも1〜9が1つずつ入る。
 * - `block`: どの3×3ブロックにも1〜9が1つずつ入る。
 */
export type NanpureTutorialRuleId = "row" | "column" | "block";

/** 1つの行・列・ブロック。`index` は0始まりで、ブロックは左上から行優先に数える。 */
export type NanpureTutorialUnit = {
  kind: NanpureTutorialRuleId;
  index: number;
};

/** 盤面と同じく、選んだマスに数字を入れる。マスを選ぶだけの操作は盤面を変えないので、ここでは扱わない。 */
export type NanpureTutorialAction = {
  cellIndex: number;
  digit: NanpureDigit;
};

/**
 * - `cellIndex`: 印を付け、手順の間だけ選べるマス。解の数字が入ったら次の手順へ進む。
 * - `reasonUnits`: 印のマスの数字を決める行・列・ブロック。手順の始まりから示し、どこを見れば決まるかを盤面で分からせる。
 * - `cuedDigit`: 押させる数字。操作を教える手順でだけ、数字のボタンにも印を付ける。
 */
export type NanpureTutorialStep = TutorialStep<NanpureTutorialRuleId> & {
  cellIndex: number;
  reasonUnits: readonly NanpureTutorialUnit[];
  cuedDigit: NanpureDigit | null;
};

/**
 * 直前の手。盤面の上の合図に使う。
 * - `violated`: 入れた数字が、手に入れたルールのまとまりで、ほかの数字と重なった。
 * - `fitsStep`: 手を引いている手順のマスに、解の数字を入れた。手を離した後は常に `false`。
 * - `reasonUnits`: 入れた数字が手前の盤面だけで決まっていたときの、決め手の行・列・ブロック。決まっていなければ空。
 */
export type NanpureTutorialMove = {
  cellIndex: number;
  digit: NanpureDigit;
  violated: boolean;
  fitsStep: boolean;
  reasonUnits: readonly NanpureTutorialUnit[];
};

/** `moveCount`: 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。 */
export type NanpureTutorialBoardState = {
  board: NanpureBoard;
  moveCount: number;
  lastMove: NanpureTutorialMove | null;
};

/**
 * 手がかりとして示すマス。
 * - `cellIndex`: 示すマス。
 * - `reasonUnits`: そのマスの数字を決める行・列・ブロック。答えと違う数字を直させるときは空。
 */
export type NanpureTutorialHint = {
  cellIndex: number;
  reasonUnits: readonly NanpureTutorialUnit[];
};

type NanpureTutorialSituation = TutorialSituation<
  NanpureTutorialRuleId,
  NanpureTutorialStep
>;

/** 空きマスの数字が、今の盤面と手に入れたルールだけで決まるときの、その数字と決め手。 */
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

/**
 * 本番の問題集の解を使い、空きマスは12個にする。空きマスの解には1〜9がすべてあり、最初から押せない数字のボタンは無い。
 * 最初の盤面だけで、行・列・ブロックのルールの下で解はこの1つに決まる。
 *
 * ```text
 * 最初          解
 * 658 729 314   658 729 314
 * 3.1 45. 278   391 456 278
 * 724 3.. 96.   724 381 965
 * 467 21. 89.   467 215 893
 * 582 937 641   582 937 641
 * 13. 864 52.   139 864 527
 * .4. 193 786   245 193 786
 * 873 6.2 159   873 642 159
 * 916 578 432   916 578 432
 * ```
 */
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

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * NANPURE_SIZE + (column - 1);
}

function getSolutionDigit(cellIndex: number): NanpureDigit {
  const digit = solution[cellIndex];
  if (digit === null || digit === undefined) {
    throw new RangeError(`Nanpure tutorial has no solution at ${cellIndex}`);
  }
  return digit;
}

const ruleIds = [
  "row",
  "column",
  "block",
] as const satisfies readonly NanpureTutorialRuleId[];

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

/** まとまりの種類ごとの、0〜8番目のまとまりのマス。 */
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

/**
 * 操作を教えた後、行・列・ブロックのルールを1つずつ示し、示したまとまりで最後に空いたマスを埋めさせる。
 * 操作で入れる6行3列の9で、6行目の空きは6行9列だけになる。
 * 列・ブロックの手順のマスは、それまでのまとまりでは決まらず、示したまとまりでだけ決まる。
 * 最後の手順の3行6列は、行・列・ブロックのどれか1つや2つでは決まらず、3つを合わせて初めて1に決まる。
 * 手順を終えると7マスが残り、どれも行・列・ブロックを合わせれば1つの数字に決まる。
 */
const steps: readonly NanpureTutorialStep[] = [
  {
    message: {
      headline: "マスを選んで、下の数字を押します",
      detail: `印のマスに${getSolutionDigit(cellAt(6, 3))}を入れてください`,
    },
    introducedRuleId: null,
    cellIndex: cellAt(6, 3),
    reasonUnits: [],
    cuedDigit: getSolutionDigit(cellAt(6, 3)),
  },
  {
    message: {
      headline: "どの行にも\n1〜9が1つずつ入ります",
      detail: "この行に無い数字を入れてください",
    },
    introducedRuleId: "row",
    cellIndex: cellAt(6, 9),
    reasonUnits: [getCellUnit(cellAt(6, 9), "row")],
    cuedDigit: null,
  },
  {
    message: { headline: "どの列にも\n1〜9が1つずつ入ります", detail: null },
    introducedRuleId: "column",
    cellIndex: cellAt(7, 1),
    reasonUnits: [getCellUnit(cellAt(7, 1), "column")],
    cuedDigit: null,
  },
  {
    message: {
      headline: "太線で囲んだブロックにも\n1〜9が1つずつ入ります",
      detail: null,
    },
    introducedRuleId: "block",
    cellIndex: cellAt(4, 9),
    reasonUnits: [getCellUnit(cellAt(4, 9), "block")],
    cuedDigit: null,
  },
  {
    message: {
      headline: "行・列・ブロックを合わせると\n入る数字が1つに決まります",
      detail: null,
    },
    introducedRuleId: null,
    cellIndex: cellAt(3, 6),
    reasonUnits: ruleIds.map((kind) => getCellUnit(cellAt(3, 6), kind)),
    cuedDigit: null,
  },
];

function isGiven(cellIndex: number): boolean {
  return (givens[cellIndex] ?? null) !== null;
}

function getUnitDigits(
  board: NanpureBoard,
  unit: NanpureTutorialUnit,
  excludedCellIndex: number,
): NanpureDigit[] {
  return getNanpureTutorialUnitCellIndices(unit).flatMap((cellIndex) => {
    const digit = board[cellIndex];
    return cellIndex === excludedCellIndex ||
      digit === null ||
      digit === undefined
      ? []
      : [digit];
  });
}

/**
 * 空きマスの数字が、手に入れたルールだけで決まるか。
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
  const units = ruleIds
    .filter((kind) => earnedRuleIds.includes(kind))
    .map((kind) => getCellUnit(cellIndex, kind));
  for (const unit of units) {
    const used = new Set(getUnitDigits(board, unit, cellIndex));
    const missing = NANPURE_DIGITS.filter((digit) => !used.has(digit));
    const [digit] = missing;
    if (used.size === NANPURE_SIZE - 1 && missing.length === 1 && digit) {
      return { digit, reasonUnits: [unit] };
    }
  }

  const used = new Set(
    units.flatMap((unit) => getUnitDigits(board, unit, cellIndex)),
  );
  const candidates = NANPURE_DIGITS.filter((digit) => !used.has(digit));
  const [digit] = candidates;
  return candidates.length === 1 && digit
    ? { digit, reasonUnits: units }
    : null;
}

/** 手に入れたルールのまとまりで、ほかの数字と重なったマス。まだ示していないまとまりの重なりは見せない。 */
function findVisibleConflictCellIndices(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
): number[] {
  return allCellIndices.filter((cellIndex) => {
    const digit = board[cellIndex];
    return (
      digit !== null &&
      digit !== undefined &&
      findConflictingUnit(board, earnedRuleIds, cellIndex, digit) !== null
    );
  });
}

/** マスの数字が重なった、手に入れたルールのまとまりのうち最初のもの。行・列・ブロックの順に探す。 */
function findConflictingUnit(
  board: NanpureBoard,
  earnedRuleIds: readonly NanpureTutorialRuleId[],
  cellIndex: number,
  digit: NanpureDigit,
): NanpureTutorialUnit | null {
  return (
    ruleIds
      .filter((kind) => earnedRuleIds.includes(kind))
      .map((kind) => getCellUnit(cellIndex, kind))
      .find((unit) => getUnitDigits(board, unit, cellIndex).includes(digit)) ??
    null
  );
}

/** 答えと違う数字を除いた盤面。決め手は、正しく入れた数字と最初の数字だけから読む。 */
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

/** 手を引いている間は、印のマスにだけ数字を入れられる。最初の数字は変えられない。 */
function performNanpureTutorialAction(
  { step, earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
  action: NanpureTutorialAction,
): { state: NanpureTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { cellIndex, digit } = action;
  const current = state.board[cellIndex];
  const outsideStep = step !== null && step.cellIndex !== cellIndex;
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
  const violated =
    findConflictingUnit(board, earnedRuleIds, cellIndex, digit) !== null;
  const correct = digit === solution[cellIndex];
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
  if (findVisibleConflictCellIndices(board, earnedRuleIds).length > 0) {
    return { state: next, outcome: violated ? "violated" : "continued" };
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

/** 直前に入れた数字が重なったまとまりと数字を言う。 */
function describeNanpureTutorialViolation(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): TutorialMessage {
  const { lastMove } = state;
  const unit =
    lastMove &&
    findConflictingUnit(
      state.board,
      earnedRuleIds,
      lastMove.cellIndex,
      lastMove.digit,
    );
  if (!lastMove || !unit) {
    return { headline: "同じ数字が重なっています", detail: null };
  }
  return {
    headline: `この${unitNames[unit.kind]}には、もう${lastMove.digit}があります`,
    detail: "別の数字を押すと入れ替わります",
  };
}

export const NANPURE_TUTORIAL_GIVENS = givens;

/** 手を引いている間は、印のマスだけを選べる。手を離した後は、本番と同じくどのマスも選べる。 */
export function isNanpureTutorialCellSelectable(
  { step }: NanpureTutorialSituation,
  cellIndex: number,
): boolean {
  return step === null || step.cellIndex === cellIndex;
}

export function getNanpureTutorialConflictCellIndices(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number[] {
  return findVisibleConflictCellIndices(state.board, earnedRuleIds);
}

/** 本番と同じく、解の位置に9つそろった数字。数字のボタンを押せなくする。 */
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

/** 手順で印を付けるマス。解の数字が入るまで付ける。手を離した後は `null`。 */
export function getNanpureTutorialStepCellIndex(
  { step }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): number | null {
  return step !== null &&
    state.board[step.cellIndex] !== solution[step.cellIndex]
    ? step.cellIndex
    : null;
}

/**
 * 手を離した後、手が止まったときに示すマス。
 * 答えと違う数字があれば、まずそれを直させる。無ければ、今の盤面と手に入れたルールだけで決まる空きマスを、
 * まとまりで最後に空いたマスから先に示す。無ければ `null`。
 */
export function findNanpureTutorialHint(
  { earnedRuleIds }: NanpureTutorialSituation,
  state: NanpureTutorialBoardState,
): NanpureTutorialHint | null {
  const wrongCellIndex = state.board.findIndex(
    (digit, cellIndex) => digit !== null && digit !== solution[cellIndex],
  );
  if (wrongCellIndex >= 0) {
    return { cellIndex: wrongCellIndex, reasonUnits: [] };
  }
  const deductions = allCellIndices.flatMap((cellIndex) => {
    const deduction = deduceCell(state.board, earnedRuleIds, cellIndex);
    return deduction ? [{ cellIndex, ...deduction }] : [];
  });
  const hint =
    deductions.find(({ reasonUnits }) => reasonUnits.length === 1) ??
    deductions[0];
  return hint
    ? { cellIndex: hint.cellIndex, reasonUnits: hint.reasonUnits }
    : null;
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
    headline: "残りのマスを埋めると完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は、空いたマスがもっと多い盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールで解けます",
    },
  },
  start: startNanpureTutorial,
  goal: getNanpureTutorialGoal,
  perform: performNanpureTutorialAction,
  describeViolation: describeNanpureTutorialViolation,
};

export const _private = { givens, solution, cellAt, deduceCell };
