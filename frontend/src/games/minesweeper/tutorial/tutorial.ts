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

export type MinesweeperTutorialRuleId = "number" | "clear";

export type MinesweeperTutorialAction = {
  type: "reveal" | "flag" | "chord";
  cellIndex: number;
};

export type MinesweeperTutorialOperation = "reveal" | "flag";

export type MinesweeperTutorialStep =
  TutorialStep<MinesweeperTutorialRuleId> & {
    cellIndices: readonly number[];
    operation: MinesweeperTutorialOperation;
    // 印のマスを決めるマス（決め手）。決めた数字と、その読みに使った、もう地雷と分かったマス。操作を教える手順では空。
    reasonCellIndices: readonly number[];
  };

export type MinesweeperTutorialMove = {
  cellIndex: number;
  steppedMine: boolean;
  // この手で手順どおりになった、手順の印のマス。開いた数字を押してまとめて開いたときは、押した数字ではなく開いた印のマス。
  fittedCellIndices: readonly number[];
};

export type MinesweeperTutorialBoardState = {
  puzzle: MinesweeperPuzzleState;
  // 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。
  moveCount: number;
  lastMove: MinesweeperTutorialMove | null;
};

type MinesweeperTutorialSituation = TutorialSituation<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep
>;

/** 開いていないマスが、開いた数字と分かった地雷から、数字1つを見るだけで地雷か地雷でないかに決まること。 */
export type MinesweeperTutorialDeduction = {
  mine: boolean;
  ruleId: MinesweeperTutorialRuleId;
  numberCellIndex: number;
  reasonMineCellIndices: readonly number[];
  // 何巡目の読みで決まったか。前に決まった地雷を使って決まるほど大きい。
  round: number;
};

function cellAt(oneBasedRow: number, oneBasedColumn: number): number {
  return (oneBasedRow - 1) * 5 + (oneBasedColumn - 1);
}

/**
 * ```text
 * 最初    解（*: 地雷）
 * #1.1#   *1.11
 * 11.1#   11.1*
 * ...2#   ...22
 * 1111#   1111*
 * #####   1*111
 * ```
 */
const board: MinesweeperBoard = {
  rows: 5,
  columns: 5,
  mineCellIndices: [cellAt(1, 1), cellAt(2, 5), cellAt(4, 5), cellAt(5, 2)],
};

const initialRevealedCellIndices = collectMinesweeperRevealCellIndices(board, [
  cellAt(1, 3),
]);

const cellIndices = Array.from(
  { length: getMinesweeperCellCount(board) },
  (_, cellIndex) => cellIndex,
);

const safeCellIndices = cellIndices.filter(
  (cellIndex) => !isMinesweeperMine(board, cellIndex),
);

/**
 * 開いたマスから数字が出ることを見せ、その2の周りに2つだけ残った閉じたマスに旗を置かせ、
 * 旗で地雷がそろった1の周りの残りを開かせる。
 * 手順を終えると、左上と下の地雷と、それぞれの地雷で決まる2マスが残る。
 */
const steps: readonly MinesweeperTutorialStep[] = [
  {
    message: { headline: "このマスを押して開きます", detail: null },
    introducedRuleId: null,
    cellIndices: [cellAt(3, 5)],
    operation: "reveal",
    reasonCellIndices: [],
  },
  {
    message: {
      headline: "周り8マスにある\n地雷の数が書かれています",
      detail: "右上のボタンで旗に切り替えて地雷のマスに旗を置きます",
    },
    introducedRuleId: "number",
    cellIndices: [cellAt(2, 5), cellAt(4, 5)],
    operation: "flag",
    reasonCellIndices: [cellAt(3, 5)],
  },
  {
    message: {
      headline: "この1の地雷は\nもう見つかりました",
      detail: "周りの残りのマスを開きます",
    },
    introducedRuleId: "clear",
    cellIndices: [cellAt(5, 3), cellAt(5, 4), cellAt(5, 5)],
    operation: "reveal",
    reasonCellIndices: [cellAt(4, 4), cellAt(4, 5)],
  },
];

export const minesweeperTutorialModeSwitchDetails = {
  flag: "右上のボタンで旗に切り替えて地雷のマスに旗を置きます",
  reveal: "右上のボタンで旗の切り替えを戻して開きます",
} as const satisfies Record<MinesweeperTutorialOperation, string>;

/**
 * `ruleIds` の読みで、数字1つを見るだけで決まるマス。決まったマスを使ってさらに決まるマスも含む。
 * 分かった地雷は踏んだ地雷と、前に地雷と決まったマス。旗は自分用の印で正しいとは限らないので、決め手にしない。
 */
