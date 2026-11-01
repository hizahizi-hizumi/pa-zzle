import {
  getMinesweeperCellCount,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
  isMinesweeperMine,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "@/games/minesweeper/puzzle/transitions";
import {
  getMinesweeperVisibleCells,
  type MinesweeperVisibleCell,
} from "@/games/minesweeper/session/session";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `number`: 数字は、周りの8マスにある地雷の数。
 * - `total`: 盤面全体の地雷の数は、上の「地雷」に出る。
 */
export type MinesweeperTutorialRuleId = "number" | "total";

/** 盤面と同じく、開く・旗を置く外す・開いた数字の周りをまとめて開く。 */
export type MinesweeperTutorialAction = {
  type: "reveal" | "flag" | "chord";
  cellIndex: number;
};

/** 手順で印のマスにさせる操作。 */
export type MinesweeperTutorialOperation = "reveal" | "flag";

/**
 * - `cellIndices`: 印を付け、手順の間だけ `operation` を受け付けるマス。すべて開くか旗を置いたら次の手順へ進む。
 * - `operation`: 印のマスにさせる操作。地雷のマスには旗を置かせ、地雷でないマスは開かせる。
 */
export type MinesweeperTutorialStep =
  TutorialStep<MinesweeperTutorialRuleId> & {
    cellIndices: readonly number[];
    operation: MinesweeperTutorialOperation;
  };

/**
 * 直前の手。盤面の上の合図に使う。
 * - `cellIndex`: 操作したマス。
 * - `steppedMine`: 地雷を踏んだ。
 * - `reasonCellIndices`: 開いたマスか旗を置いたマスが手前の盤面だけで決まっていたときの、決め手の数字のマス。決まっていなければ空。
 * - `fitsStep`: 手を引いている手順の印のマスに、手順どおりの操作をした。手を離した後は常に `false`。
 */
export type MinesweeperTutorialMove = {
  cellIndex: number;
  steppedMine: boolean;
  reasonCellIndices: readonly number[];
  fitsStep: boolean;
};

/** `moveCount`: 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。 */
export type MinesweeperTutorialBoardState = {
  puzzle: MinesweeperPuzzleState;
  moveCount: number;
  lastMove: MinesweeperTutorialMove | null;
};

type MinesweeperTutorialSituation = TutorialSituation<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep
>;

/**
 * 開いていないマスが、開いた数字と踏んだ地雷と地雷の総数だけで、地雷か地雷でないかに決まること。
 * - `reasonCellIndices`: 決め手の数字のマス。地雷の総数だけで決まったときは空。
 * - `round`: 何巡目の読みで決まったか。前に決まったマスを使って決まるほど大きい。
 */
type MinesweeperDeduction = {
  mine: boolean;
  reasonCellIndices: readonly number[];
  round: number;
};

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * 5 + (column - 1);
}

/**
 * 地雷は3つ。左上から開き始め、本番と同じく開いたマスの周りに地雷の無いマスが続けて開いた盤面から始める。
 * 開いていないマスのうち地雷でないマスは、どれも周りに地雷があり、開いても続けて開かない。
 *
 * ```text
 * 最初    解（*: 地雷）
 * .....   .....
 * .111.   .111.
 * .1#21   .1*21
 * 12###   123*1
 * #####   1*211
 * ```
 */
const board: MinesweeperBoard = {
  rows: 5,
  columns: 5,
  mineCellIndices: [cellAt(3, 3), cellAt(4, 4), cellAt(5, 2)],
};

const initialRevealedCellIndices = collectMinesweeperRevealCellIndices(board, [
  cellAt(1, 1),
]);

const cellIndices = Array.from(
  { length: getMinesweeperCellCount(board) },
  (_, cellIndex) => cellIndex,
);

const safeCellIndices = cellIndices.filter(
  (cellIndex) => !isMinesweeperMine(board, cellIndex),
);

/**
 * 1の3つに囲まれたマスが地雷だと数字の決まりで見つけて旗を置き、その旗で数がそろった1の隣を開く。
 * 開いた3の周りにあと2つ地雷があり、地雷の総数3つと合わせると、3から離れた3マスには地雷が無いと決まる。
 * 3マスは数字の決まりだけでは決まらない。手順を終えると下の2マスが残り、開いた3マスの数字で1つずつ決まる。
 */
