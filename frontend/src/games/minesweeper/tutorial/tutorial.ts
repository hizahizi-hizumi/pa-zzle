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
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `number`: 数字は、周りの8マスにある地雷の数。
 * - `cascade`: 周りに地雷がないマスを開くと、周りも続けて開く。
 * - `chord`: 周りの旗の数が数字と同じとき、数字を押すと残りのマスをまとめて開く。
 * - `total`: 上に出る地雷の数は、盤面全体の地雷の数。
 */
export type MinesweeperTutorialRuleId =
  | "number"
  | "cascade"
  | "chord"
  | "total";

/** 盤面と同じく、マスを押したときに開くか、旗を置く・外すか。 */
export type MinesweeperTutorialInputMode = "reveal" | "flag";

/**
 * 盤面と同じ操作。マスを押す操作は、盤面が今の切り替えに合わせて開く・旗・まとめて開くのどれかにして渡す。
 * 長押しと右クリックは、切り替えによらず旗を置く・外す。
 */
export type MinesweeperTutorialAction =
  | { type: "reveal" | "flag" | "chord"; cellIndex: number }
  | { type: "change-mode"; mode: MinesweeperTutorialInputMode };

/**
 * 手順で印を付けて受け付ける1手。
 * - `operation`: `cellIndex` のマスを開く・旗を置く・まとめて開く。
 * - `focusCellIndices`: 印のマスを決める数字。手順の間、見るところとして目立たせる。
 * - `focusMineCount`: 盤面全体の地雷の数を、見るところとして目立たせる。
 */
export type MinesweeperTutorialStep =
  TutorialStep<MinesweeperTutorialRuleId> & {
    operation: "reveal" | "flag" | "chord";
    cellIndex: number;
    focusCellIndices: readonly number[];
    focusMineCount: boolean;
  };

/** `moveCount`: 盤面を変えた手の数。同じマスへの合図をやり直す目印に使う。 */
export type MinesweeperTutorialBoardState = {
  puzzle: MinesweeperPuzzleState;
  mode: MinesweeperTutorialInputMode;
  moveCount: number;
};

type MinesweeperTutorialSituation = TutorialSituation<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep
>;

/**
 * 手を引いている間に印を付けるところ。
 * - `mode`: 手順の操作に合わない切り替えになっている。切り替えのボタンに印を付ける。
 * - `cell`: 手順のマスに印を付ける。
 */
export type MinesweeperTutorialCue =
  | { target: "mode" }
  | { target: "cell"; cellIndex: number };

const ROWS = 6;
const COLUMNS = 6;

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * COLUMNS + (column - 1);
}

/**
 * 地雷が4つの盤面。上の2行を開いた状態から始め、数字と地雷の数だけで最後まで解ける。
 *
 * ```text
 * 最初      解
 * #1....   11....
 * #1111.   *1111.
 * ######   111*21
 * ######   ..12*1
 * ######   ..1221
 * ######   ..1*1.
 * ```
 */
const board: MinesweeperBoard = {
  rows: ROWS,
  columns: COLUMNS,
  mineCellIndices: [cellAt(2, 1), cellAt(3, 4), cellAt(4, 5), cellAt(6, 4)],
};

/** 本番の問題と同じく、周りに地雷が無い1マスから続けて開いた範囲を、最初から開いておく。 */
const initialRevealedCellIndices = collectMinesweeperRevealCellIndices(board, [
  cellAt(1, 5),
]);

/**
 * 左上の角を開かせ、その1が指す地雷に旗を置かせる。旗で数字が足りた2行2列の1から、3行1列を開かせる。
 * 3行1列の1も足りているので、4行1列を開くと左下が続けて開く。
 * 2行4列の1が指す地雷に旗を置き、その旗で足りた4行3列の1を押して、4行4列と5行4列をまとめて開かせる。
 * 6行3列の1が指す地雷に旗を置くと、旗は3つで残りの地雷は1つ。3行6列の1の周りの2マスのどちらかにあるので、
 * 数字だけでは決まらない6行5列が、地雷の数で開けると決まる。
 * 手を離した後は、6行5列の1で右下の3マスが開け、4行4列の2で4行5列が地雷、3行6列の1で4行6列が開けると決まる。
 */
