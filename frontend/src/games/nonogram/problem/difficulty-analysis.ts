import {
  countNonogramReadingsBeyondEdges,
  type NonogramReadingRound,
  traceNonogramReadingRounds,
} from "@/games/nonogram/problem/generation/propagation";
import { countNonogramSolutions } from "@/games/nonogram/problem/generation/solution-count";
import type { NonogramProblem } from "@/games/nonogram/problem/problem";

/** 難易度特徴と比べるための盤面の規模。挑戦ではなく、見渡す範囲の側の値。 */
export type NonogramScaleMetrics = {
  width: number;
  height: number;
  cellCount: number;
};

/**
 * 仮置きせずに、読める行・列をすべて同時に完全な線の読みで読む「段」を重ねて解いた経過から求めた特徴。
 * 読む順序に依らない。
 * - `roundCount`: 連鎖の深さ。解き終えるまでの段の数。
 * - `entryLineCount`: 入口の広さ。最初の段で新しく決まるマスがあった行・列の数。
 * - `firstRoundFixedCellCount`: 最初の段で決まったマスの数。
 * - `minimumProgressedLineCount`: 各段で進めた行・列の数の最小。
 * - `narrowRoundCount`: 進めた行・列が2本以下の段の数。手を付けられる場所が少ない局面の多さ。
 * - `readingsBeyondEdgesCount`: 端寄せの読み（各塊を両端に寄せた重なりと届かないマス）では止まり、
 *   完全な線の読みで初めて進む読みの回数。塊の置き方まで考える読みが要るか。
 */
export type NonogramReadingFeatures = {
  roundCount: number;
  entryLineCount: number;
  firstRoundFixedCellCount: number;
  minimumProgressedLineCount: number;
  narrowRoundCount: number;
  readingsBeyondEdgesCount: number;
};

/**
 * - `analyzed`: 1本ずつの線の読みだけで全マスが決まり、特徴を測れた（解はただ1つ）。
 * - `unsupported`: 解はただ1つだが、線の読みだけでは決まらないマスが残る。仮置きを要するので挑戦の強さを測らない。
 * - `invalid`: 解が2つ以上ある、または解の数え上げを打ち切った（問題として成立しない）。
 *   問題のヒントは解から求めるので、解が無いことは無い。
 */
export type NonogramDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: NonogramScaleMetrics;
      features: NonogramReadingFeatures;
    }
  | { status: "unsupported"; scale: NonogramScaleMetrics }
  | {
      status: "invalid";
      reason: "multiple-solutions" | "search-limit-reached";
      scale: NonogramScaleMetrics;
    };

/** 進めた行・列がこの数以下の段を、手を付けられる場所が少ない段と数える。 */
const NARROW_ROUND_MAXIMUM_LINE_COUNT = 2;

function measureScale({
  width,
  height,
}: NonogramProblem): NonogramScaleMetrics {
  return { width, height, cellCount: width * height };
}

function summarizeRounds(
  rounds: readonly NonogramReadingRound[],
  readingsBeyondEdgesCount: number,
): NonogramReadingFeatures {
  const progressedLineCounts = rounds.map(
    ({ progressedLineCount }) => progressedLineCount,
  );
  return {
    roundCount: rounds.length,
    entryLineCount: rounds[0]?.progressedLineCount ?? 0,
    firstRoundFixedCellCount: rounds[0]?.fixedCellCount ?? 0,
    minimumProgressedLineCount:
      rounds.length === 0 ? 0 : Math.min(...progressedLineCounts),
    narrowRoundCount: progressedLineCounts.filter(
      (count) => count <= NARROW_ROUND_MAXIMUM_LINE_COUNT,
    ).length,
    readingsBeyondEdgesCount,
  };
}

function classifyUnreadableProblem(
  problem: NonogramProblem,
  scale: NonogramScaleMetrics,
): NonogramDifficultyAnalysis {
  const search = countNonogramSolutions(problem.clues);
  if (search.status === "aborted") {
    return { status: "invalid", reason: "search-limit-reached", scale };
  }
  if (search.solutionCount > 1) {
    return { status: "invalid", reason: "multiple-solutions", scale };
  }
  return { status: "unsupported", scale };
}

/** ヒントだけを読んで特徴を測る。解は使わない。 */
export function analyzeNonogramDifficulty(
  problem: NonogramProblem,
): NonogramDifficultyAnalysis {
  const scale = measureScale(problem);
  const trace = traceNonogramReadingRounds(problem.clues);
  if (trace.status === "stalled") {
    return classifyUnreadableProblem(problem, scale);
  }
  const readingsBeyondEdgesCount = countNonogramReadingsBeyondEdges(
    problem.clues,
  );
  if (readingsBeyondEdgesCount === null) {
    throw new Error(
      "Nonogram readings beyond edges must finish when the reading rounds finish",
    );
  }
  return {
    status: "analyzed",
    scale,
    features: summarizeRounds(trace.rounds, readingsBeyondEdgesCount),
  };
}