const steps: readonly MinesweeperTutorialStep[] = [
  {
    message: {
      headline: "数字は、周りの8マスにある\n地雷の数です",
      detail: "旗に切り替えて、印のマスに旗を置いてください",
    },
    introducedRuleId: "number",
    cellIndices: [cellAt(3, 3)],
    operation: "flag",
  },
  {
    message: {
      headline: "旗で地雷の数がそろった1の周りは\nほかのマスを開けます",
      detail: "切り替えを戻して、印のマスを押してください",
    },
    introducedRuleId: null,
    cellIndices: [cellAt(4, 3)],
    operation: "reveal",
  },
  {
    message: {
      headline: "地雷は全部で3つ。\n残りの2つはこの3の周りです",
      detail: "3から離れたマスは開けます",
    },
    introducedRuleId: "total",
    cellIndices: [cellAt(4, 5), cellAt(5, 1), cellAt(5, 5)],
    operation: "reveal",
  },
];

/** 数字の決まりで、まだ決まっていないマスが決まるもの。決め手は、そう決めた数字のマス。 */
function deduceByNumber(
  revealed: ReadonlySet<number>,
  known: ReadonlyMap<number, MinesweeperDeduction>,
  round: number,
): Map<number, MinesweeperDeduction> {
  const found = new Map<number, MinesweeperDeduction>();
  for (const numberCellIndex of revealed) {
    const mineCount = getAdjacentMinesweeperMineCount(board, numberCellIndex);
    if (mineCount === 0) {
      continue;
    }
    const closed = getMinesweeperNeighborCellIndices(
      board,
      numberCellIndex,
    ).filter((cellIndex) => !revealed.has(cellIndex));
    const knownMineCount = closed.filter(
      (cellIndex) => known.get(cellIndex)?.mine === true,
    ).length;
    const unknown = closed.filter((cellIndex) => !known.has(cellIndex));
    const mine =
      knownMineCount === mineCount
        ? false
        : knownMineCount + unknown.length === mineCount
          ? true
          : null;
    if (mine === null) {
      continue;
    }
    for (const cellIndex of unknown) {
      const reasonCellIndices = found.get(cellIndex)?.reasonCellIndices ?? [];
      found.set(cellIndex, {
        mine,
        reasonCellIndices: [...reasonCellIndices, numberCellIndex],
        round,
      });
    }
  }
  return found;
}

/**
 * 地雷の総数の決まりで決まるもの。数字の決まりで決まるマスが無くなってから使う。
 * 残りの地雷の数が、まだ決まっていないマスの数と同じならすべて地雷、0 ならすべて地雷でない。
 * 1つの数字の周りに残りの地雷がすべてあると分かれば、その数字から離れたマスは地雷でない。決め手はその数字のマス。
 */
function deduceByTotal(
  revealed: ReadonlySet<number>,
  known: ReadonlyMap<number, MinesweeperDeduction>,
  round: number,
): Map<number, MinesweeperDeduction> {
  const unknown = cellIndices.filter(
    (cellIndex) => !revealed.has(cellIndex) && !known.has(cellIndex),
  );
  const knownMineCount = [...known.values()].filter(
    (deduction) => deduction.mine,
  ).length;
  const remainingMineCount = board.mineCellIndices.length - knownMineCount;
  const found = new Map<number, MinesweeperDeduction>();
  if (remainingMineCount === 0 || remainingMineCount === unknown.length) {
    for (const cellIndex of unknown) {
      found.set(cellIndex, {
        mine: remainingMineCount > 0,
        reasonCellIndices: [],
        round,
      });
    }
    return found;
  }

  for (const numberCellIndex of revealed) {
    const closed = getMinesweeperNeighborCellIndices(
      board,
      numberCellIndex,
    ).filter((cellIndex) => !revealed.has(cellIndex));
    const neededMineCount =
      getAdjacentMinesweeperMineCount(board, numberCellIndex) -
      closed.filter((cellIndex) => known.get(cellIndex)?.mine === true).length;
    const around = closed.filter((cellIndex) => !known.has(cellIndex));
    if (around.length === 0 || neededMineCount !== remainingMineCount) {
      continue;
    }
    for (const cellIndex of unknown) {
      if (!around.includes(cellIndex) && !found.has(cellIndex)) {
        found.set(cellIndex, {
          mine: false,
          reasonCellIndices: [numberCellIndex],
          round,
        });
      }
    }
  }
  return found;
}