const steps: readonly MinesweeperTutorialStep[] = [
  {
    message: {
      headline: "マスを押すと開きます",
      detail: "印のマスを押してください",
    },
    introducedRuleId: null,
    operation: "reveal",
    cellIndex: cellAt(1, 1),
    focusCellIndices: [],
    focusMineCount: false,
  },
  {
    message: {
      headline: "数字は\n周りの8マスにある地雷の数です",
      detail: "地雷のマスには旗を置きます",
    },
    introducedRuleId: "number",
    operation: "flag",
    cellIndex: cellAt(2, 1),
    focusCellIndices: [cellAt(1, 1)],
    focusMineCount: false,
  },
  {
    message: {
      headline: "旗の数が数字と同じなら\n残りのマスは開けます",
      detail: null,
    },
    introducedRuleId: null,
    operation: "reveal",
    cellIndex: cellAt(3, 1),
    focusCellIndices: [cellAt(2, 2)],
    focusMineCount: false,
  },
  {
    message: {
      headline: "周りに地雷がないマスを開くと\n周りも続けて開きます",
      detail: null,
    },
    introducedRuleId: "cascade",
    operation: "reveal",
    cellIndex: cellAt(4, 1),
    focusCellIndices: [cellAt(3, 1)],
    focusMineCount: false,
  },
  {
    message: {
      headline: "このマスも\nここまでのルールで決まります",
      detail: null,
    },
    introducedRuleId: null,
    operation: "flag",
    cellIndex: cellAt(3, 4),
    focusCellIndices: [cellAt(2, 4)],
    focusMineCount: false,
  },
  {
    message: {
      headline: "旗の数が数字と同じとき\n数字を押すと残りをまとめて開きます",
      detail: null,
    },
    introducedRuleId: "chord",
    operation: "chord",
    cellIndex: cellAt(4, 3),
    focusCellIndices: [],
    focusMineCount: false,
  },
  {
    message: {
      headline: "このマスも\nここまでのルールで決まります",
      detail: null,
    },
    introducedRuleId: null,
    operation: "flag",
    cellIndex: cellAt(6, 4),
    focusCellIndices: [cellAt(6, 3)],
    focusMineCount: false,
  },
  {
    message: {
      headline: "上の地雷の数は\n盤面全体の地雷の数です",
      detail: "残りの1つは この1の周りにあります",
    },
    introducedRuleId: "total",
    operation: "reveal",
    cellIndex: cellAt(6, 5),
    focusCellIndices: [cellAt(3, 6)],
    focusMineCount: true,
  },
];

/** 手順の操作に合わない切り替えのとき、補足の代わりに出す、切り替え方。 */
const modeChangeDetails = {
  reveal: "上のボタンで開くに戻します",
  flag: "上のボタンで旗に切り替えます",
} as const satisfies Record<MinesweeperTutorialInputMode, string>;

function getStepMode(
  step: MinesweeperTutorialStep,
): MinesweeperTutorialInputMode {
  return step.operation === "flag" ? "flag" : "reveal";
}

function listCellIndices(): number[] {
  return Array.from(
    { length: getMinesweeperCellCount(board) },
    (_, cellIndex) => cellIndex,
  );
}

function isClosed(puzzle: MinesweeperPuzzleState, cellIndex: number): boolean {
  return (
    !puzzle.revealedCellIndices.includes(cellIndex) &&
    !puzzle.steppedMineCellIndices.includes(cellIndex)
  );
}

/**
 * 今の盤面から、手に入れたルールを当てはめるだけで分かる地雷と、開けるマス。
 * 開いた数字と、正しく置いた旗・踏んだ地雷から始め、分かったことを足して分からなくなるまで繰り返す。
 * 分かっても開いていないマスの数字は見えないので、手がかりに使わない。
 * - `number`: 数字の周りの閉じたマスが、残りの地雷の数と同じなら全部地雷、残りが0なら全部開ける。
 * - `total`: 残りの地雷が0なら閉じたマスは全部開け、閉じたマスと同じ数なら全部地雷。
 *   1つの数字が周りに残りの地雷を全部求めているなら、その周りの外は開ける。
 */
