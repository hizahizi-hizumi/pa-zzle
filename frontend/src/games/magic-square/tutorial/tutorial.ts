import { magicSquareBoardSizes } from "@/games/magic-square/problem/problem";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  isSameMagicSquareLine,
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
 * - `search`: 空いたマスが1つだけ残った列を自分で探させる。どの列で見つけてもよい。
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
 * どの列も空いたマスが2つの盤面。左上に数を置くと、1行目・1列目・左上からの斜めの空いたマスが1つずつになり、
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

/** 列を並べて言うときの向き。「横と縦の列」のように、向きを並べて「の列」を1回だけ付ける。 */
const lineDirectionNames = {
  row: "横",
  column: "縦",
  diagonal: "斜め",
} as const satisfies Record<MagicSquareTutorialRuleId, string>;

/** 列の4つの数を足すと合計になること。振り返りと、決め手の列を言う一言に使う。 */
function describeLineRule(kind: MagicSquareTutorialRuleId): string {
  return `${lineKindNames[kind]}の${size}つの数を足すと${magicSum}になります`;
}

/** 列の端の、今の合計が出る所。斜めの列は、斜めの続きの角に出る。 */
function describeLineSumPlace(line: MagicSquareLine): string {
  switch (line.kind) {
    case "row":
      return "右";
    case "column":
      return "下";
    case "diagonal":
      return line.from === "top-left" ? "右下の角" : "左下の角";
  }
}

function describeLineFill(line: MagicSquareLine): string {
  return `${describeLineSumPlace(line)}に今の合計が出ます\n${magicSum}に足りない分を空いたマスに置きます`;
}

/** 探す手順とヒントで、そのマスの数を決める列を言う一言。 */
function describeDecidingLine(line: MagicSquareLine): TutorialMessage {
  return {
    headline: describeLineRule(line.kind),
    detail: describeLineFill(line),
  };
}

/** ルールを伝える手順の一言。前の手順で伝えた向きの列に重ねて、同じ決まりが次の向きにもあると言う。 */
const lineIntroductions = {
  row: describeLineRule("row"),
  column: `横の列と同じく縦の列も\n${size}つの数を足すと${magicSum}になります`,
  diagonal: `横や縦の列と同じく斜めの列も\n${size}つの数を足すと${magicSum}になります`,
} as const satisfies Record<MagicSquareTutorialRuleId, string>;

const searchHeadline = "空いたマスが1つだけ残った列を探します";

const searchMessage: TutorialMessage = {
  headline: searchHeadline,
  detail: `その列の空いたマスに${magicSum}に足りない分を置きます`,
};

function createLineStep(
  cellIndex: number,
  line: MagicSquareLine,
): MagicSquareTutorialStep {
  return {
    kind: "line",
    message: {
      headline: lineIntroductions[line.kind],
      detail: describeLineFill(line),
    },
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
      headline:
        "マスを選んで盤面の下に並んだ数を押すと\nその数をマスに置けます",
      detail: `印の付いたマスに${operationValue}を置きます`,
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

/** チュートリアルで解く盤面のほかに、本番で出る盤面の大きさ。合計は遊び方に任せる。 */
const otherBoardSizeNames = magicSquareBoardSizes
  .filter((boardSize) => boardSize !== size)
  .map((boardSize) => `${boardSize}×${boardSize}`)
  .join("と");

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

/** 答えと違う数を除いた盤面。決め手は、正しく置いた数と最初から置いてある数だけから読む。 */
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

/** 手に入れたルールの列のうち、盤面に違反として見せる列。 */
function listVisibleViolations(
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  puzzleState: MagicSquareState,
): MagicSquareLineEvaluation[] {
  return listMagicSquareLineEvaluations(puzzleState).filter(
    ({ line, status }) =>
      isEarnedLine(earnedRuleIds, line) && isMagicSquareLineViolation(status),
  );
}

/**
 * 手順の間に選べるマス。違う数が置いてある間は、そのマスを直させる。
 * 印のある手順では印のマスだけ、探す手順では本番と同じくどのマスも選べる。
 */
function isCellSelectable(
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
  return step.kind === "search" || step.cellIndex === cellIndex;
}

/** 探す手順で、空いたマスのうち、手に入れたルールの列でまだ数が決まらないマスか。 */
function isUndecidedEmptyCell(
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
  state: MagicSquareTutorialBoardState,
  cellIndex: number,
): boolean {
  return (
    state.puzzleState.cells[cellIndex] === null &&
    findMagicSquareTutorialDecidingLine(
      keepCorrectCells(state.puzzleState),
      earnedRuleIds,
      cellIndex,
    ) === null
  );
}

/** 手順のマスに答えの数を置いたか。探す手順では、置いたマスの数がその時点で決まっていたか。 */
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
    !isCellSelectable(situation, state, cellIndex)
  ) {
    return { state, outcome: "ignored" };
  }
  const next = { ...state, selectedCellIndex: cellIndex, lastMove: null };
  return {
    state: next,
    outcome:
      listVisibleViolations(situation.earnedRuleIds, state.puzzleState)
        .length === 0
        ? "continued"
        : "violated",
  };
}

