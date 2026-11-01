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
 * - `operation`: `change-mode` なら `mode` へ切り替える。ほかは `cellIndex` のマスを開く・旗を置く・まとめて開く。
 * - `focusCellIndices`: 印のマスを決める数字。手順の間、見るところとして目立たせる。
 * - `focusCounts`: 盤面全体の地雷の数と旗の数を、見るところとして目立たせる。
 */
export type MinesweeperTutorialStep =
  TutorialStep<MinesweeperTutorialRuleId> & {
    focusCellIndices: readonly number[];
    focusCounts: boolean;
  } & (
      | { operation: "change-mode"; mode: MinesweeperTutorialInputMode }
      | { operation: "reveal" | "flag" | "chord"; cellIndex: number }
    );

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
 * - `modeCued`: 切り替えのボタン。手順の操作に合わない切り替えになっているときに付ける。
 * - `cellIndex`: 手順で操作するマス。切り替えが合っていなくても付け、どこを操作するかを先に見せる。
 */
export type MinesweeperTutorialCue = {
  modeCued: boolean;
  cellIndex: number | null;
};

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
 * ####21   111*21
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
 * 左上の角を開かせ、旗への切り替えを教えてから、その1が指す地雷に旗を置かせる。
 * 旗で数字が足りた2行2列の1から、3行1列を開かせる。3行1列の1も足りているので、4行1列を開くと左下が続けて開く。
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
    focusCounts: false,
  },
  {
    message: {
      headline: "地雷のマスには旗を置きます",
      detail: "上のボタンで旗に切り替えます",
    },
    introducedRuleId: null,
    operation: "change-mode",
    mode: "flag",
    focusCellIndices: [],
    focusCounts: false,
  },
  {
    message: {
      headline: "数字は\n周りの8マスにある地雷の数です",
      detail: "長押しでも旗を置けます",
    },
    introducedRuleId: "number",
    operation: "flag",
    cellIndex: cellAt(2, 1),
    focusCellIndices: [cellAt(1, 1)],
    focusCounts: false,
  },
  {
    message: {
      headline: "この1の地雷は旗のマスなので\n残りのマスに地雷はありません",
      detail: null,
    },
    introducedRuleId: null,
    operation: "reveal",
    cellIndex: cellAt(3, 1),
    focusCellIndices: [cellAt(2, 2)],
    focusCounts: false,
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
    focusCounts: false,
  },
  {
    message: {
      headline: "ここも数字から地雷だと分かります",
      detail: "旗は自分用の目印です\n合っているかは判定されません",
    },
    introducedRuleId: null,
    operation: "flag",
    cellIndex: cellAt(3, 4),
    focusCellIndices: [cellAt(2, 4)],
    focusCounts: false,
  },
  {
    message: {
      headline: "旗が数字の数だけあるとき\n数字を押すと残りをまとめて開きます",
      detail: "旗が違っていると地雷を踏みます",
    },
    introducedRuleId: "chord",
    operation: "chord",
    cellIndex: cellAt(4, 3),
    focusCellIndices: [],
    focusCounts: false,
  },
  {
    message: {
      headline: "ここも数字から地雷だと分かります",
      detail: "旗はもう一度押すと外せます\n旗のマスは押しても開きません",
    },
    introducedRuleId: null,
    operation: "flag",
    cellIndex: cellAt(6, 4),
    focusCellIndices: [cellAt(6, 3)],
    focusCounts: false,
  },
  {
    message: {
      headline: "上の地雷の数は\n盤面全体の地雷の数です",
      detail: "見つけた地雷は3つなので\n残りは1つです",
    },
    introducedRuleId: "total",
    operation: "reveal",
    cellIndex: cellAt(6, 5),
    focusCellIndices: [cellAt(3, 6)],
    focusCounts: true,
  },
];

/** 手順の操作に合わない切り替えのとき、補足の代わりに出す、切り替え方。 */
const modeChangeDetails = {
  reveal: "上のボタンをもう一度押して戻します",
  flag: "上のボタンで旗に切り替えます",
} as const satisfies Record<MinesweeperTutorialInputMode, string>;