function deduceCells(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): { mineCellIndices: Set<number>; safeCellIndices: Set<number> } {
  const mines = new Set(
    [...puzzle.flaggedCellIndices, ...puzzle.steppedMineCellIndices].filter(
      (cellIndex) => isMinesweeperMine(board, cellIndex),
    ),
  );
  const safe = new Set<number>();
  const openedNumbers = puzzle.revealedCellIndices.map((cellIndex) => ({
    neighbors: getMinesweeperNeighborCellIndices(board, cellIndex),
    count: getAdjacentMinesweeperMineCount(board, cellIndex),
  }));
  function isUnknown(cellIndex: number): boolean {
    return (
      isClosed(puzzle, cellIndex) &&
      !mines.has(cellIndex) &&
      !safe.has(cellIndex)
    );
  }
  function learn(cellIndices: readonly number[], mine: boolean): boolean {
    const unknown = cellIndices.filter(isUnknown);
    for (const cellIndex of unknown) {
      (mine ? mines : safe).add(cellIndex);
    }
    return unknown.length > 0;
  }

  let learned = true;
  while (learned) {
    learned = false;
    if (ruleIds.includes("number")) {
      for (const { neighbors, count } of openedNumbers) {
        const unknown = neighbors.filter(isUnknown);
        const remaining =
          count - neighbors.filter((cellIndex) => mines.has(cellIndex)).length;
        if (unknown.length > 0 && remaining === unknown.length) {
          learned = learn(unknown, true) || learned;
        } else if (unknown.length > 0 && remaining === 0) {
          learned = learn(unknown, false) || learned;
        }
      }
    }
    if (!learned && ruleIds.includes("total")) {
      const unknown = listCellIndices().filter(isUnknown);
      const remaining = board.mineCellIndices.length - mines.size;
      if (remaining === 0 || remaining === unknown.length) {
        learned = learn(unknown, remaining > 0);
      } else {
        for (const { neighbors, count } of openedNumbers) {
          const needed =
            count -
            neighbors.filter((cellIndex) => mines.has(cellIndex)).length;
          if (needed === remaining) {
            learned =
              learn(
                unknown.filter((cellIndex) => !neighbors.includes(cellIndex)),
                false,
              ) || learned;
          }
        }
      }
    }
  }
  return { mineCellIndices: mines, safeCellIndices: safe };
}

function startMinesweeperTutorial(): MinesweeperTutorialBoardState {
  return {
    puzzle: {
      revealedCellIndices: initialRevealedCellIndices,
      flaggedCellIndices: [],
      steppedMineCellIndices: [],
    },
    mode: "reveal",
    moveCount: 0,
  };
}

function getMinesweeperTutorialGoal(): MinesweeperTutorialBoardState {
  return {
    puzzle: {
      revealedCellIndices: listCellIndices().filter(
        (cellIndex) => !isMinesweeperMine(board, cellIndex),
      ),
      flaggedCellIndices: [],
      steppedMineCellIndices: [],
    },
    mode: "reveal",
    moveCount: 0,
  };
}

function applyCellAction(
  puzzle: MinesweeperPuzzleState,
  { type, cellIndex }: { type: "reveal" | "flag" | "chord"; cellIndex: number },
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

function isStepDone(
  step: MinesweeperTutorialStep,
  puzzle: MinesweeperPuzzleState,
): boolean {
  switch (step.operation) {
    case "reveal":
      return puzzle.revealedCellIndices.includes(step.cellIndex);
    case "flag":
      return puzzle.flaggedCellIndices.includes(step.cellIndex);
    case "chord":
      return getMinesweeperNeighborCellIndices(board, step.cellIndex).every(
        (cellIndex) =>
          isMinesweeperMine(board, cellIndex) ||
          puzzle.revealedCellIndices.includes(cellIndex),
      );
  }
}

/**
 * 手を引いている間は、印のマスへの手順どおりの操作だけを受け付ける。開く・まとめて開くは切り替えが開くのとき、
 * 旗は切り替えが旗のときか長押し・右クリックで届くので、届いた操作の種類だけを見る。
 * 手を離した後は本番と同じく受け付け、地雷を踏んだ手をルールに合わない手として返す。
 */
function performMinesweeperTutorialAction(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  action: MinesweeperTutorialAction,
): { state: MinesweeperTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (action.type === "change-mode") {
    return action.mode === state.mode
      ? { state, outcome: "ignored" }
      : { state: { ...state, mode: action.mode }, outcome: "continued" };
  }
  if (
    step !== null &&
    (action.type !== step.operation || action.cellIndex !== step.cellIndex)
  ) {
    return { state, outcome: "ignored" };
  }

  const puzzle = applyCellAction(state.puzzle, action);
  if (puzzle === state.puzzle) {
    return { state, outcome: "ignored" };
  }
  const next: MinesweeperTutorialBoardState = {
    ...state,
    puzzle,
    moveCount: state.moveCount + 1,
  };
  if (isMinesweeperCleared(board, puzzle)) {
    return { state: next, outcome: "solved" };
  }
  if (
    puzzle.steppedMineCellIndices.length >
    state.puzzle.steppedMineCellIndices.length
  ) {
    return { state: next, outcome: "violated" };
  }
  if (step !== null && isStepDone(step, puzzle)) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "continued" };
}

