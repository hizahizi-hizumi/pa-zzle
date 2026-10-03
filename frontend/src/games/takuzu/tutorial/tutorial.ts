import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import {
  parseTakuzuBoard,
  type TakuzuCell,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  createTakuzuSession,
  cycleTakuzuSessionCell,
  placeTakuzuSessionCell,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import type { Tutorial, TutorialStep } from "@/games/tutorial";

/** 盤面と同じく、巡回で押すか、キーで直接置くか。固定マスを押した操作も届く。 */
export type TakuzuTutorialAction =
  | { type: "cycle"; cellIndex: number; direction: TakuzuCycleDirection }
  | { type: "place"; cellIndex: number; cell: TakuzuCell };

/** 強調する対象はマスの番号（行優先）。 */
type TakuzuTutorialStep = TutorialStep<
  TakuzuSession,
  TakuzuTutorialAction,
  number
>;

/**
 * 4×4 の固定盤面。ステップで置いたタイルが、そのまま次のステップの手掛かりになるように並べてある。
 * - 1・2: 1行3列に四角、続けて丸を置く。
 * - 3: 3行目が 四角 四角 _ _ なので、3行3列は丸（四角だと3つ続く）。
 * - 4: 3行目が 四角 四角 丸 _ なので、3行4列は丸（四角だと個数が多すぎる）。
 * - 5: 1行目が 四角 _ 丸 _。左から 四角・丸 と埋めると3行目と同じ並びになるので、丸・四角 と埋める。
 * - 7: 残りの6マスは、ここまでのタイルと固定タイルからすべて決まる。
 */
const takuzuTutorialProblem: TakuzuProblem = {
  givens: parseTakuzuBoard(["A...", "..A.", "AA..", ".B.."]),
  solution: parseTakuzuBoard(["ABBA", "BAAB", "AABB", "BBAA"]),
};

const placementCellIndex = 2;
const runCellIndex = 10;
const balanceCellIndex = 11;
const duplicateCellIndices = [1, 3] as const;
const givenCellIndex = 6;

/** チュートリアルに経過時間は無いので、session へ渡す時刻はすべてこの値にする。 */
const tutorialTime = 0;

function targetsOneOf(cellIndices: readonly number[]) {
  return function allowsTargetedCells(
    _session: TakuzuSession,
    action: TakuzuTutorialAction,
  ): boolean {
    return cellIndices.includes(action.cellIndex);
  };
}

function hasTile(cellIndex: number, tile: TakuzuTile) {
  return function isTilePlaced(session: TakuzuSession): boolean {
    return session.board.cells[cellIndex] === tile;
  };
}

function matchesSolutionAt(cellIndices: readonly number[]) {
  return function areCellsSolved(session: TakuzuSession): boolean {
    return cellIndices.every(function isSolved(cellIndex) {
      return (
        session.board.cells[cellIndex] ===
        session.problem.solution.cells[cellIndex]
      );
    });
  };
}

const steps: readonly TakuzuTutorialStep[] = [
  {
    instruction: "このマスをタップして、四角を置こう。",
    highlightedTargets: [placementCellIndex],
    allows: targetsOneOf([placementCellIndex]),
    isAchieved: hasTile(placementCellIndex, "a"),
  },
  {
    instruction: "もう一度タップして、丸に変えよう。",
    highlightedTargets: [placementCellIndex],
    allows: targetsOneOf([placementCellIndex]),
    isAchieved: hasTile(placementCellIndex, "b"),
  },
  {
    instruction: "同じものは3つ続けられない。ここに入るのは？",
    highlightedTargets: [runCellIndex],
    allows: targetsOneOf([runCellIndex]),
    isAchieved: matchesSolutionAt([runCellIndex]),
  },
  {
    instruction: "各行の四角と丸は同じ数。ここに入るのは？",
    highlightedTargets: [balanceCellIndex],
    allows: targetsOneOf([balanceCellIndex]),
    isAchieved: matchesSolutionAt([balanceCellIndex]),
  },
  {
    instruction: "同じ並びの行は作れない。3行目と違う並びで埋めよう。",
    highlightedTargets: duplicateCellIndices,
    allows: targetsOneOf(duplicateCellIndices),
    isAchieved: matchesSolutionAt(duplicateCellIndices),
  },
  {
    instruction: "最初からあるタイルは変えられない。タップしてみよう。",
    highlightedTargets: [givenCellIndex],
    allows: targetsOneOf([givenCellIndex]),
    isAchieved: hasTile(givenCellIndex, "a"),
  },
  {
    instruction: "残りのマスを埋めて完成させよう。",
    highlightedTargets: [],
    allows() {
      return true;
    },
    isAchieved(session) {
      return session.status === "cleared";
    },
  },
];

function performTakuzuTutorialAction(
  session: TakuzuSession,
  action: TakuzuTutorialAction,
): TakuzuSession {
  if (action.type === "cycle") {
    return cycleTakuzuSessionCell(
      session,
      action.cellIndex,
      action.direction,
      tutorialTime,
    );
  }
  return placeTakuzuSessionCell(
    session,
    action.cellIndex,
    action.cell,
    tutorialTime,
  );
}

export const takuzuTutorial: Tutorial<
  TakuzuSession,
  TakuzuTutorialAction,
  number
> = {
  initialState: createTakuzuSession(takuzuTutorialProblem, tutorialTime),
  steps,
  perform: performTakuzuTutorialAction,
};