/**
 * 今の盤面で、開いた数字と踏んだ地雷から、手に入れたルールだけで決まるマス。決まったマスを使ってさらに決まるマスも含む。
 * 旗は自分用の印で正しいとは限らないので、決め手にしない。
 */
function deduceCells(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): Map<number, MinesweeperDeduction> {
  const revealed = new Set(puzzle.revealedCellIndices);
  const known = new Map<number, MinesweeperDeduction>(
    puzzle.steppedMineCellIndices.map((cellIndex) => [
      cellIndex,
      { mine: true, reasonCellIndices: [], round: 0 },
    ]),
  );
  const deductions = new Map<number, MinesweeperDeduction>();
  for (let round = 1; ; round += 1) {
    let found = ruleIds.includes("number")
      ? deduceByNumber(revealed, known, round)
      : new Map<number, MinesweeperDeduction>();
    if (found.size === 0 && ruleIds.includes("total")) {
      found = deduceByTotal(revealed, known, round);
    }
    if (found.size === 0) {
      return deductions;
    }
    for (const [cellIndex, deduction] of found) {
      known.set(cellIndex, deduction);
      deductions.set(cellIndex, deduction);
    }
  }
}

function isStepCellDone(
  step: MinesweeperTutorialStep,
  puzzle: MinesweeperPuzzleState,
  cellIndex: number,
): boolean {
  return step.operation === "flag"
    ? puzzle.flaggedCellIndices.includes(cellIndex)
    : puzzle.revealedCellIndices.includes(cellIndex);
}

function isStepDone(
  step: MinesweeperTutorialStep,
  puzzle: MinesweeperPuzzleState,
): boolean {
  return step.cellIndices.every((cellIndex) =>
    isStepCellDone(step, puzzle, cellIndex),
  );
}

function applyAction(
  puzzle: MinesweeperPuzzleState,
  { type, cellIndex }: MinesweeperTutorialAction,
): MinesweeperPuzzleState {
  switch (type) {
    case "reveal":
      return revealMinesweeperCell(board, puzzle, cellIndex);
    case "flag":
      return toggleMinesweeperFlag(board, puzzle, cellIndex);
    case "chord":
      return chordMinesweeperCell(board, puzzle, cellIndex);
  }
}

/** 開いたマスか置いた旗が、手前の盤面だけで決まっていたときの決め手。まとめて開いた手と旗を外した手には返さない。 */
function getMoveReason(
  before: MinesweeperPuzzleState,
  after: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
  { type, cellIndex }: MinesweeperTutorialAction,
): readonly number[] {
  const placedFlag =
    type === "flag" && after.flaggedCellIndices.includes(cellIndex);
  if (type !== "reveal" && !placedFlag) {
    return [];
  }
  const deduction = deduceCells(before, ruleIds).get(cellIndex);
  return deduction && deduction.mine === placedFlag
    ? deduction.reasonCellIndices
    : [];
}

function startMinesweeperTutorial(): MinesweeperTutorialBoardState {
  return {
    puzzle: {
      revealedCellIndices: initialRevealedCellIndices,
      flaggedCellIndices: [],
      steppedMineCellIndices: [],
    },
    moveCount: 0,
    lastMove: null,
  };
}

function getMinesweeperTutorialGoal(): MinesweeperTutorialBoardState {
  return {
    puzzle: {
      revealedCellIndices: safeCellIndices,
      flaggedCellIndices: [],
      steppedMineCellIndices: [],
    },
    moveCount: 0,
    lastMove: null,
  };
}

/**
 * 手を引いている間は、印のマスへの手順どおりの操作だけを受け付ける。地雷の印を開く手と、開く印に旗を置く手は受け付けない。
 * 手を離した後は本番と同じく、地雷を踏んでも続けられる。
 */