/** 手順の操作に要る切り替え。切り替える手順は、切り替えを決めない。 */
function getStepMode(
  step: MinesweeperTutorialStep,
): MinesweeperTutorialInputMode | null {
  switch (step.operation) {
    case "change-mode":
      return null;
    case "flag":
      return "flag";
    case "reveal":
    case "chord":
      return "reveal";
  }
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
    case "change-mode":
      return false;
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
 * 手順で操作させるマスと、まとめて開かせるマス。手を引いている間は、ここに旗を置いたり外したりさせない。
 * 置くと開かせるマスが開かず、手順で置いた旗を外すと数字が足りなくなり、印どおりに押しても盤面が応えなくなる。
 */
const guidedCellIndices = new Set(
  steps.flatMap(function listGuidedCellIndices(step): number[] {
    if (step.operation === "change-mode") {
      return [];
    }
    return step.operation === "chord"
      ? [
          step.cellIndex,
          ...getMinesweeperNeighborCellIndices(board, step.cellIndex),
        ]
      : [step.cellIndex];
  }),
);

/**
 * 手を引いている間に受け付ける操作。印のマスへの手順どおりの操作のほか、旗は自分用の目印なので、
 * 旗を置けると教えた後は、手順に関わらないマスへ置き・外しできるようにする。
 */
function isAcceptedWhileGuiding(
  step: MinesweeperTutorialStep,
  action: { type: "reveal" | "flag" | "chord"; cellIndex: number },
): boolean {
  if (step.operation === "change-mode") {
    return false;
  }
  if (action.type === step.operation && action.cellIndex === step.cellIndex) {
    return true;
  }
  return (
    action.type === "flag" &&
    steps.indexOf(step) >=
      steps.findIndex((candidate) => candidate.operation === "flag") &&
    !guidedCellIndices.has(action.cellIndex)
  );
}

/**
 * 手を引いている間は、印のマスへの手順どおりの操作と、旗の置き・外しだけを受け付ける。開く・まとめて開くは切り替えが開くのとき、
 * 旗は切り替えが旗のときか長押し・右クリックで届くので、届いた操作の種類だけを見る。
 * 手を離した後は本番と同じく受け付け、地雷を踏んだ手をルールに合わない手として返す。
 */
function performMinesweeperTutorialAction(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  action: MinesweeperTutorialAction,
): { state: MinesweeperTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (action.type === "change-mode") {
    if (action.mode === state.mode) {
      return { state, outcome: "ignored" };
    }
    const changed = { ...state, mode: action.mode };
    const stepDone =
      step?.operation === "change-mode" && step.mode === action.mode;
    return { state: changed, outcome: stepDone ? "stepped" : "continued" };
  }
  if (step !== null && !isAcceptedWhileGuiding(step, action)) {
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
  return {
    headline: "地雷を踏みました",
    detail: "踏んだ地雷は\nまとめて開くときに旗と同じに数えます",
  };
}

/** 本番の盤面と同じ見え方。解き終えたら、旗を置いた地雷も含めてすべての地雷を見せ、答え合わせの盤面にする。 */
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
      if (cleared && isMinesweeperMine(board, cellIndex)) {
        return { state: "mine" };
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
  const mode = getStepMode(step);
  return {
    modeCued:
      step.operation === "change-mode" ||
      (mode !== null && mode !== state.mode),
    cellIndex: step.operation === "change-mode" ? null : step.cellIndex,
  };
}

/**
 * 手順の一言。補足の無い手順で、手順の操作に合わない切り替えのときは、補足の場所で切り替え方を言う。
 * 補足のある手順では、補足を読ませるのを優先し、切り替えはボタンの印だけで示す。
 */
export function adjustMinesweeperTutorialMessage(
  { step }: MinesweeperTutorialSituation,
  state: MinesweeperTutorialBoardState,
  message: TutorialMessage,
): TutorialMessage {
  if (step === null || message !== step.message) {
    return message;
  }
  const mode = getStepMode(step);
  return mode === null || mode === state.mode || message.detail !== null
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
    { id: "total", label: "地雷の数" },
  ],
  steps,
  freePlay: {
    headline: "残りのマスを開くと完成です",
    detail: "地雷を踏んでもミスになるだけで続けられます",
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1も同じルールで\n盤面は 9×9 ほどです",
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