function deduceCells(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): Map<number, MinesweeperTutorialDeduction> {
  const revealed = new Set(puzzle.revealedCellIndices);
  const knownMines = new Set(puzzle.steppedMineCellIndices);
  const deductions = new Map<number, MinesweeperTutorialDeduction>();
  for (let round = 1; ; round += 1) {
    const found = new Map<number, MinesweeperTutorialDeduction>();
    for (const numberCellIndex of revealed) {
      const mineCount = getAdjacentMinesweeperMineCount(board, numberCellIndex);
      const closed = getMinesweeperNeighborCellIndices(
        board,
        numberCellIndex,
      ).filter((cellIndex) => !revealed.has(cellIndex));
      const mines = closed.filter((cellIndex) => knownMines.has(cellIndex));
      const unknown = closed.filter(
        (cellIndex) => !knownMines.has(cellIndex) && !deductions.has(cellIndex),
      );
      const deduction: Omit<MinesweeperTutorialDeduction, "round"> | null =
        ruleIds.includes("clear") && mines.length === mineCount
          ? {
              mine: false,
              ruleId: "clear",
              numberCellIndex,
              reasonMineCellIndices: mines,
            }
          : ruleIds.includes("number") && closed.length === mineCount
            ? {
                mine: true,
                ruleId: "number",
                numberCellIndex,
                reasonMineCellIndices: [],
              }
            : null;
      if (deduction === null) {
        continue;
      }
      for (const cellIndex of unknown) {
        if (!found.has(cellIndex)) {
          found.set(cellIndex, { ...deduction, round });
        }
      }
    }
    if (found.size === 0) {
      return deductions;
    }
    for (const [cellIndex, deduction] of found) {
      deductions.set(cellIndex, deduction);
      if (deduction.mine) {
        knownMines.add(cellIndex);
      } else {
        revealed.add(cellIndex);
      }
    }
  }
}

function isStepCellDone(
  step: MinesweeperTutorialStep,
  puzzle: MinesweeperPuzzleState,
  cellIndex: number,
): boolean {
  return step.operation === "flag"
    ? puzzle.flaggedCellIndices.includes(cellIndex) ||
        puzzle.steppedMineCellIndices.includes(cellIndex)
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

function fitsStep(
  step: MinesweeperTutorialStep,
  before: MinesweeperPuzzleState,
  after: MinesweeperPuzzleState,
  action: MinesweeperTutorialAction,
): boolean {
  if (action.type === "chord") {
    const opened = after.revealedCellIndices.filter(
      (cellIndex) => !before.revealedCellIndices.includes(cellIndex),
    );
    return (
      step.operation === "reveal" &&
      after.steppedMineCellIndices.length ===
        before.steppedMineCellIndices.length &&
      opened.every((cellIndex) => step.cellIndices.includes(cellIndex))
    );
  }
  const target =
    step.cellIndices.includes(action.cellIndex) &&
    !isStepCellDone(step, before, action.cellIndex);
  // 地雷を踏む反応は1回だけ見せ、残りの地雷には旗を置かせる。踏んで通り抜けると、旗を使わずに手順を終えてしまう。
  const firstStepOnMine =
    step.operation === "flag" &&
    action.type === "reveal" &&
    !step.cellIndices.some((cellIndex) =>
      before.steppedMineCellIndices.includes(cellIndex),
    );
  return target && (action.type === step.operation || firstStepOnMine);
}

/** 手を引いている間は、印のマスへの手だけを受け付ける。 */
function performMinesweeperTutorialAction(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  action: MinesweeperTutorialAction,
): {
  state: MinesweeperTutorialBoardState;
  outcome: TutorialMoveOutcome;
} {
  const applied = applyAction(state.puzzle, action);
  const puzzle =
    step !== null && !fitsStep(step, state.puzzle, applied, action)
      ? state.puzzle
      : applied;
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
      fittedCellIndices:
        step === null || steppedMine
          ? []
          : step.cellIndices.filter(
              (cellIndex) =>
                !isStepCellDone(step, state.puzzle, cellIndex) &&
                isStepCellDone(step, puzzle, cellIndex),
            ),
    },
  };

  if (isMinesweeperCleared(board, puzzle)) {
    return { state: next, outcome: "solved" };
  }
  if (step !== null && isStepDone(step, puzzle)) {
    return { state: next, outcome: "stepped" };
  }
  if (steppedMine) {
    return { state: next, outcome: "violated" };
  }
  return { state: next, outcome: "continued" };
}

function describeMinesweeperTutorialViolation({
  step,
}: MinesweeperTutorialSituation): TutorialMessage {
  return {
    headline: "地雷を踏みました\n本番ではミスになります",
    detail: step?.operation === "flag" ? "残りの地雷には旗を置きます" : null,
  };
}