function describeMinesweeperTutorialViolation(): TutorialMessage {
  return { headline: "地雷を踏みました", detail: "ミスとして数えます" };
}

/** 本番の盤面と同じ見え方。解き終えたら、旗を置いていない地雷も見せる。 */
export function getMinesweeperTutorialCells(
  state: MinesweeperTutorialBoardState,
): MinesweeperVisibleCell[] {
  const { puzzle } = state;
  const cleared = isMinesweeperCleared(board, puzzle);
  return listCellIndices().map(
    function createCell(cellIndex): MinesweeperVisibleCell {
      if (puzzle.steppedMineCellIndices.includes(cellIndex)) {
        return { state: "steppedMine" };
      }
      if (puzzle.flaggedCellIndices.includes(cellIndex)) {
        return { state: "flagged" };
      }
      if (puzzle.revealedCellIndices.includes(cellIndex)) {
        return {
          state: "revealed",
          adjacentMineCount: getAdjacentMinesweeperMineCount(board, cellIndex),
        };
      }
      if (cleared && isMinesweeperMine(board, cellIndex)) {
        return { state: "mine" };
      }
      return { state: "hidden" };
    },
  );
}

/** 本番の見出しと同じく、地雷・旗・ミスの数。 */
export function getMinesweeperTutorialCounts(
  state: MinesweeperTutorialBoardState,
): { mineCount: number; flagCount: number; mistakeCount: number } {
  return {
    mineCount: board.mineCellIndices.length,
    flagCount: state.puzzle.flaggedCellIndices.length,
    mistakeCount: state.puzzle.steppedMineCellIndices.length,
  };
}

/** 始めの盤面では閉じていて、解き終えた盤面では開いているか地雷を見せるマス。導入で、ゴールから始めの盤面へ戻すのに使う。 */
export function getMinesweeperTutorialClosingCellIndices(): readonly number[] {
  return listCellIndices().filter(
    (cellIndex) => !initialRevealedCellIndices.includes(cellIndex),
  );
}

/** 手を引いている間に印を付けるところ。手を離した後は `null`。 */
export function getMinesweeperTutorialCue(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
): MinesweeperTutorialCue | null {
  if (step === null) {
    return null;
  }
  return getStepMode(step) === state.mode
    ? { target: "cell", cellIndex: step.cellIndex }
    : { target: "mode" };
}

/** 手順の一言。手順の操作に合わない切り替えのときは、補足の代わりに切り替え方を言う。 */
export function adjustMinesweeperTutorialMessage(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  message: TutorialMessage,
): TutorialMessage {
  if (step === null || message !== step.message) {
    return message;
  }
  const mode = getStepMode(step);
  return mode === state.mode
    ? message
    : { headline: message.headline, detail: modeChangeDetails[mode] };
}

/**
 * 手を離した後、手が止まったときに示す、今の盤面と手に入れたルールだけで開けると分かるマス。
 * 地雷を示すと押して踏みかねないので、開けるマスだけを示す。無ければ `null`。
 */
export function findMinesweeperTutorialHintCellIndex(
  { earnedRuleIds }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
): number | null {
  const byNumber = deduceCells(
    state.puzzle,
    earnedRuleIds.filter((ruleId) => ruleId !== "total"),
  ).safeCellIndices;
  const [first] = byNumber.size
    ? byNumber
    : deduceCells(state.puzzle, earnedRuleIds).safeCellIndices;
  return first ?? null;
}

export const minesweeperTutorial: Tutorial<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialStep,
  MinesweeperTutorialBoardState,
  MinesweeperTutorialAction
> = {
  intro: {
    purpose: "数字を手がかりに\n地雷ではないマスをすべて開くパズルです",
    goalCaption: "この盤面がゴールです",
    startCaption: "最初は一部のマスだけ開いています",
  },
  rules: [
    { id: "number", label: "周りの地雷" },
    { id: "cascade", label: "続けて開く" },
    { id: "chord", label: "まとめて開く" },
    { id: "total", label: "地雷の総数" },
  ],
  steps,
  freePlay: {
    headline: "残りのマスを開くと完成です",
    detail: "地雷を踏んでも続けられます",
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1も 数字と地雷の数だけで解けます",
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

export const _private = { board, initialRevealedCellIndices, deduceCells };