function performMinesweeperTutorialAction(
  { step, earnedRuleIds }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  action: MinesweeperTutorialAction,
): {
  state: MinesweeperTutorialBoardState;
  outcome: TutorialMoveOutcome;
} {
  const outsideStep =
    step !== null &&
    (action.type !== step.operation ||
      !step.cellIndices.includes(action.cellIndex) ||
      isStepCellDone(step, state.puzzle, action.cellIndex));
  const puzzle = outsideStep ? state.puzzle : applyAction(state.puzzle, action);
  if (puzzle === state.puzzle) {
    return { state, outcome: "ignored" };
  }

  const steppedMine =
    puzzle.steppedMineCellIndices.length >
    state.puzzle.steppedMineCellIndices.length;
  const next: MinesweeperTutorialBoardState = {
    puzzle,
    moveCount: state.moveCount + 1,
    lastMove: {
      cellIndex: action.cellIndex,
      steppedMine,
      reasonCellIndices: steppedMine
        ? []
        : getMoveReason(state.puzzle, puzzle, earnedRuleIds, action),
      fitsStep: step !== null,
    },
  };

  if (isMinesweeperCleared(board, puzzle)) {
    return { state: next, outcome: "solved" };
  }
  if (steppedMine) {
    return { state: next, outcome: "violated" };
  }
  if (step !== null && isStepDone(step, puzzle)) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "continued" };
}

/** 地雷を踏んだ手への一言。本番と同じく、踏んでも続けられることを言う。 */
function describeMinesweeperTutorialViolation(): TutorialMessage {
  return {
    headline: "地雷を踏みました",
    detail: "踏んでも、そのまま続けられます",
  };
}

export const MINESWEEPER_TUTORIAL_ROWS = board.rows;
export const MINESWEEPER_TUTORIAL_COLUMNS = board.columns;
export const MINESWEEPER_TUTORIAL_MINE_COUNT = board.mineCellIndices.length;

/** 盤面の見え方。解き終えた盤面では、本番と同じく地雷の配置を明かす。 */
export function getMinesweeperTutorialVisibleCells(
  state: MinesweeperTutorialBoardState,
): MinesweeperVisibleCell[] {
  return getMinesweeperVisibleCells(
    board,
    state.puzzle,
    isMinesweeperCleared(board, state.puzzle),
  );
}

/** 手順で印を付けるマスのうち、まだ手順どおりになっていないもの。手を離した後は空。 */
export function getMinesweeperTutorialStepCellIndices(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
): readonly number[] {
  return step === null
    ? []
    : step.cellIndices.filter(
        (cellIndex) => !isStepCellDone(step, state.puzzle, cellIndex),
      );
}

/**
 * 手を離した後、手が止まったときに示す、今の盤面と手に入れたルールだけで地雷でないと決まる、開いていないマス。
 * 前に決まったマスを使わずに決まるマスほど先に返し、旗を置いたマスは後にする。無ければ `null`。
 */
export function findMinesweeperTutorialHintCellIndex(
  { earnedRuleIds }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
): number | null {
  const candidates = [...deduceCells(state.puzzle, earnedRuleIds)]
    .filter(([, deduction]) => !deduction.mine)
    .map(([cellIndex, { round }]) => ({
      cellIndex,
      order:
        round * 2 +
        (state.puzzle.flaggedCellIndices.includes(cellIndex) ? 1 : 0),
    }))
    .sort(
      (left, right) =>
        left.order - right.order || left.cellIndex - right.cellIndex,
    );
  return candidates[0]?.cellIndex ?? null;
}

export const minesweeperTutorial: Tutorial<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep,
  MinesweeperTutorialBoardState,
  MinesweeperTutorialAction
> = {
  intro: {
    purpose: "数字を手がかりに、\n地雷ではないマスをすべて開くパズルです",
    goalCaption: "この盤面がゴールです",
    startCaption: "最初は一部のマスだけ開いています",
  },
  rules: [
    { id: "number", label: "数字は周りの地雷の数" },
    { id: "total", label: "地雷の総数は上に出る" },
  ],
  steps,
  freePlay: {
    headline: "地雷ではないマスを\nすべて開くと完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は 9×9 ほどの盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールで解けます",
    },
  },
  start: startMinesweeperTutorial,
  goal: getMinesweeperTutorialGoal,
  perform: performMinesweeperTutorialAction,
  describeViolation: describeMinesweeperTutorialViolation,
};

export const _private = {
  board,
  initialRevealedCellIndices,
  safeCellIndices,
  cellAt,
  deduceCells,
};