export const MINESWEEPER_TUTORIAL_PROGRESS_STEP_COUNT = steps.length + 1;

export const MINESWEEPER_TUTORIAL_ROWS = board.rows;
export const MINESWEEPER_TUTORIAL_COLUMNS = board.columns;
export const MINESWEEPER_TUTORIAL_MINE_COUNT = board.mineCellIndices.length;

export function getMinesweeperTutorialVisibleCells(
  state: MinesweeperTutorialBoardState,
): MinesweeperVisibleCell[] {
  return getMinesweeperVisibleCells(
    board,
    state.puzzle,
    isMinesweeperCleared(board, state.puzzle),
  );
}

export function getMinesweeperTutorialStepSpotlitCellIndices(
  step: MinesweeperTutorialStep,
  state: MinesweeperTutorialBoardState,
): number[] {
  const [numberCellIndex] = step.reasonCellIndices;
  if (numberCellIndex === undefined) {
    return [];
  }
  const closedAround = getMinesweeperNeighborCellIndices(
    board,
    numberCellIndex,
  ).filter(
    (cellIndex) => !state.puzzle.revealedCellIndices.includes(cellIndex),
  );
  return [
    ...new Set([
      ...step.reasonCellIndices,
      ...closedAround,
      ...step.cellIndices,
    ]),
  ].sort((left, right) => left - right);
}

export const MINESWEEPER_TUTORIAL_RECAP = [
  "周り8マスにある地雷の数が書かれています",
  "周りの閉じたマスが数字と同じ数なら全部地雷です",
  "地雷が全部見つかった数字の周りの残りのマスを開きます",
] as const;

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

export type MinesweeperTutorialHint = {
  cellIndex: number;
  deduction: MinesweeperTutorialDeduction;
  // 地雷でないマスでも、旗があれば先に旗を外させるので `flag` にする。
  operation: MinesweeperTutorialOperation;
  reasonCellIndices: readonly number[];
};

export function findMinesweeperTutorialHint(
  { earnedRuleIds }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
): MinesweeperTutorialHint | null {
  const { puzzle } = state;
  const candidates = [...deduceCells(puzzle, earnedRuleIds)]
    .filter(([cellIndex, deduction]) =>
      deduction.mine
        ? !puzzle.flaggedCellIndices.includes(cellIndex)
        : !puzzle.revealedCellIndices.includes(cellIndex),
    )
    .sort(
      ([leftCellIndex, left], [rightCellIndex, right]) =>
        left.round - right.round || leftCellIndex - rightCellIndex,
    );
  const [found] = candidates;
  if (!found) {
    return null;
  }
  const [cellIndex, deduction] = found;
  const flagged = puzzle.flaggedCellIndices.includes(cellIndex);
  return {
    cellIndex,
    deduction,
    operation: deduction.mine || flagged ? "flag" : "reveal",
    reasonCellIndices: [
      deduction.numberCellIndex,
      ...deduction.reasonMineCellIndices,
    ],
  };
}

export function describeMinesweeperTutorialHint(
  state: MinesweeperTutorialBoardState,
  { cellIndex, deduction }: MinesweeperTutorialHint,
): TutorialMessage {
  const mineCount = getAdjacentMinesweeperMineCount(
    board,
    deduction.numberCellIndex,
  );
  if (deduction.mine) {
    return {
      headline: `この${mineCount}の周りの閉じたマスは\n全部地雷です`,
      detail: "地雷には旗を置きます",
    };
  }
  return {
    headline: `この${mineCount}の地雷は\nもう見つかりました`,
    detail: state.puzzle.flaggedCellIndices.includes(cellIndex)
      ? "旗を外して開きます"
      : "周りの残りのマスを開きます",
  };
}

export function getMinesweeperTutorialProgressRatio(
  stepIndex: number,
  state: MinesweeperTutorialBoardState,
): number {
  if (stepIndex < steps.length) {
    return stepIndex / MINESWEEPER_TUTORIAL_PROGRESS_STEP_COUNT;
  }
  return isMinesweeperCleared(board, state.puzzle)
    ? 1
    : steps.length / MINESWEEPER_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const minesweeperTutorial: Tutorial<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep,
  MinesweeperTutorialBoardState,
  MinesweeperTutorialAction
> = {
  intro: {
    purpose: "数字を手がかりに地雷のない\nマスを全部開くパズルです",
    goalCaption: "マスを押して開いていきます",
  },
  rules: [
    { id: "number", label: "周り8マスにある地雷の数が書かれています" },
    {
      id: "clear",
      label: "地雷が全部見つかった数字の周りの残りのマスを開きます",
    },
  ],
  steps,
  freePlay: {
    headline: "残りのマスも開いてみましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番はもっと大きな盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
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
