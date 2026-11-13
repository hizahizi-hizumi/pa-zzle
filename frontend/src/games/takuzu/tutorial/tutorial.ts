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
  /** 印のマスに途中のタイルを置いている間の一言。`null` なら `message` のまま。 */
  midwayMessage: TutorialMessage | null;
  /** 印を付け、手順の間だけ操作を受け付けるマス。すべて解と同じタイルになったら次の手順へ進む。 */
  cellIndices: readonly number[];
  /**
   * この手順で初めて使わせる見方。
   * 操作を教える手順と、使わせた見方をおさらいする手順では `null`。
   */
  lesson: TakuzuTutorialLesson | null;
};

export type TakuzuTutorialMove = {
  cellIndex: number;
  /** 手を引いている手順のマスを、正しい手へ向かう途中にした。 */
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
 * 最初    手順の後  解
 * ....   ..B.     AABB
 * ABA.   ABAB     ABAB
 * .BA.   BBAA     BBAA
 * ...A   B..A     BABA
 * ```
 */
const givens = parseTakuzuBoard(["....", "ABA.", ".BA.", "...A"]);
const solution = parseTakuzuBoard(["AABB", "ABAB", "BBAA", "BABA"]);

function cellAt(row: number, column: number): number {
  return (row - 1) * givens.size + (column - 1);
}

/**
 * - 操作: 4行目の1列目に丸を置く。途中の四角を置いた盤面は、どのルールにも当たらない。
 * - 3つ続かない: 3列目に縦に並んだ四角2つの上を丸で埋める。
 * - 同じ数: 2行目の残りを丸で埋める。2行目がそろう。
 * - 同じ並び: 3行目 `.BA.` を、真上でそろった2行目 `ABAB` と同じにしない入れ方で埋める。3行目の2マスは、3つ続かないことと同じ数だけでは決まらない。
 * 手を離した後に残る5マスは、列を見ないと解き切れない。
 */
const steps: readonly TakuzuTutorialStep[] = [
  {
    message: {
      headline: "このマスをタップして四角を置きます",
      detail: "まず形の置き方を練習します",
    },
    midwayMessage: {
      headline: "もう一度タップすると\n丸に変わります",
      detail: "丸をタップすると消えます",
    },
    introducedRuleId: null,
    cellIndices: [cellAt(4, 1)],
    lesson: null,
  },
  {
    message: {
      headline: "同じ形は2つまで並べられます",
      detail: null,
    },
    midwayMessage: null,
    introducedRuleId: "run",
    cellIndices: [cellAt(1, 3)],
    lesson: { ruleId: "run", axis: "column" },
  },
  {
    message: {
      headline: "全ての行と列は四角と丸が\n同じ数ずつ入ります",
      detail: null,
    },
    midwayMessage: null,
    introducedRuleId: "count",
    cellIndices: [cellAt(2, 4)],
    lesson: { ruleId: "count", axis: "row" },
  },
  {
    message: {
      headline: "全ての行と行、列と列で違う並びにします",
      detail: "上の行と違う並びで埋めます",
    },
    midwayMessage: null,
    introducedRuleId: "duplicate",
    cellIndices: [cellAt(3, 1), cellAt(3, 4)],
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
    // 行・列を通して数えるルールなので、もう入っているタイルをすべて見せる。
    reasonCellIndices: cellIndices.filter(
      (_, position) => cells[position] !== null,
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

  // 見比べるのは、同じ並びになってしまう相手と、この行・列にもう入っているタイルの両方。
  const ownFilledCellIndices = getTakuzuLineCellIndices(
    board.size,
    line,
  ).filter((_, index) => cells[index] !== null);
  function withTwin(twin: TakuzuLine): readonly number[] {
    return [
      ...getTakuzuLineCellIndices(board.size, twin),
      ...ownFilledCellIndices,
    ];
  }

  const [first, second] = takuzuTiles.map(findTwin);
  if (first && !second) {
    return { tile: "b", reasonCellIndices: withTwin(first) };
  }
  if (second && !first) {
    return { tile: "a", reasonCellIndices: withTwin(second) };
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

/** 解と違うタイルのマスを示すときは、`reasonCellIndices` は空で、`ruleId` は `null`。 */
export type TakuzuTutorialHint = {
  cellIndex: number;
  reasonCellIndices: readonly number[];
  ruleId: TakuzuTutorialRuleId | null;
};

function isBetweenReasons({
  cellIndex,
  reasonCellIndices,
}: TakuzuTutorialHint): boolean {
  return (
    Math.min(...reasonCellIndices) < cellIndex &&
    cellIndex < Math.max(...reasonCellIndices)
  );
}

/** 見つけやすいルールで決まるマスほど先に返す。3つ続かない、同じ数、同じ並びの順。 */
function findDeducibleHint(
  board: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuTutorialHint | null {
  for (const ruleId of ruleIds) {
    const lessons = listLessons([ruleId]);
    const hints = [...board.cells.keys()].flatMap(
      (cellIndex): TakuzuTutorialHint[] => {
        const deduction = deduceCell(board, lessons, cellIndex);
        return deduction
          ? [
              {
                cellIndex,
                reasonCellIndices: deduction.reasonCellIndices,
                ruleId,
              },
            ]
          : [];
      },
    );
    // 手順で見せた、並んだ2つの隣で決まるマスを、挟まれて決まるマスより先に示す。
    const hint = hints.find((found) => !isBetweenReasons(found)) ?? hints[0];
    if (hint) {
      return hint;
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

/** 伝えた見方のぶんだけの違反。 */
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

/** 盤面に見せる違反。 */
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
  ruleId: TakuzuTutorialRuleId;
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
            ruleId: "run" as const,
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
            ruleId: "count" as const,
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
    ruleId: "duplicate" as const,
    cellIndices: getTakuzuLineCellIndices(board.size, line),
    message: {
      headline: `${describeTwinLine(board, violations.duplicateLines, line)}と同じ並びになっています`,
      detail: null,
    },
  }));
  return [...runs, ...overfilled, ...duplicates];
}

function findViolationFixCellIndex(
  { board, lastMove }: TakuzuTutorialBoardState,
  violations: TakuzuRuleViolations,
): number | null {
  const mistakenCellIndices = [...board.cells.keys()].filter(
    (cellIndex) =>
      board.cells[cellIndex] !== null &&
      board.cells[cellIndex] !== solution.cells[cellIndex] &&
      isCellInViolation(board, violations, cellIndex),
  );
  const lastCellIndex = lastMove?.cellIndex;
  return (
    mistakenCellIndices.find((cellIndex) => cellIndex === lastCellIndex) ??
    mistakenCellIndices[0] ??
    null
  );
}

export function findTakuzuTutorialViolationFixCellIndex(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): number | null {
  return findViolationFixCellIndex(
    state,
    findShownViolations(state, listTaughtLessons(situation), false),
  );
}

function describeViolationFix(
  { board, lastMove }: TakuzuTutorialBoardState,
  fixCellIndex: number | null,
): string | null {
  if (fixCellIndex === null) {
    return null;
  }
  const isLastCell = fixCellIndex === lastMove?.cellIndex;
  return board.cells[fixCellIndex] === "a"
    ? `${isLastCell ? "もう一度" : "印のマスを"}タップすると丸に変わります`
    : `${isLastCell ? "あと" : "印のマスを"}2回タップすると四角に変わります`;
}

/** 手順のマスを正しい手へ向かう途中にしたまま手が止まったときの一言。ルールに合わないところが無ければ `null`。 */
export function describeTakuzuTutorialMidwayViolation(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TutorialMessage | null {
  const violations = findShownViolations(
    state,
    listTaughtLessons(situation),
    true,
  );
  return hasTakuzuRuleViolation(violations)
    ? describeTakuzuTutorialViolation(situation, state, true)
    : null;
}

/** 直前に置いたマスが当たっている違反を先に言う。古い違反が残っていても、今の手の結果を返すため。 */
function describeTakuzuTutorialViolation(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  towardStepSettled = false,
): TutorialMessage {
  const violations = findShownViolations(
    state,
    listTaughtLessons(situation),
    towardStepSettled,
  );
  const descriptions = listViolationDescriptions(state.board, violations);
  const lastCellIndex = state.lastMove?.cellIndex;
  const description =
    descriptions.find(({ cellIndices }) =>
      cellIndices.some((cellIndex) => cellIndex === lastCellIndex),
    ) ?? descriptions[0];
  const message = description?.message ?? {
    headline: "ルールに合わないところがあります",
    detail: null,
  };
  // 同じ並びは、手順の2マスの形を入れ替えれば直る。1マスずつ直す言い方では、どちらのマスのことか分からない。
  const mistakenStepCellCount = (situation.step?.cellIndices ?? []).filter(
    (cellIndex) =>
      state.board.cells[cellIndex] !== null &&
      state.board.cells[cellIndex] !== solution.cells[cellIndex],
  ).length;
  if (description?.ruleId === "duplicate" && mistakenStepCellCount === 2) {
    return { ...message, detail: "印の2マスの形を入れ替えます" };
  }
  return {
    ...message,
    detail: describeViolationFix(
      state,
      findViolationFixCellIndex(state, violations),
    ),
  };
}

export function describeTakuzuTutorialStep(
  step: TakuzuTutorialStep,
  { board }: TakuzuTutorialBoardState,
): TutorialMessage {
  const midway = step.cellIndices.some(
    (cellIndex) =>
      board.cells[cellIndex] !== null &&
      board.cells[cellIndex] !== solution.cells[cellIndex],
  );
  return midway ? (step.midwayMessage ?? step.message) : step.message;
}

export const TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT = givens.cells.filter(
  (cell) => cell === null,
).length;

/** 最初から置かれていないマスのうち、解と同じタイルを置いたマスの割合。 */
export function getTakuzuTutorialProgressRatio({
  board,
}: TakuzuTutorialBoardState): number {
  const solvedCount = board.cells.filter(
    (cell, cellIndex) =>
      givens.cells[cellIndex] === null && cell === solution.cells[cellIndex],
  ).length;
  return solvedCount / TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT;
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
  // 手順の間は同じ決め手を見せ続けるため、手順のマスをすべて空けた盤面で探す。
  // 1マス置いた後に、残りのマスが別のルールで決まるようになっても、教えているルールの決め手から替えない。
  const cleared = (step?.cellIndices ?? []).reduce(
    (current, cellIndex) => placeTakuzuCell(givens, current, cellIndex, null),
    state.board,
  );
  const reasonCellIndices = (step?.cellIndices ?? []).flatMap((cellIndex) => {
    const deduction = deduceCell(cleared, lessons, cellIndex);
    return deduction && deduction.tile === solution.cells[cellIndex]
      ? deduction.reasonCellIndices
      : [];
  });
  return [...new Set(reasonCellIndices)];
}

/** 手を離した後に示す手がかり。無ければ `null`。 */
export function findTakuzuTutorialHint(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TakuzuTutorialHint | null {
  const deducibleHint = findDeducibleHint(state.board, earnedRuleIds);
  if (deducibleHint !== null) {
    return deducibleHint;
  }
  const mistakenCellIndex = state.board.cells.findIndex(
    (cell, cellIndex) => cell !== null && cell !== solution.cells[cellIndex],
  );
  return mistakenCellIndex >= 0
    ? { cellIndex: mistakenCellIndex, reasonCellIndices: [], ruleId: null }
    : null;
}

/** 手順の一言とは改行の位置だけを変えることがある。 */
const ruleHintHeadlines = {
  run: "同じ形は\n2つまで並べられます",
  count: "全ての行と列は四角と丸が同じ数ずつ入ります",
  duplicate: "全ての行と行、列と列で違う並びにします",
} as const satisfies Record<TakuzuTutorialRuleId, string>;

export function describeTakuzuTutorialRule(
  ruleId: TakuzuTutorialRuleId,
): TutorialMessage | null {
  const step = steps.find((candidate) => candidate.introducedRuleId === ruleId);
  return step
    ? { headline: ruleHintHeadlines[ruleId], detail: step.message.detail }
    : null;
}

export const takuzuTutorial: Tutorial<
  TakuzuTutorialRuleId,
  TakuzuTutorialStep,
  TakuzuTutorialBoardState,
  TakuzuTutorialAction
> = {
  intro: {
    purpose: "すべてのマスを四角か丸で埋めるパズルです",
    goalCaption: "青い形を置いていきます",
  },
  rules: [
    { id: "run", label: "同じ形は2つまで並べられます" },
    { id: "count", label: "全ての行と列は四角と丸が同じ数ずつ入ります" },
    { id: "duplicate", label: "全ての行と行、列と列で違う並びにします" },
  ],
  steps,
  freePlay: {
    headline: "残りも埋めてみましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番の盤面は8×8です\n置き直さないほど高評価です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
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
