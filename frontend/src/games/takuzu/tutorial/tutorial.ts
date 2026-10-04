import {
  getTakuzuLineCellIndices,
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
  type TakuzuRuleViolations,
} from "@/games/takuzu/puzzle/rules";
import {
  getNextTakuzuCell,
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

/**
 * - `run`: 同じタイルは3つ続かない。
 * - `count`: 1つの行・列の四角と丸は同じ数。
 * - `duplicate`: 同じ並びの行・列は作れない。
 */
export type TakuzuTutorialRuleId = "run" | "count" | "duplicate";

/** 盤面と同じく、巡回で押すか、キーで直接置くか。 */
export type TakuzuTutorialAction =
  | { type: "cycle"; cellIndex: number; direction: TakuzuCycleDirection }
  | { type: "place"; cellIndex: number; cell: TakuzuCell };

/**
 * `cellIndices`: 印を付け、手順の間だけ操作を受け付けるマス。すべて解と同じタイルになったら次の手順へ進む。
 * ルールを示す手順では、示したルールで決まるマスにする。
 */
export type TakuzuTutorialStep = TutorialStep<TakuzuTutorialRuleId> & {
  cellIndices: readonly number[];
};

/**
 * 直前の手。盤面の上の合図に使う。
 * - `violated`: 置いたマスが、ルールに合わないところに入っている。
 * - `reasonCellIndices`: 置いたタイルが手前の盤面だけで決まっていたときの決め手のマス。決まっていなければ空。
 */
export type TakuzuTutorialMove = {
  cellIndex: number;
  violated: boolean;
  reasonCellIndices: readonly number[];
};

/** `moveCount`: 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。 */
export type TakuzuTutorialBoardState = {
  board: TakuzuBoard;
  moveCount: number;
  lastMove: TakuzuTutorialMove | null;
};

type TakuzuTutorialSituation = TutorialSituation<
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
 * ....   ABAB
 * B..A   BABA
 * BB..   BBAA
 * ```
 */
const givens = parseTakuzuBoard([".A..", "....", "B..A", "BB.."]);
const solution = parseTakuzuBoard(["AABB", "ABAB", "BABA", "BBAA"]);

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * givens.size + (column - 1);
}

/**
 * 1行目の四角を自分で置いて四角を2つ並べ、その隣・行の残りと、ルールを1つずつ使って埋めていく。
 * 丸の練習で置く4列目の丸は、4列目の同じ数で決まるマスを作る。
 * 同じ並びの行・列を作れないことは、2行目 `A..B` を、真上でそろった1行目 `AABB` と同じにしない入れ方で示す。
 * 2行目の2マスはどちらも、3つ続かないことと同じ数だけでは決まらない。
 * 手順を終えると3行目の2マスが残り、ルールで1つずつ決まる。
 */
const steps: readonly TakuzuTutorialStep[] = [
  {
    message: {
      headline: "四角と丸で、盤面を埋めていきます",
      detail: "印のマスをタップしてください",
    },
    introducedRuleId: null,
    cellIndices: [cellAt(1, 1)],
  },
  {
    message: { headline: "2回タップすると、丸になります", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(2, 4)],
  },
  {
    message: { headline: "同じものは、3つ続けて並べられません", detail: null },
    introducedRuleId: "run",
    cellIndices: [cellAt(1, 3)],
  },
  {
    message: { headline: "縦にも、3つ続けて並べられません", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(2, 1)],
  },
  {
    message: { headline: "行の四角と丸は、同じ数ずつです", detail: null },
    introducedRuleId: "count",
    cellIndices: [cellAt(1, 4)],
  },
  {
    message: { headline: "列も、四角と丸は同じ数ずつです", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(4, 4)],
  },
  {
    message: {
      headline: "このマスも、ここまでのルールで決まります",
      detail: null,
    },
    introducedRuleId: null,
    cellIndices: [cellAt(4, 3)],
  },
  {
    message: {
      headline: "同じ並びの行・列は作れません",
      detail: "上の行と見比べてください",
    },
    introducedRuleId: "duplicate",
    cellIndices: [cellAt(2, 2), cellAt(2, 3)],
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

function getLineCells(
  board: TakuzuBoard,
  cellIndices: readonly number[],
): TakuzuCell[] {
  return cellIndices.map((cellIndex) => board.cells[cellIndex] ?? null);
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

  const filledPeers = listTakuzuLines(board.size)
    .filter((peer) => peer.axis === line.axis && peer.index !== line.index)
    .map((peer) => getTakuzuLineCellIndices(board.size, peer))
    .filter((peerCellIndices) =>
      getLineCells(board, peerCellIndices).every((cell) => cell !== null),
    );
  function findTwin(tile: TakuzuTile): readonly number[] | undefined {
    const filled = cells.map(
      (cell, index) => cell ?? (index === position ? tile : getOtherTile(tile)),
    );
    return filledPeers.find((peerCellIndices) =>
      getLineCells(board, peerCellIndices).every(
        (cell, index) => cell === filled[index],
      ),
    );
  }

  const [first, second] = takuzuTiles.map(findTwin);
  if (first && !second) {
    return { tile: "b", reasonCellIndices: first };
  }
  if (second && !first) {
    return { tile: "a", reasonCellIndices: second };
  }
  return null;
}

function deduceCell(
  board: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
  cellIndex: number,
): TakuzuDeduction | null {
  if (board.cells[cellIndex] !== null) {
    return null;
  }

  for (const line of listTakuzuLines(board.size)) {
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    const position = cellIndices.indexOf(cellIndex);
    if (position < 0) {
      continue;
    }
    const cells = getLineCells(board, cellIndices);
    const deduction =
      (ruleIds.includes("run") && deduceByRun(cells, cellIndices, position)) ||
      (ruleIds.includes("count") && deduceByCount(cells, cellIndices)) ||
      (ruleIds.includes("duplicate") &&
        deduceByDuplicate(board, line, cells, position));
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
    const cellIndex = board.cells.findIndex(
      (_, index) => deduceCell(board, [ruleId], index) !== null,
    );
    if (cellIndex >= 0) {
      return cellIndex;
    }
  }
  return null;
}

/** 手に入れたルールのぶんだけの違反。まだ知らないルールの違反は見せない。 */
function findVisibleViolations(
  board: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuRuleViolations {
  const violations = findTakuzuRuleViolations(board);
  return {
    runCellIndices: ruleIds.includes("run") ? violations.runCellIndices : [],
    overfilledLines: ruleIds.includes("count")
      ? violations.overfilledLines
      : [],
    duplicateLines: ruleIds.includes("duplicate")
      ? violations.duplicateLines
      : [],
  };
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

function isGiven(cellIndex: number): boolean {
  return (givens.cells[cellIndex] ?? null) !== null;
}

function isSolved(board: TakuzuBoard): boolean {
  return (
    board.cells.every((cell) => cell !== null) &&
    !hasTakuzuRuleViolation(findTakuzuRuleViolations(board))
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
  before: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
  cellIndex: number,
  placed: TakuzuCell,
): readonly number[] {
  const cells = [...before.cells];
  cells[cellIndex] = null;
  const deduction = deduceCell({ ...before, cells }, ruleIds, cellIndex);
  return deduction && deduction.tile === placed
    ? deduction.reasonCellIndices
    : [];
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
  { step, earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  action: TakuzuTutorialAction,
): { state: TakuzuTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { cellIndex } = action;
  const current = state.board.cells[cellIndex];
  const outsideStep = step !== null && !step.cellIndices.includes(cellIndex);
  if (current === undefined || isGiven(cellIndex) || outsideStep) {
    return { state, outcome: "ignored" };
  }
  const placed = getPlacedCell(current, action);
  if (placed === current) {
    return { state, outcome: "ignored" };
  }

  const cells = [...state.board.cells];
  cells[cellIndex] = placed;
  const board = { ...state.board, cells };
  const visibleViolations = findVisibleViolations(board, earnedRuleIds);
  const next: TakuzuTutorialBoardState = {
    board,
    moveCount: state.moveCount + 1,
    lastMove: {
      cellIndex,
      violated: isCellInViolation(board, visibleViolations, cellIndex),
      reasonCellIndices:
        placed === null
          ? []
          : getPlacementReason(state.board, earnedRuleIds, cellIndex, placed),
    },
  };

  if (isSolved(board)) {
    return { state: next, outcome: "solved" };
  }
  if (hasTakuzuRuleViolation(visibleViolations)) {
    return { state: next, outcome: "violated" };
  }
  if (step !== null && isStepDone(step, board)) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "continued" };
}

export function getTakuzuTutorialCellViews(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TakuzuCellView[] {
  const runCellIndices = new Set(
    findVisibleViolations(state.board, earnedRuleIds).runCellIndices,
  );
  return state.board.cells.map(function createCellView(cell, cellIndex) {
    return {
      cell,
      given: isGiven(cellIndex),
      inViolatingRun: runCellIndices.has(cellIndex),
    };
  });
}

function isSameLine(left: TakuzuLine, right: TakuzuLine): boolean {
  return left.axis === right.axis && left.index === right.index;
}

export function getTakuzuTutorialLineViolations(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TakuzuLineViolationView[] {
  const { overfilledLines, duplicateLines } = findVisibleViolations(
    state.board,
    earnedRuleIds,
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

/** 違反の一言の補足に添える、当たったルールそのもの。 */
const ruleStatements = {
  run: "同じものは、3つ続けて並べられません",
  count: "行も列も、四角と丸は同じ数ずつです",
  duplicate: "同じ並びの行・列は作れません",
} as const satisfies Record<TakuzuTutorialRuleId, string>;

/** 隣り合う行・列は向きで、離れた行・列は何番目かで言う。 */
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

/** 同じ並びになった行・列から見た、同じ並びの相手のうち最も近いもの。 */
function describeTwinLine(
  board: TakuzuBoard,
  duplicateLines: readonly TakuzuLine[],
  line: TakuzuLine,
): string {
  const pattern = getLineCells(
    board,
    getTakuzuLineCellIndices(board.size, line),
  ).join("");
  const twin = duplicateLines
    .filter(
      (other) =>
        other.axis === line.axis &&
        other.index !== line.index &&
        getLineCells(board, getTakuzuLineCellIndices(board.size, other)).join(
          "",
        ) === pattern,
    )
    .sort(
      (left, right) =>
        Math.abs(left.index - line.index) - Math.abs(right.index - line.index),
    )[0];
  return twin ? getLinePlaceName(line, twin) : `別の${lineNames[line.axis]}`;
}

/** 1つの違反と、その違反に当たっているマス。 */
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
              detail: ruleStatements.run,
            },
          },
        ]
      : [];
  });
  const overfilled = violations.overfilledLines.flatMap((line) => {
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    const cells = getLineCells(board, cellIndices);
    const tile = takuzuTiles.find(
      (candidate) => countTile(cells, candidate) > cells.length / 2,
    );
    return tile
      ? [
          {
            cellIndices,
            message: {
              headline: `${tileNames[tile]}が多すぎる${lineNames[line.axis]}があります`,
              detail: ruleStatements.count,
            },
          },
        ]
      : [];
  });
  const duplicates = violations.duplicateLines.map((line) => ({
    cellIndices: getTakuzuLineCellIndices(board.size, line),
    message: {
      headline: `${describeTwinLine(board, violations.duplicateLines, line)}と同じ並びになっています`,
      detail: ruleStatements.duplicate,
    },
  }));
  return [...runs, ...overfilled, ...duplicates];
}

/** 直前に置いたマスが当たっている違反を先に言う。古い違反が残っていても、今の手の結果を返すため。 */
function describeTakuzuTutorialViolation(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): TutorialMessage {
  const descriptions = listViolationDescriptions(
    state.board,
    findVisibleViolations(state.board, earnedRuleIds),
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

/** 手順で印を付けるマスのうち、まだ解と同じタイルになっていないもの。手を離した後は空。 */
export function getTakuzuTutorialStepCellIndices(
  { step }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): readonly number[] {
  return (step?.cellIndices ?? []).filter(
    (cellIndex) => state.board.cells[cellIndex] !== solution.cells[cellIndex],
  );
}

/** 手を離した後、手が止まったときに示す、今の盤面と手に入れたルールだけで決まるマス。無ければ `null`。 */
export function findTakuzuTutorialHintCellIndex(
  { earnedRuleIds }: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
): number | null {
  return findDeducibleCellIndex(state.board, earnedRuleIds);
}

export const takuzuTutorial: Tutorial<
  TakuzuTutorialRuleId,
  TakuzuTutorialStep,
  TakuzuTutorialBoardState,
  TakuzuTutorialAction
> = {
  rules: [
    { id: "run", label: "3つ続かない" },
    { id: "count", label: "同じ数" },
    { id: "duplicate", label: "同じ並びなし" },
  ],
  steps,
  freePlay: {
    headline: "残りを埋めると完成です",
    detail: "迷ったら、少し待つと印が出ます",
  },
  completion: {
    headline: "完成です",
    detail: "本番は 8×8 で、ルールは同じです",
  },
  start: startTakuzuTutorial,
  goal: getTakuzuTutorialGoal,
  perform: performTakuzuTutorialAction,
  describeViolation: describeTakuzuTutorialViolation,
};

export const _private = { givens, solution, deduceCell };
