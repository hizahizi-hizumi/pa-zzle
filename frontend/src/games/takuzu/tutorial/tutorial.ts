import {
  getTakuzuCellPosition,
  getTakuzuLineCellIndices,
  getTakuzuLineCells,
  listTakuzuLines,
  parseTakuzuBoard,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  hasTakuzuRuleViolation,
  isTakuzuSolved,
  type TakuzuRuleViolations,
} from "@/games/takuzu/puzzle/rules";
import {
  getNextTakuzuCell,
  isTakuzuGivenCell,
  placeTakuzuCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type TakuzuTutorialRuleId = "run" | "count" | "duplicate";

export type TakuzuTutorialAction =
  | { type: "cycle"; cellIndex: number; direction: TakuzuCycleDirection }
  | { type: "place"; cellIndex: number; cell: TakuzuCell };

/** 空きマスのタイルを決める見方。どのルールを、行と列のどちらの並びに当てはめるか。 */
export type TakuzuTutorialLesson = {
  ruleId: TakuzuTutorialRuleId;
  axis: TakuzuLine["axis"];
};

export type TakuzuTutorialStep = TutorialStep<TakuzuTutorialRuleId> & {
  /** 印を付け、手順の間だけ操作を受け付けるマス。すべて解と同じタイルになったら次の手順へ進む。 */
  cellIndices: readonly number[];
  /**
   * この手順で初めて使わせる見方。印のマスはこの見方で決まり、前の手順までに使わせた見方だけでは決まらないようにする。
   * 操作を教える手順と、使わせた見方をおさらいする手順では `null`。
   */
  lesson: TakuzuTutorialLesson | null;
};

export type TakuzuTutorialMove = {
  cellIndex: number;
  /** 手を引いている手順のマスを、正しい手へ向かう途中にした。責めないよう、すぐにはルールに合わないところを見せない。 */
  towardStep: boolean;
  /** 置いたマスが、見せているルールに合わないところに入っている。 */
  violated: boolean;
  /** 置いたタイルが手前の盤面だけで決まっていたときの決め手のマス。決まっていなければ空。 */
  reasonCellIndices: readonly number[];
  /** 手を引いている手順のマスに、解と同じタイルを置いた。手を離した後は常に `false`。 */
  fitsStep: boolean;
};

export type TakuzuTutorialBoardState = {
  board: TakuzuBoard;
  /** 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。 */
  moveCount: number;
  lastMove: TakuzuTutorialMove | null;
};

export type TakuzuTutorialSituation = TutorialSituation<
  TakuzuTutorialRuleId,
  TakuzuTutorialStep
>;

/** 空きマスに入るタイルが、今の盤面とルールだけで決まるときの、そのタイルと決め手のマス。 */
type TakuzuDeduction = {
  tile: TakuzuTile;
  reasonCellIndices: readonly number[];
};

/**
 * 最初に置かれたマスだけで、3つのルールの下で解はこの1つに決まる。
 *
 * ```text
 * 最初    解
 * .A..   AABB
 * BB..   BBAA
 * B...   BABA
 * ...B   ABAB
 * ```
 */
const givens = parseTakuzuBoard([".A..", "BB..", "B...", "...B"]);
const solution = parseTakuzuBoard(["AABB", "BBAA", "BABA", "ABAB"]);

function cellAt(row: number, column: number): number {
  return (row - 1) * givens.size + (column - 1);
}

/**
 * 四角と丸を1つずつ自分で置き、ルールを1つずつ、まず行に、次に列に当てはめて埋めていく。
 * 丸は空き→四角→丸と2回押して入れるので、丸を入れる手は途中で四角を置いた盤面を通る。その途中の盤面も、まだ伝えていないルールに当たらないマスを選ぶ。
 * - 操作: 4行目の1列目に四角を、1行目の4列目に丸を置く。丸の途中の四角は、1行目の四角を2つにするだけで、どのルールにも当たらない。
 * - 3つ続かない: 2行目の丸2つの右を、続いて1列目の丸2つの上を、四角で埋める。どちらも1回押すだけなので、途中の盤面を通らない。
 * - 同じ数: 2行目の丸2つから2行目の4列目を、続いて4列目の丸2つ（1つは自分で置いた丸）から4列目の3行目を埋める。
 * - おさらい: 1行目の3列目を、並んだ四角2つから丸で埋める。丸の途中の四角は、ここまでに伝えた3つ続かないことと同じ数に当たる。
 * - 同じ並び: 3行目 `B..A` を、真上でそろった2行目 `BBAA` と同じにしない入れ方で埋める。3行目の2マスは、3つ続かないことと同じ数だけでは決まらない。
 * 手順を終えると4行目の2マスが残り、列の同じ数で1つずつ決まる。
 */
const steps: readonly TakuzuTutorialStep[] = [
  {
    message: { headline: "印のマスをタップすると四角が入ります", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(4, 1)],
    lesson: null,
  },
  {
    message: { headline: "2回タップすると丸が入ります", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(1, 4)],
    lesson: null,
  },
  {
    message: { headline: "同じ形は3つ続けられません", detail: null },
    introducedRuleId: "run",
    cellIndices: [cellAt(2, 3)],
    lesson: { ruleId: "run", axis: "row" },
  },
  {
    message: { headline: "縦にも3つ続けられません", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(1, 1)],
    lesson: { ruleId: "run", axis: "column" },
  },
  {
    message: {
      headline: "どの行にも四角と丸が\n同じ数ずつ入ります",
      detail: null,
    },
    introducedRuleId: "count",
    cellIndices: [cellAt(2, 4)],
    lesson: { ruleId: "count", axis: "row" },
  },
  {
    message: { headline: "列にも同じ数ずつ入ります", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(3, 4)],
    lesson: { ruleId: "count", axis: "column" },
  },
  {
    message: {
      headline: "ここまでのルールで\nこのマスも分かります",
      detail: null,
    },
    introducedRuleId: null,
    cellIndices: [cellAt(1, 3)],
    lesson: null,
  },
  {
    message: {
      headline: "同じ並びの行や列は作れません",
      detail: "上の行と見比べると分かります",
    },
    introducedRuleId: "duplicate",
    cellIndices: [cellAt(3, 2), cellAt(3, 3)],
    lesson: { ruleId: "duplicate", axis: "row" },
  },
];

const takuzuTiles = ["a", "b"] as const satisfies readonly TakuzuTile[];

/** 並んだ2つ（左・右）と、挟む2つの位置。 */
const runNeighborOffsets = [
  [-2, -1],
  [1, 2],
  [-1, 1],
] as const;

function getOtherTile(tile: TakuzuTile): TakuzuTile {
  return tile === "a" ? "b" : "a";
}

function countTile(cells: readonly TakuzuCell[], tile: TakuzuTile): number {
  return cells.filter((cell) => cell === tile).length;
}

function deduceByRun(
  cells: readonly TakuzuCell[],
  cellIndices: readonly number[],
  position: number,
): TakuzuDeduction | null {
  for (const offsets of runNeighborOffsets) {
    const [first, second] = offsets.map((offset) => cells[position + offset]);
    const reasonCellIndices = offsets.flatMap(
      (offset) => cellIndices[position + offset] ?? [],
    );
    if (first && first === second) {
      return { tile: getOtherTile(first), reasonCellIndices };
    }
  }
  return null;
}

function deduceByCount(
  cells: readonly TakuzuCell[],
  cellIndices: readonly number[],
): TakuzuDeduction | null {
  const filledTile = takuzuTiles.find(
    (tile) => countTile(cells, tile) === cells.length / 2,
  );
  if (!filledTile) {
    return null;
  }
  return {
    tile: getOtherTile(filledTile),
    reasonCellIndices: cellIndices.filter(
      (_, position) => cells[position] === filledTile,
    ),
  };
}

/**
 * 残り2マスに四角と丸を1つずつ入れる行・列で、片方の入れ方が埋まった別の行・列と同じ並びになるなら、もう片方に決まる。
 * 決め手は、同じ並びになってしまう行・列のマス。
 */
function deduceByDuplicate(
  board: TakuzuBoard,
  line: TakuzuLine,
  cells: readonly TakuzuCell[],
  position: number,
): TakuzuDeduction | null {
  const emptyPositions = cells.flatMap((cell, index) =>
    cell === null ? [index] : [],
  );
  const remainsOneOfEach = takuzuTiles.every(
    (tile) => countTile(cells, tile) === cells.length / 2 - 1,
  );
  if (emptyPositions.length !== 2 || !remainsOneOfEach) {
    return null;
  }

  const filledPeers = listTakuzuLines(board.size).filter(
    (peer) =>
      peer.axis === line.axis &&
      peer.index !== line.index &&
      getTakuzuLineCells(board, peer).every((cell) => cell !== null),
  );
  function findTwin(tile: TakuzuTile): TakuzuLine | undefined {
    const filled = cells.map(
      (cell, index) => cell ?? (index === position ? tile : getOtherTile(tile)),
    );
    return filledPeers.find((peer) =>
      getTakuzuLineCells(board, peer).every(
        (cell, index) => cell === filled[index],
      ),
    );
  }

  const [first, second] = takuzuTiles.map(findTwin);
  if (first && !second) {
    return {
      tile: "b",
      reasonCellIndices: getTakuzuLineCellIndices(board.size, first),
    };
  }
  if (second && !first) {
    return {
      tile: "a",
      reasonCellIndices: getTakuzuLineCellIndices(board.size, second),
    };
  }
  return null;
}

const takuzuAxes = [
  "row",
  "column",
] as const satisfies readonly TakuzuLine["axis"][];

function listLessons(
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuTutorialLesson[] {
  return ruleIds.flatMap((ruleId) =>
    takuzuAxes.map((axis) => ({ ruleId, axis })),
  );
}

function getCellLine(
  size: number,
  cellIndex: number,
  axis: TakuzuLine["axis"],
): TakuzuLine {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  return { axis, index: axis === "row" ? row : column };
}

function deduceCell(
  board: TakuzuBoard,
  lessons: readonly TakuzuTutorialLesson[],
  cellIndex: number,
): TakuzuDeduction | null {
  if (board.cells[cellIndex] !== null) {
    return null;
  }

  for (const { ruleId, axis } of lessons) {
    const line = getCellLine(board.size, cellIndex, axis);
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    const position = cellIndices.indexOf(cellIndex);
    const cells = getTakuzuLineCells(board, line);
    const deduction =
      ruleId === "run"
        ? deduceByRun(cells, cellIndices, position)
        : ruleId === "count"
          ? deduceByCount(cells, cellIndices)
          : deduceByDuplicate(board, line, cells, position);
    if (deduction) {
      return deduction;
    }
  }
  return null;
}

/** 見つけやすいルールで決まるマスほど先に返す。3つ続かない、同じ数、同じ並びの順。 */
function findDeducibleCellIndex(
  board: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
): number | null {
  for (const ruleId of ruleIds) {
    const lessons = listLessons([ruleId]);
    const cellIndex = board.cells.findIndex(
      (_, index) => deduceCell(board, lessons, index) !== null,
    );
    if (cellIndex >= 0) {
      return cellIndex;
    }
  }
  return null;
}

/**
 * ここまでに伝えた見方。ルールを行と列に分けて伝えるので、手を引いている間は今の手順までに使わせた見方だけにする。
 * 手を離した後は、手に入れたルールを行と列の両方に当てはめる。
 */
function listTaughtLessons({
  step,
  earnedRuleIds,
}: TakuzuTutorialSituation): TakuzuTutorialLesson[] {
  if (step === null) {
    return listLessons(earnedRuleIds);
  }
  return steps
    .slice(0, steps.indexOf(step) + 1)
    .flatMap((taught) => (taught.lesson ? [taught.lesson] : []));
}

function isLessonTaught(
  lessons: readonly TakuzuTutorialLesson[],
  ruleId: TakuzuTutorialRuleId,
  axis: TakuzuLine["axis"],
): boolean {
  return lessons.some(
    (lesson) => lesson.ruleId === ruleId && lesson.axis === axis,
  );
}

function isInRunAlong(
  board: TakuzuBoard,
  cellIndex: number,
  axis: TakuzuLine["axis"],
): boolean {
  const line = getCellLine(board.size, cellIndex, axis);
  const cells = getTakuzuLineCells(board, line);
  const position = getTakuzuLineCellIndices(board.size, line).indexOf(
    cellIndex,
  );
  const tile = cells[position];
  if (!tile) {
    return false;
  }
  let start = position;
  while (start > 0 && cells[start - 1] === tile) {
    start -= 1;
  }
  let end = position;
  while (end < cells.length - 1 && cells[end + 1] === tile) {
    end += 1;
  }
  return end - start + 1 >= 3;
}

/** 伝えた見方のぶんだけの違反。まだ伝えていないルールと、まだ伝えていない向き（行・列）の違反は見せない。 */
function findVisibleViolations(
  board: TakuzuBoard,
  lessons: readonly TakuzuTutorialLesson[],
): TakuzuRuleViolations {
  const violations = findTakuzuRuleViolations(board);
  return {
    runCellIndices: violations.runCellIndices.filter((cellIndex) =>
      takuzuAxes.some(
        (axis) =>
          isLessonTaught(lessons, "run", axis) &&
          isInRunAlong(board, cellIndex, axis),
      ),
    ),
    overfilledLines: violations.overfilledLines.filter((line) =>
      isLessonTaught(lessons, "count", line.axis),
    ),
    duplicateLines: violations.duplicateLines.filter((line) =>
      isLessonTaught(lessons, "duplicate", line.axis),
    ),
  };
}

const noViolations: TakuzuRuleViolations = {
  runCellIndices: [],
  overfilledLines: [],
  duplicateLines: [],
};

/**
 * 盤面に見せる違反。手順のマスを正しい手へ向かう途中にした直後は、責めないよう何も見せない。
 * 途中の盤面のまま手が止まったら（`towardStepSettled`）、ルールに合わないところを見せる。
 */
function findShownViolations(
  { board, lastMove }: TakuzuTutorialBoardState,
  lessons: readonly TakuzuTutorialLesson[],
  towardStepSettled: boolean,
): TakuzuRuleViolations {
  return lastMove?.towardStep && !towardStepSettled
    ? noViolations
    : findVisibleViolations(board, lessons);
}

function isCellInViolation(
  board: TakuzuBoard,
  violations: TakuzuRuleViolations,
  cellIndex: number,
): boolean {
  const lines = [...violations.overfilledLines, ...violations.duplicateLines];
  return (
    violations.runCellIndices.includes(cellIndex) ||
    lines.some((line) =>
      getTakuzuLineCellIndices(board.size, line).includes(cellIndex),
    )
  );
}

function getPlacedCell(
  current: TakuzuCell,
  action: TakuzuTutorialAction,
): TakuzuCell {
  return action.type === "cycle"
    ? getNextTakuzuCell(current, action.direction)
    : action.cell;
}

function getPlacementReason(
  { step, earnedRuleIds }: TakuzuTutorialSituation,
  before: TakuzuBoard,
  cellIndex: number,
  placed: TakuzuCell,
): readonly number[] {
  // 解と違うタイルには決め手を付けない。手順のほかのマスに残った解と違うタイルも、決め手を探す前に空ける。
  if (placed !== solution.cells[cellIndex]) {
    return [];
  }
  const emptied = placeTakuzuCell(
    givens,
    clearMistakenStepCells(step, before),
    cellIndex,
    null,
  );
  const lessons = [
    ...(step?.lesson ? [step.lesson] : []),
    ...listLessons(earnedRuleIds),
  ];
  const deduction = deduceCell(emptied, lessons, cellIndex);
  return deduction && deduction.tile === placed
    ? deduction.reasonCellIndices
    : [];
}

/**
 * 手を引いている手順のマスを、正しい手へ向かう途中にしたか。
 * 解のタイルにした手と、同じ向きにもう一度押せば解のタイルになる手のうち、解のタイルにすればルールに合わないところが無くなるものを、途中とみなす。
 * 途中でない手（別のマスのタイルのせいでルールに合わないままになる手や、キーで違うタイルを置いた手）は、ルールに合わないところを見せる。
 */
function isTowardStep(
  situation: TakuzuTutorialSituation,
  board: TakuzuBoard,
  action: TakuzuTutorialAction,
  placed: TakuzuCell,
): boolean {
  const { step } = situation;
  if (step === null || !step.cellIndices.includes(action.cellIndex)) {
    return false;
  }
  const target = solution.cells[action.cellIndex] ?? null;
  const reachesNext =
    action.type === "cycle" &&
    getNextTakuzuCell(placed, action.direction) === target;
  if (placed !== target && !reachesNext) {
    return false;
  }
  const reached = placeTakuzuCell(givens, board, action.cellIndex, target);
  return !hasTakuzuRuleViolation(
    findVisibleViolations(reached, listTaughtLessons(situation)),
  );
}

function clearMistakenStepCells(
  step: TakuzuTutorialStep | null,
  board: TakuzuBoard,
): TakuzuBoard {
  return (step?.cellIndices ?? []).reduce(
    (current, cellIndex) =>
      current.cells[cellIndex] === solution.cells[cellIndex]
        ? current
        : placeTakuzuCell(givens, current, cellIndex, null),
    board,
  );
}

function isStepDone(step: TakuzuTutorialStep, board: TakuzuBoard): boolean {
  return step.cellIndices.every(
    (cellIndex) => board.cells[cellIndex] === solution.cells[cellIndex],
  );
}

function startTakuzuTutorial(): TakuzuTutorialBoardState {
  return { board: givens, moveCount: 0, lastMove: null };
}

function getTakuzuTutorialGoal(): TakuzuTutorialBoardState {
  return { board: solution, moveCount: 0, lastMove: null };
}

function performTakuzuTutorialAction(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  action: TakuzuTutorialAction,
): { state: TakuzuTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { step } = situation;
  const { cellIndex } = action;
  const current = state.board.cells[cellIndex];
  const outsideStep = step !== null && !step.cellIndices.includes(cellIndex);
  if (current === undefined || outsideStep) {
    return { state, outcome: "ignored" };
  }
  const placed = getPlacedCell(current, action);
  const board = placeTakuzuCell(givens, state.board, cellIndex, placed);
  if (board === state.board) {
    return { state, outcome: "ignored" };
  }

  const towardStep = isTowardStep(situation, board, action, placed);
  const shownViolations = towardStep
    ? noViolations
    : findVisibleViolations(board, listTaughtLessons(situation));
  const next: TakuzuTutorialBoardState = {
    board,
    moveCount: state.moveCount + 1,
    lastMove: {
      cellIndex,
      towardStep,
      violated: isCellInViolation(board, shownViolations, cellIndex),
      reasonCellIndices:
        placed === null
          ? []
          : getPlacementReason(situation, state.board, cellIndex, placed),
      fitsStep: step !== null && placed === solution.cells[cellIndex],
    },
  };

  if (isTakuzuSolved(board)) {
    return { state: next, outcome: "solved" };
  }
  if (hasTakuzuRuleViolation(shownViolations)) {
    return { state: next, outcome: "violated" };
  }
  if (step !== null && isStepDone(step, board)) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "continued" };
}

export function getTakuzuTutorialCellViews(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  towardStepSettled = false,
): TakuzuCellView[] {
  const runCellIndices = new Set(
    findShownViolations(state, listTaughtLessons(situation), towardStepSettled)
      .runCellIndices,
  );
  return state.board.cells.map(function createCellView(cell, cellIndex) {
    return {
      cell,
      given: isTakuzuGivenCell(givens, cellIndex),
      inViolatingRun: runCellIndices.has(cellIndex),
    };
  });
}

function isSameLine(left: TakuzuLine, right: TakuzuLine): boolean {
  return left.axis === right.axis && left.index === right.index;
}

export function getTakuzuTutorialLineViolations(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  towardStepSettled = false,
): TakuzuLineViolationView[] {
  const { overfilledLines, duplicateLines } = findShownViolations(
    state,
    listTaughtLessons(situation),
    towardStepSettled,
  );
  return listTakuzuLines(state.board.size).flatMap(
    function createLineViolation(line) {
      const overfilled = overfilledLines.some((other) =>
        isSameLine(line, other),
      );
      const duplicated = duplicateLines.some((other) =>
        isSameLine(line, other),
      );
      return overfilled || duplicated
        ? [{ ...line, overfilled, duplicated }]
        : [];
    },
  );
}

/** 遊び方の説明と同じ、画面のタイルの呼び方。 */
const tileNames = { a: "四角", b: "丸" } as const satisfies Record<
  TakuzuTile,
  string
>;

const lineNames = { row: "行", column: "列" } as const satisfies Record<
  TakuzuLine["axis"],
  string
>;

function getLinePlaceName(line: TakuzuLine, twin: TakuzuLine): string {
  if (Math.abs(twin.index - line.index) > 1) {
    return `${twin.index + 1}${lineNames[line.axis]}目`;
  }
  const before = twin.index < line.index;
  return line.axis === "row"
    ? before
      ? "上の行"
      : "下の行"
    : before
      ? "左の列"
      : "右の列";
}

function describeTwinLine(
  board: TakuzuBoard,
  duplicateLines: readonly TakuzuLine[],
  line: TakuzuLine,
): string {
  const pattern = getTakuzuLineCells(board, line).join("");
  const twin = duplicateLines
    .filter(
      (other) =>
        other.axis === line.axis &&
        other.index !== line.index &&
        getTakuzuLineCells(board, other).join("") === pattern,
    )
    .sort(
      (left, right) =>
        Math.abs(left.index - line.index) - Math.abs(right.index - line.index),
    )[0];
  return twin ? getLinePlaceName(line, twin) : `別の${lineNames[line.axis]}`;
}

type TakuzuViolationDescription = {
  cellIndices: readonly number[];
  message: TutorialMessage;
};

function listViolationDescriptions(
  board: TakuzuBoard,
  violations: TakuzuRuleViolations,
): TakuzuViolationDescription[] {
  const runs = violations.runCellIndices.flatMap((cellIndex) => {
    const tile = board.cells[cellIndex];
    return tile
      ? [
          {
            cellIndices: [cellIndex],
            message: {
              headline: `${tileNames[tile]}が3つ続いています`,
              detail: null,
            },
          },
        ]
      : [];
  });
  const overfilled = violations.overfilledLines.flatMap((line) => {
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    const cells = getTakuzuLineCells(board, line);
    const tile = takuzuTiles.find(
      (candidate) => countTile(cells, candidate) > cells.length / 2,
    );
    return tile
      ? [
          {
            cellIndices,
            message: {
              headline: `この${lineNames[line.axis]}は${tileNames[tile]}が多すぎます`,
              detail: null,
            },
          },
        ]
      : [];
  });
  const duplicates = violations.duplicateLines.map((line) => ({
    cellIndices: getTakuzuLineCellIndices(board.size, line),
    message: {
      headline: `${describeTwinLine(board, violations.duplicateLines, line)}と同じ並びになっています`,
      detail: null,
    },
  }));
  return [...runs, ...overfilled, ...duplicates];
}

/** 直前に置いたマスが当たっている違反を先に言う。古い違反が残っていても、今の手の結果を返すため。 */
function describeTakuzuTutorialViolation(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TutorialMessage {
  const descriptions = listViolationDescriptions(
    state.board,
    findShownViolations(state, listTaughtLessons(situation), false),
  );
  const lastCellIndex = state.lastMove?.cellIndex;
  const description =
    descriptions.find(({ cellIndices }) =>
      cellIndices.some((cellIndex) => cellIndex === lastCellIndex),
    ) ?? descriptions[0];
  return (
    description?.message ?? {
      headline: "ルールに合わないところがあります",
      detail: null,
    }
  );
}

export function getTakuzuTutorialStepCellIndices(
  { step }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): readonly number[] {
  return (step?.cellIndices ?? []).filter(
    (cellIndex) => state.board.cells[cellIndex] !== solution.cells[cellIndex],
  );
}

/** 手順で印を付けるマスのタイルを決めるもの（決め手）のマス。決まらない操作の手順と、手を離した後は空。 */
export function getTakuzuTutorialStepReasonCellIndices(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): readonly number[] {
  const { step, earnedRuleIds } = situation;
  const lessons = [
    ...(step?.lesson ? [step.lesson] : []),
    ...listLessons(earnedRuleIds),
  ];
  // 印のマスに置かれた解と違うタイルを前提にすると、誤った手へ導く決め手になるので、空けた盤面で探す。
  const cleared = clearMistakenStepCells(step, state.board);
  const reasonCellIndices = getTakuzuTutorialStepCellIndices(
    situation,
    state,
  ).flatMap((cellIndex) => {
    const deduction = deduceCell(cleared, lessons, cellIndex);
    return deduction && deduction.tile === solution.cells[cellIndex]
      ? deduction.reasonCellIndices
      : [];
  });
  return [...new Set(reasonCellIndices)];
}

/**
 * 手を離した後、手が止まったときに示すマス。無ければ `null`。
 * 本番と同じく、置いたタイルが解と合うかは明かさず、今の盤面と手に入れたルールだけで決まるマスを示す。解と違うタイルは、ルールを当てはめていけば違反として盤面に現れる。
 * 解と違うタイルのせいで、ルールだけで決まるマスが無くなったときに限り、手詰まりのままにしないよう、そのタイルのマスを示す。
 */
export function findTakuzuTutorialHintCellIndex(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): number | null {
  const deducibleCellIndex = findDeducibleCellIndex(state.board, earnedRuleIds);
  if (deducibleCellIndex !== null) {
    return deducibleCellIndex;
  }
  const mistakenCellIndex = state.board.cells.findIndex(
    (cell, cellIndex) => cell !== null && cell !== solution.cells[cellIndex],
  );
  return mistakenCellIndex >= 0 ? mistakenCellIndex : null;
}

export const takuzuTutorial: Tutorial<
  TakuzuTutorialRuleId,
  TakuzuTutorialStep,
  TakuzuTutorialBoardState,
  TakuzuTutorialAction
> = {
  intro: {
    purpose: "すべてのマスを四角か丸で\nルールどおりに埋めるパズルです",
    goalCaption: "この盤面がゴールです",
    startCaption: "最初は一部のマスだけ埋まっています",
  },
  rules: [
    { id: "run", label: "3つ続けない" },
    { id: "count", label: "同じ数にする" },
    { id: "duplicate", label: "同じ並びにしない" },
  ],
  steps,
  freePlay: {
    headline: "残りを埋めると完成です",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも 8×8 の盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
    },
  },
  start: startTakuzuTutorial,
  goal: getTakuzuTutorialGoal,
  perform: performTakuzuTutorialAction,
  describeViolation: describeTakuzuTutorialViolation,
};

export const _private = {
  givens,
  solution,
  deduceCell,
  listLessons,
  findVisibleViolations,
};
