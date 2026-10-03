import {
  getTakuzuGridLineCellIndices,
  listTakuzuGridLines,
  parseTakuzuGrid,
  type TakuzuCell,
  type TakuzuGrid,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import {
  findTakuzuGridRuleViolations,
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
  TutorialGuide,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialStage,
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
 * - `givens`: 最初からあるタイル。固定マスになる。
 * - `goal`: 埋め終えた盤面がこれと同じなら解ける。ルールを持たず操作だけを練習するステージに使い、ルールによらない案内はここへ手を引く。
 *   `null` なら、すべてのルールに合うように埋め切れば解ける。
 * - `ruleIds`: 盤面の判定に使うルール。途中で示すルールは、示すまで含めない。
 * - `idleHintDelayMs`: 手を離している間に、手が止まってから決まるマスを示すまでの間。
 */
export type TakuzuTutorialStage = TutorialStage<TakuzuTutorialRuleId> & {
  givens: TakuzuGrid;
  goal: TakuzuGrid | null;
  ruleIds: readonly TakuzuTutorialRuleId[];
  idleHintDelayMs: number;
};

/**
 * 直前の手。盤面の上の合図に使う。
 * - `violated`: 置いたマスが、ルールに合わないところに入っている。
 * - `reasonCellIndices`: 置いたタイルが手前の盤面だけで決まっていたときの決め手のマス。決まっていなければ空。
 * - `revealedRuleId`: この手で、ステージの途中で示すルールを示したとき、そのルール。
 */
export type TakuzuTutorialMove = {
  cellIndex: number;
  violated: boolean;
  reasonCellIndices: readonly number[];
  revealedRuleId: TakuzuTutorialRuleId | null;
};

/**
 * - `ruleIds`: 今の判定に使うルール。ステージの途中で示したルールを含む。
 * - `moveCount`: 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。
 * - `guidedCellIndex`: 手を引いている間に示し、操作を受け付ける唯一のマス。案内を始めた盤面で決め、その案内の間は動かさない。手を離していれば `null`。
 */
export type TakuzuTutorialStageState = {
  grid: TakuzuGrid;
  ruleIds: readonly TakuzuTutorialRuleId[];
  moveCount: number;
  lastMove: TakuzuTutorialMove | null;
  guidedCellIndex: number | null;
};

/** 空きマスに入るタイルが、今の盤面とルールだけで決まるときの、そのタイルと決め手のマス。 */
type TakuzuDeduction = {
  tile: TakuzuTile;
  reasonCellIndices: readonly number[];
};

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
  grid: TakuzuGrid,
  cellIndices: readonly number[],
): TakuzuCell[] {
  return cellIndices.map((cellIndex) => grid.cells[cellIndex] ?? null);
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
  if (cells.length % 2 !== 0) {
    return null;
  }
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
  grid: TakuzuGrid,
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

  const filledPeers = listTakuzuGridLines(grid.shape)
    .filter((peer) => peer.axis === line.axis && peer.index !== line.index)
    .map((peer) => getTakuzuGridLineCellIndices(grid.shape, peer))
    .filter((peerCellIndices) =>
      getLineCells(grid, peerCellIndices).every((cell) => cell !== null),
    );
  function findTwin(tile: TakuzuTile): readonly number[] | undefined {
    const filled = cells.map(
      (cell, index) => cell ?? (index === position ? tile : getOtherTile(tile)),
    );
    return filledPeers.find((peerCellIndices) =>
      getLineCells(grid, peerCellIndices).every(
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
  grid: TakuzuGrid,
  ruleIds: readonly TakuzuTutorialRuleId[],
  cellIndex: number,
): TakuzuDeduction | null {
  if (grid.cells[cellIndex] !== null) {
    return null;
  }

  for (const line of listTakuzuGridLines(grid.shape)) {
    const cellIndices = getTakuzuGridLineCellIndices(grid.shape, line);
    const position = cellIndices.indexOf(cellIndex);
    if (position < 0) {
      continue;
    }
    const cells = getLineCells(grid, cellIndices);
    const deduction =
      (ruleIds.includes("run") && deduceByRun(cells, cellIndices, position)) ||
      (ruleIds.includes("count") && deduceByCount(cells, cellIndices)) ||
      (ruleIds.includes("duplicate") &&
        deduceByDuplicate(grid, line, cells, position));
    if (deduction) {
      return deduction;
    }
  }
  return null;
}

/** 見つけやすいルールで決まるマスほど先に返す。3つ続かない、同じ数、同じ並びの順。 */
function findDeducibleCellIndex(
  grid: TakuzuGrid,
  ruleIds: readonly TakuzuTutorialRuleId[],
): number | null {
  for (const ruleId of ruleIds) {
    const cellIndex = grid.cells.findIndex(
      (_, index) => deduceCell(grid, [ruleId], index) !== null,
    );
    if (cellIndex >= 0) {
      return cellIndex;
    }
  }
  return null;
}

/** 判定に使うルールのぶんだけの違反。まだ知らないルールの違反は見せない。 */
function findVisibleViolations(
  grid: TakuzuGrid,
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuRuleViolations {
  const violations = findTakuzuGridRuleViolations(grid);
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
  grid: TakuzuGrid,
  violations: TakuzuRuleViolations,
  cellIndex: number,
): boolean {
  const lines = [...violations.overfilledLines, ...violations.duplicateLines];
  return (
    violations.runCellIndices.includes(cellIndex) ||
    lines.some((line) =>
      getTakuzuGridLineCellIndices(grid.shape, line).includes(cellIndex),
    )
  );
}

function isGridFilled(grid: TakuzuGrid): boolean {
  return grid.cells.every((cell) => cell !== null);
}

/**
 * まだ示していないルールを、今示すか。必要になる直前に示す。
 * 知らないルールの違反（同じ並び）を作ったときと、知っているルールだけでは次に決まるマスが無くなったとき。
 */
function shouldRevealRule(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
  grid: TakuzuGrid,
): boolean {
  const revealedRuleId = stage.revealedRule?.id;
  if (!revealedRuleId || state.ruleIds.includes(revealedRuleId)) {
    return false;
  }
  const violations = findVisibleViolations(grid, [
    ...state.ruleIds,
    revealedRuleId,
  ]);
  if (violations.duplicateLines.length > 0) {
    return true;
  }
  return (
    !hasTakuzuRuleViolation(findVisibleViolations(grid, state.ruleIds)) &&
    !isGridFilled(grid) &&
    findDeducibleCellIndex(grid, state.ruleIds) === null
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
  before: TakuzuGrid,
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

function startTakuzuTutorialStage(
  stage: TakuzuTutorialStage,
): TakuzuTutorialStageState {
  return {
    grid: stage.givens,
    ruleIds: stage.ruleIds,
    moveCount: 0,
    lastMove: null,
    guidedCellIndex: null,
  };
}

/** 目標と違うマスのうち、最初のもの。 */
function findCellIndexOffGoal(
  goal: TakuzuGrid,
  grid: TakuzuGrid,
): number | null {
  const cellIndex = grid.cells.findIndex(
    (cell, index) => cell !== goal.cells[index],
  );
  return cellIndex >= 0 ? cellIndex : null;
}

function findGuidedCellIndex(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
  guide: TutorialGuide<TakuzuTutorialRuleId>,
): number | null {
  if (guide.ruleId !== null) {
    return findTakuzuTutorialHintCellIndex(state, guide.ruleId);
  }
  return stage.goal ? findCellIndexOffGoal(stage.goal, state.grid) : null;
}

function startTakuzuTutorialGuide(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
  guide: TutorialGuide<TakuzuTutorialRuleId> | null,
): TakuzuTutorialStageState {
  return {
    ...state,
    guidedCellIndex:
      guide === null ? null : findGuidedCellIndex(stage, state, guide),
  };
}

function isStageSolved(stage: TakuzuTutorialStage, grid: TakuzuGrid): boolean {
  if (!isGridFilled(grid)) {
    return false;
  }
  return stage.goal
    ? findCellIndexOffGoal(stage.goal, grid) === null
    : !hasTakuzuRuleViolation(findTakuzuGridRuleViolations(grid));
}

function isOutsideGuide(
  state: TakuzuTutorialStageState,
  cellIndex: number,
): boolean {
  return state.guidedCellIndex !== null && state.guidedCellIndex !== cellIndex;
}

function performTakuzuTutorialAction(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
  action: TakuzuTutorialAction,
): { state: TakuzuTutorialStageState; outcome: TutorialMoveOutcome } {
  const { cellIndex } = action;
  const current = state.grid.cells[cellIndex];
  const given = (stage.givens.cells[cellIndex] ?? null) !== null;
  if (current === undefined || given || isOutsideGuide(state, cellIndex)) {
    return { state, outcome: "ignored" };
  }
  const placed = getPlacedCell(current, action);
  if (placed === current) {
    return { state, outcome: "ignored" };
  }

  const cells = [...state.grid.cells];
  cells[cellIndex] = placed;
  const grid = { ...state.grid, cells };
  const revealedRuleId = shouldRevealRule(stage, state, grid)
    ? (stage.revealedRule?.id ?? null)
    : null;
  const ruleIds =
    revealedRuleId === null
      ? state.ruleIds
      : [...state.ruleIds, revealedRuleId];
  const visibleViolations = findVisibleViolations(grid, ruleIds);
  const reasonCellIndices =
    placed === null
      ? []
      : getPlacementReason(state.grid, state.ruleIds, cellIndex, placed);
  const next: TakuzuTutorialStageState = {
    ...state,
    grid,
    ruleIds,
    moveCount: state.moveCount + 1,
    lastMove: {
      cellIndex,
      violated: isCellInViolation(grid, visibleViolations, cellIndex),
      reasonCellIndices,
      revealedRuleId,
    },
  };

  if (isStageSolved(stage, grid)) {
    return { state: next, outcome: "solved" };
  }
  if (revealedRuleId !== null) {
    return { state: next, outcome: "rule-revealed" };
  }
  if (hasTakuzuRuleViolation(visibleViolations)) {
    return { state: next, outcome: "violated" };
  }
  const placedAsGuided = stage.goal
    ? placed !== null && placed === stage.goal.cells[cellIndex]
    : reasonCellIndices.length > 0;
  const followedGuide = state.guidedCellIndex === cellIndex && placedAsGuided;
  return { state: next, outcome: followedGuide ? "guided" : "continued" };
}

export function getTakuzuTutorialCellViews(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
): TakuzuCellView[] {
  const runCellIndices = new Set(
    findVisibleViolations(state.grid, state.ruleIds).runCellIndices,
  );
  return state.grid.cells.map(function createCellView(cell, cellIndex) {
    return {
      cell,
      given: (stage.givens.cells[cellIndex] ?? null) !== null,
      inViolatingRun: runCellIndices.has(cellIndex),
    };
  });
}

function isSameLine(left: TakuzuLine, right: TakuzuLine): boolean {
  return left.axis === right.axis && left.index === right.index;
}

export function getTakuzuTutorialLineViolations(
  state: TakuzuTutorialStageState,
): TakuzuLineViolationView[] {
  const { overfilledLines, duplicateLines } = findVisibleViolations(
    state.grid,
    state.ruleIds,
  );
  return listTakuzuGridLines(state.grid.shape).flatMap(
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
  run: "同じものは3つ続けて置けない",
  count: "行も列も、四角と丸は同じ数",
  duplicate: "同じ並びの行・列は作れない",
} as const satisfies Record<TakuzuTutorialRuleId, string>;

/** 1つの違反と、その違反に当たっているマス。 */
type TakuzuViolationDescription = {
  cellIndices: readonly number[];
  message: TutorialMessage;
};

function listViolationDescriptions(
  grid: TakuzuGrid,
  violations: TakuzuRuleViolations,
): TakuzuViolationDescription[] {
  const singleRow = grid.shape.rowCount === 1;
  const runs = violations.runCellIndices.flatMap((cellIndex) => {
    const tile = grid.cells[cellIndex];
    return tile
      ? [
          {
            cellIndices: [cellIndex],
            message: {
              headline: `${tileNames[tile]}が3つ続いている`,
              detail: ruleStatements.run,
            },
          },
        ]
      : [];
  });
  const overfilled = violations.overfilledLines.flatMap((line) => {
    const cellIndices = getTakuzuGridLineCellIndices(grid.shape, line);
    const cells = getLineCells(grid, cellIndices);
    const tile = takuzuTiles.find(
      (candidate) => countTile(cells, candidate) > cells.length / 2,
    );
    return tile
      ? [
          {
            cellIndices,
            message: {
              headline: singleRow
                ? `${tileNames[tile]}が多すぎる`
                : `${tileNames[tile]}が多すぎる${lineNames[line.axis]}がある`,
              detail: ruleStatements.count,
            },
          },
        ]
      : [];
  });
  const duplicates = violations.duplicateLines.map((line) => ({
    cellIndices: getTakuzuGridLineCellIndices(grid.shape, line),
    message: {
      headline: `同じ並びの${lineNames[line.axis]}がある`,
      detail: ruleStatements.duplicate,
    },
  }));
  return [...runs, ...overfilled, ...duplicates];
}

/** 直前に置いたマスが当たっている違反を先に言う。古い違反が残っていても、今の手の結果を返すため。 */
function describeTakuzuTutorialViolation(
  _stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
): TutorialMessage {
  const descriptions = listViolationDescriptions(
    state.grid,
    findVisibleViolations(state.grid, state.ruleIds),
  );
  const lastCellIndex = state.lastMove?.cellIndex;
  const description =
    descriptions.find(({ cellIndices }) =>
      cellIndices.some((cellIndex) => cellIndex === lastCellIndex),
    ) ?? descriptions[0];
  return (
    description?.message ?? {
      headline: "ルールに合わないところがある",
      detail: "タップで直せる",
    }
  );
}

/**
 * 案内や、手が止まったときに示す、今の盤面と知っているルールだけで決まるマス。無ければ `null`。
 * `preferredRuleId` を渡すと、そのルールで決まるマスを先に探す。無ければ、ほかの知っているルールで決まるマスを返す。
 */
export function findTakuzuTutorialHintCellIndex(
  state: TakuzuTutorialStageState,
  preferredRuleId: TakuzuTutorialRuleId | null = null,
): number | null {
  const preferredCellIndex =
    preferredRuleId !== null && state.ruleIds.includes(preferredRuleId)
      ? findDeducibleCellIndex(state.grid, [preferredRuleId])
      : null;
  return (
    preferredCellIndex ?? findDeducibleCellIndex(state.grid, state.ruleIds)
  );
}

/** 1行だけの盤面で、手が止まってから決まるマスを示すまでの間。考える余地を残すため長めに待つ。 */
const smallBoardIdleHintDelayMs = 7000;

/** 4×4 の盤面で、手が止まってから決まるマスを示すまでの間。探す範囲が広く迷いやすいので、早めに示す。 */
const boardIdleHintDelayMs = 4000;

/**
 * 何をするパズルかと操作から始め、ルールは使わせる前に示し、示したルールですぐ解ける盤面を順に並べる。
 * 答えは示さず、置いたタイルの結果から「ここはこれしかない」に気づかせる。盤面は 1×2 → 1×3 → 1×4 → 4×4 と育つ。
 * - 0 `..`: ルールを持たず、全部埋めるパズルであることと、タップで切り替わることを、左を四角・右を丸にして確かめる。
 * - 1 `AA.`: 3つ続かないことを示してから問う。
 * - 2 `B.B`: 同じルールで、挟まれていても決まる。
 * - 3 `ABA.`: 同じ数を示してから問う。
 * - 4: 3つ続かないことと同じ数だけで解き切れる。1行から盤面への飛躍を埋めるため、最初の2手だけ、
 *   3つ続かない・同じ数の順にそれぞれで決まるマスを示して手を引き、その後は手が止まったときだけ示す。
 *   手を引いている間は示したマスにしか置けず、どちらのマスも違う方を置くと知っているルールに合わなくなるので、自分で気づいて直せる。
 * - 5: 途中で2つのルールでは決まらなくなる。そこで同じ並びを作れないことを示し、それで解き切る。
 */
const stages: readonly TakuzuTutorialStage[] = [
  {
    givens: parseTakuzuGrid([".."]),
    goal: parseTakuzuGrid(["AB"]),
    ruleIds: [],
    intro: { headline: "マスを四角か丸で全部埋めるパズル", detail: null },
    solved: {
      headline: "全部埋まった！",
      detail: "次からは、ルールに合うように埋める",
    },
    introducedRuleId: null,
    revealedRule: null,
    guides: [
      {
        ruleId: null,
        message: {
          headline: "マスを四角か丸で全部埋めるパズル",
          detail: "まず、左のマスをタップ",
        },
      },
      {
        ruleId: null,
        message: {
          headline: "タップするたび 四角 → 丸 → 空き",
          detail: "右のマスを丸にしよう",
        },
      },
    ],
    idleHintDelayMs: smallBoardIdleHintDelayMs,
  },
  {
    givens: parseTakuzuGrid(["AA."]),
    goal: null,
    ruleIds: ["run"],
    intro: {
      headline: "同じものは3つ続けて置けない",
      detail: "では、空いているマスに入るのは？",
    },
    solved: {
      headline: "そう。ここは丸",
      detail: "四角が2つ並んだら、隣は丸",
    },
    introducedRuleId: "run",
    revealedRule: null,
    guides: [],
    idleHintDelayMs: smallBoardIdleHintDelayMs,
  },
  {
    givens: parseTakuzuGrid(["B.B"]),
    goal: null,
    ruleIds: ["run"],
    intro: {
      headline: "ここに入るのは？",
      detail: "これも「3つ続かない」で決まる",
    },
    solved: {
      headline: "挟まれていても決まる",
      detail: "丸と丸の間は、四角",
    },
    introducedRuleId: null,
    revealedRule: null,
    guides: [],
    idleHintDelayMs: smallBoardIdleHintDelayMs,
  },
  {
    givens: parseTakuzuGrid(["ABA."]),
    goal: null,
    ruleIds: ["run", "count"],
    intro: {
      headline: "行も列も、四角と丸は同じ数",
      detail: "では、空いているマスに入るのは？",
    },
    solved: {
      headline: "そう。四角2つ、丸2つ",
      detail: "同じ数ずつになった",
    },
    introducedRuleId: "count",
    revealedRule: null,
    guides: [],
    idleHintDelayMs: smallBoardIdleHintDelayMs,
  },
  {
    givens: parseTakuzuGrid([".A.B", "..A.", "B...", ".B.B"]),
    goal: null,
    ruleIds: ["run", "count"],
    intro: {
      headline: "その調子。残りも埋めよう",
      detail: "迷ったら、少し待つと印が出る",
    },
    solved: { headline: "解けた！", detail: "2つのルールだけで埋まった" },
    introducedRuleId: null,
    revealedRule: null,
    guides: [
      {
        ruleId: "run",
        message: {
          headline: "4×4 も同じ2つのルールで解ける",
          detail: "印のマスは、丸と丸に挟まれている",
        },
      },
      {
        ruleId: "count",
        message: {
          headline: "次の印のマスは、縦の列を見よう",
          detail: "四角がもう2つある",
        },
      },
    ],
    idleHintDelayMs: boardIdleHintDelayMs,
  },
  {
    givens: parseTakuzuGrid(["..A.", "A.BB", "B...", "...B"]),
    goal: null,
    ruleIds: ["run", "count"],
    intro: {
      headline: "最後の盤面",
      detail: "まずは2つのルールで決まるマスから",
    },
    solved: { headline: "解けた！", detail: "3つのルールで全部埋まった" },
    introducedRuleId: null,
    revealedRule: {
      id: "duplicate",
      message: {
        headline: "同じ並びの行・列は作れない",
        detail: "3つ目のルール。これも使って解こう",
      },
    },
    guides: [],
    idleHintDelayMs: boardIdleHintDelayMs,
  },
];

export const takuzuTutorial: Tutorial<
  TakuzuTutorialRuleId,
  TakuzuTutorialStage,
  TakuzuTutorialStageState,
  TakuzuTutorialAction
> = {
  rules: [
    { id: "run", label: "3つ続かない" },
    { id: "count", label: "同じ数" },
    { id: "duplicate", label: "同じ並びなし" },
  ],
  stages,
  completion: {
    headline: "ルールはこれで全部",
    detail: "本番は 8×8。同じ3つのルールで解ける",
  },
  startStage: startTakuzuTutorialStage,
  describeViolation: describeTakuzuTutorialViolation,
  startGuide: startTakuzuTutorialGuide,
  perform: performTakuzuTutorialAction,
};

export const _private = { deduceCell };