/**
 * 選んだマスに数を置く。探す手順では、まだ数が決まらない空いたマスには置かせない。
 * 置いた数のマスは、本番と同じく外したり置き換えたりできる。
 */
function enterValue(
  { step, earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
  value: number,
): { state: MagicSquareTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { selectedCellIndex: cellIndex } = state;
  if (
    cellIndex === null ||
    (step?.kind === "operation" && value !== step.value) ||
    !isCellSelectable({ step, earnedRuleIds }, state, cellIndex) ||
    (step?.kind === "search" &&
      isUndecidedEmptyCell(earnedRuleIds, state, cellIndex))
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
  if (listVisibleViolations(earnedRuleIds, puzzleState).length > 0) {
    return { state: next, outcome: "violated" };
  }
  return { state: next, outcome: fitsStep ? "stepped" : "continued" };
}

/** 向きの並びは、横・縦・斜めの順にそろえる。 */
function describeLines(lineKinds: readonly MagicSquareTutorialRuleId[]) {
  const directions = (["row", "column", "diagonal"] as const)
    .filter((kind) => lineKinds.includes(kind))
    .map((kind) => lineDirectionNames[kind]);
  return directions.length === 0 ? "列" : `${directions.join("と")}の列`;
}

/**
 * 違反の言い方。空いたマスがあるのに合計に届いた列は、ちょうど届いたか超えたかで言い分ける。
 */
type ViolationPhrase = "unmatched" | "reached" | "exceeded";

function getViolationPhrase({
  status,
  sum,
}: MagicSquareLineEvaluation): ViolationPhrase {
  if (status !== "overreached") {
    return "unmatched";
  }
  return sum > magicSum ? "exceeded" : "reached";
}

/**
 * 違う数を置いたマス。違反の出た列にあるマスを先に、その中でも直前の手のマスを先に返す。無ければ `null`。
 */
export function findMagicSquareTutorialWrongCellIndex(
  { earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): number | null {
  const wrongCellIndices = listWrongCellIndices(state.puzzleState);
  const lastCellIndex = state.lastMove?.cellIndex;
  const ordered =
    lastCellIndex !== undefined && wrongCellIndices.includes(lastCellIndex)
      ? [
          lastCellIndex,
          ...wrongCellIndices.filter(
            (cellIndex) => cellIndex !== lastCellIndex,
          ),
        ]
      : wrongCellIndices;
  const violatedCellIndices = new Set(
    listVisibleViolations(earnedRuleIds, state.puzzleState).flatMap(
      ({ line }) => getMagicSquareLineCellIndices(size, line),
    ),
  );
  return (
    ordered.find((cellIndex) => violatedCellIndices.has(cellIndex)) ??
    ordered[0] ??
    null
  );
}

/**
 * 違反の一言で言う列。直すマスを通る違反の列のうち、ルールを伝える手順で覆いから抜いている列を先にし、
 * それと同じ言い方になる列をまとめる。
 */
function listDescribedViolations(
  situation: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
  wrongCellIndex: number | null,
): MagicSquareLineEvaluation[] {
  const { step, earnedRuleIds } = situation;
  const violations = listVisibleViolations(
    earnedRuleIds,
    state.puzzleState,
  ).filter(
    ({ line }) =>
      wrongCellIndex === null ||
      getMagicSquareLineCellIndices(size, line).includes(wrongCellIndex),
  );
  const spotlit = violations.filter(
    ({ line }) =>
      step?.kind === "line" && isSameMagicSquareLine(line, step.line),
  );
  const ordered = [
    ...spotlit,
    ...violations.filter((violation) => !spotlit.includes(violation)),
  ];
  const [first] = ordered;
  return first === undefined
    ? []
    : ordered.filter(
        (violation) =>
          getViolationPhrase(violation) === getViolationPhrase(first),
      );
}

/**
 * 直すマスの呼び方。選んでいれば選んだ縁で、選んでいなければ印で見分けられる。
 * 違反の出た列は、覆いから抜いた列とも選んだマスの列とも限らないので、「この列」とは言わず、直すマスから言う。
 */
function describeWrongCell(
  state: MagicSquareTutorialBoardState,
  wrongCellIndex: number | null,
): { name: string; fix: string } {
  return state.selectedCellIndex !== null &&
    state.selectedCellIndex === wrongCellIndex
    ? { name: "選んだマス", fix: "別の数を押すと置き換えられます" }
    : {
        name: "印の付いたマス",
        fix: "そのマスを選んで\n別の数を押すと置き換えられます",
      };
}

/** 違反の一言。何に当たったかを、直すマスを通る違反の列と合計で言う。 */
function describeMagicSquareTutorialViolation(
  situation: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): TutorialMessage {
  const wrongCellIndex = findMagicSquareTutorialWrongCellIndex(
    situation,
    state,
  );
  const violations = listDescribedViolations(situation, state, wrongCellIndex);
  const { name, fix: detail } = describeWrongCell(state, wrongCellIndex);
  const subject = `${name}の${describeLines(violations.map(({ line }) => line.kind))}は`;
  const [first] = violations;
  switch (first ? getViolationPhrase(first) : "unmatched") {
    case "unmatched":
      return {
        headline: `${subject}\n合計が${magicSum}になっていません`,
        detail,
      };
    case "reached":
      return {
        headline: `${subject}\nまだ空いたマスがあるのに合計がもう${magicSum}になりました`,
        detail,
      };
    case "exceeded":
      return {
        headline: `${subject}\nまだ空いたマスがあるのに合計がもう${magicSum}を超えました`,
        detail,
      };
  }
}

/**
 * 探す手順で選んだマスへの一言。マスを選んでいなければ `null`。
 * - 空いたマスが1つだけ残った列のマス: その列の決まりと、足りない分を置くこと。
 * - どの列も空いたマスが2つ以上のマス: そのことと、探し方。
 * - 数の置いてあるマス: そのことと、探し方。
 */
export function describeMagicSquareTutorialSelection(
  { step, earnedRuleIds }: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): TutorialMessage | null {
  const { selectedCellIndex } = state;
  if (step?.kind !== "search" || selectedCellIndex === null) {
    return null;
  }
  if (isMagicSquareGivenCell(givens, selectedCellIndex)) {
    return {
      headline: "選んだマスには最初から数が置いてあります",
      detail: searchHeadline,
    };
  }
  const board = keepCorrectCells(state.puzzleState);
  if (board.cells[selectedCellIndex] !== null) {
    return {
      headline: "選んだマスにはもう数が置いてあります",
      detail: searchHeadline,
    };
  }
  const decidingLine = findMagicSquareTutorialDecidingLine(
    board,
    earnedRuleIds,
    selectedCellIndex,
  );
  if (decidingLine !== null) {
    return describeDecidingLine(decidingLine);
  }
  const lineNames = describeLines(
    listMagicSquareLinesThroughCell(size, selectedCellIndex).map(
      ({ kind }) => kind,
    ),
  );
  return {
    headline: `選んだマスの${lineNames}には\n空いたマスが2つ以上あります`,
    detail: searchHeadline,
  };
}

/**
 * 盤面を変えなかった数の押し方への応え方。
 * - `recall`: 印のある手順で、印と違う所を押した。印を濃くし直して目を向けさせる。
 * - `undecided`: 探す手順で、手に入れたルールの列ではまだ数が決まらない空いたマスに押した。そのことを一言で言う。
 * - `rejected`: 本番でも受け付けない押し方（マスを選んでいない、最初から置いてある数のマス）。本番と同じく返す。
 */
export type MagicSquareTutorialEntryRefusal =
  | "recall"
  | "undecided"
  | "rejected";

export function getMagicSquareTutorialEntryRefusal(
  { step }: MagicSquareTutorialSituation,
  { selectedCellIndex, puzzleState }: MagicSquareTutorialBoardState,
): MagicSquareTutorialEntryRefusal {
  if (step?.kind === "operation" || step?.kind === "line") {
    return "recall";
  }
  return step?.kind === "search" &&
    selectedCellIndex !== null &&
    puzzleState.cells[selectedCellIndex] === null
    ? "undecided"
    : "rejected";
}

/** 探す手順で、まだ数が決まらない空いたマスに数を押したときの一言。 */
export const magicSquareTutorialUndecidedEntryMessage: TutorialMessage = {
  headline: "選んだマスに入る数はまだ決まりません",
  detail: searchHeadline,
};

export type MagicSquareTutorialHint =
  | { kind: "wrong-value"; cellIndex: number; message: TutorialMessage }
  | {
      kind: "line";
      cellIndex: number;
      line: MagicSquareLine;
      message: TutorialMessage;
    };

/**
 * 手を離した後に「ヒント」で見せる手がかり。違う数があればそのマス、無ければ空いたマスが1つだけ残った列。
 * 違う数は、列の合計に表れないまま残っていると、ほかのマスの読みを狂わせるので先に直させる。
 */
export function findMagicSquareTutorialHint(
  situation: MagicSquareTutorialSituation,
  state: MagicSquareTutorialBoardState,
): MagicSquareTutorialHint | null {
  const wrongCellIndex = findMagicSquareTutorialWrongCellIndex(
    situation,
    state,
  );
  if (wrongCellIndex !== null) {
    const { name, fix } = describeWrongCell(state, wrongCellIndex);
    return {
      kind: "wrong-value",
      cellIndex: wrongCellIndex,
      message: { headline: `${name}の数が違います`, detail: fix },
    };
  }
  const board = keepCorrectCells(state.puzzleState);
  for (const line of lines) {
    if (!isEarnedLine(situation.earnedRuleIds, line)) {
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
        message: describeDecidingLine(line),
      };
    }
  }
  return null;
}

/** 空いていたマスのうち、答えの数を置いたマスの割合。 */
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

const rules = (["row", "column", "diagonal"] as const).map((id) => ({
  id,
  label: describeLineRule(id),
}));

/**
 * 解き終えたときに振り返ること。伝えた3つの向きの列の決まりに、レベル1を進めるのに使った読みを添える。
 * 読みは、どのレベルでも成り立つ事実として言い、本番がそれだけで進められるとは言わない。
 */
export const MAGIC_SQUARE_TUTORIAL_RECAP: readonly string[] = [
  ...rules.map(({ label }) => label),
  `空いたマスが1つだけ残った列には${magicSum}に足りない分が入ります`,
];

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
    purpose:
      "1から順の数を1つずつマスに置いて\n縦・横・斜めの列の合計を全て同じにするパズルです",
    goalCaption: `列の端に今の合計が出ます\n全て${magicSum}になると完成です`,
  },
  rules,
  steps,
  freePlay: {
    headline: "残りのマスも埋めてみましょう",
    detail: `空いたマスが1つだけ残った列を探して\n${magicSum}に足りない分を置きます`,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: `${otherBoardSizeNames}の盤面の合計は\n「遊び方」で見られます`,
    },
    play: {
      headline: "完成です",
      detail: `遊んでいた盤面も同じルールです\n${otherBoardSizeNames}の合計は「遊び方」で見られます`,
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
