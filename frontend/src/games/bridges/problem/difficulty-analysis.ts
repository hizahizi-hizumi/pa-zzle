import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import {
  BRIDGES_SHARP_ROUND_EDGE_LIMIT,
  type BridgesReasoningTier,
  bridgesConnectivityTiers,
  bridgesReasoningTiers,
  countBridgesCornerOpeningIslands,
  countBridgesCountReadingPhases,
  countBridgesOpeningEdges,
  countBridgesOpeningSaturatedIslands,
  summarizeBridgesLookaheads,
  traceBridgesHumanSolve,
} from "@/games/bridges/problem/generation/human-solver";
import { tryBridgesNaively } from "@/games/bridges/problem/generation/naive-solver";
import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import type { BridgesProblem } from "@/games/bridges/problem/problem";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * 難易度特徴と比べるための問題の規模。挑戦ではなく、架ける量と盤面の広さの側の値。
 * - `size`: 正方形の盤面の一辺。
 * - `islandCount`・`edgeCount`: 島の数と、橋を架けられる島の組（行き先）の数。
 * - `bridgeCount`: 解の橋の本数の合計（2本の組は2と数える）。
 * - `clueMean`: 島の数字の平均。1 と 2 ばかりの盤面は、1か所ずつの読みが「足りる・足りない」の確かめだけになる。
 * - `highClueCount`: 数字5以上の島の数。行き先の多くに2本ずつ要り、2本と1本の配分を読む所になる。
 * - `veryHighClueCount`: 数字6以上の島の数。行き先が3つ以上の島に2本ずつ架かる見せ場。
 * - `maximumClue`: 最も大きい数字。
 * - `dominantClueShare`: 最も多い数字の島の割合。同じ数字が並ぶ単調な盤面ほど大きい。
 * - `twoClueShare`: 数字2の島の割合。2 は行き先1つに2本か2つに1本ずつで、多いと盤面が単調になる。
 * - `doubleBridgeRatio`: 解で橋を架ける組のうち、2本の組の割合。
 * - `loopCount`: 解の輪の数（架ける組の数 − 島の数 + 1）。輪が無い解は、伸ばした先から決まる木の読みだけになる。
 * - `borderBridgeShare`: 解で橋を架ける組のうち、盤面の外周の行・列に沿う組の割合。多いと盤面の枠をなぞる問題になる。
 * - `longBridgeShare`: 解で橋を架ける組のうち、盤面の一辺の半分以上の長さの組の割合。
 * - `usedEdgeShare`: 行き先（橋を架けられる組）のうち、解で橋を架ける組の割合。1 に近いと、どこへ架けるかを選ぶ所が無い。
 * - `islandShare`: 盤面のマスに対する島の数の割合。
 * - `diagonalNeighborShare`: 斜め隣のマスに島がある島の割合。大きいと島が市松に固まり、行き先が隣の島ばかりになる。
 * - `shortBridgeShare`: 解で橋を架ける組のうち、間が1マスの組の割合。
 * - `longBridgeCount`: 解で橋を架ける組のうち、盤面の一辺の半分以上の長さの組の数。
 * - `pointSymmetric`: 島の配置が盤面の中心について点対称なら 1、そうでなければ 0。
 * - `borderIslandShare`: 盤面の外周の行・列にある島の割合。多いと枠に島が並び、内側が空く。
 * - `gridAlignmentShare`: 島の行と列の偶奇（4組）のうち、最も多い組の島の割合。大きいと島が1マスおきの格子にそろう
 *   （無作為なら 0.3 前後）。
 */
export type BridgesScaleMetrics = {
  size: number;
  islandCount: number;
  edgeCount: number;
  bridgeCount: number;
  clueMean: number;
  highClueCount: number;
  veryHighClueCount: number;
  maximumClue: number;
  dominantClueShare: number;
  twoClueShare: number;
  doubleBridgeRatio: number;
  loopCount: number;
  borderBridgeShare: number;
  longBridgeShare: number;
  usedEdgeShare: number;
  islandShare: number;
  diagonalNeighborShare: number;
  shortBridgeShare: number;
  longBridgeCount: number;
  pointSymmetric: number;
  borderIslandShare: number;
  gridAlignmentShare: number;
};

/**
 * 人間向け解法器（段 A1〜D）で、数字と盤面だけから橋を決め切った経過から求めた特徴。
 * - `maximumTier`: 使った最も高い段。
 * - `countRoundCount`: 「少なくとも・多くとも」（A2）が要った数字の読みのまとまりの数。数字の読み（A1・A2）を続けて当てた
 *   まとまりを1つと数え、つながりの読みで区切る（`countBridgesCountReadingPhases`）。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながりの読み（C1p・C1g・C3・D）が要った手詰まりの回数。
 * - `roundCountByTier`: 段ごとの手詰まりの回数。
 * - `countReasoningUndecidedRatio`: 数字の読み（A1・A2）だけでは本数が決まらない行き先の割合。
 *   数字の読みで止まり、つながりを読み始めなければならない範囲の広さ。
 * - `openingEdgeRatio`: 解き始めの盤面で、数字の読みだけで範囲を狭められる行き先の割合（入口の広さ）。
 * - `openingSaturatedIslandCount`: 解き始めに、見ただけで全部の行き先の本数が決まる数字3以上の島（決め打ち）の数。
 * - `closureRoundCount`: 閉じない読み（C1p・C1g）で、1〜2組だけが決まった手詰まり（一か所の気づき）の回数。
 * - `sweepRoundCount`: つながりの読みで、3組以上がまとめて決まった手詰まり（同じ規則で盤面を掃く作業）の回数。分類には使わない。
 * - `groupClosureRoundCount`: 3島以上の組を閉じない読み（C1g）が要った手詰まりの回数。
 * - `lookaheadRoundCount`: 1手の先読み（D）が要った回数。下の段で決まる所を全部決め切った（どの順に読んでも同じになる）
 *   盤面で、1手の先読みでしか進めない手詰まりの回数で、前の先読みと同じ行き先を続けて狭めた手詰まりは前の先読みにまとめる
 *   （`summarizeBridgesLookaheads`）。
 * - `passageRoundCount`: 唯一の通り道（C3）が要った手詰まりの回数。
 * - `readingRoundCount`: 「ちょうど」だけでは進めない読みの回数。A2 が要った数字の読みのまとまり（`countRoundCount`）と、
 *   つながりの読みの手詰まり（`connectivityRoundCount`）の和。
 * - `groupLookaheadRoundCount`: 1手の先読みのうち、3島以上の組が閉じるか数島が孤立するのを見て退けた手詰まりの回数。
 *   仮に決めた手の両端を埋め、組を端までたどって閉じるのを確かめる、人が2段に読む所。
 * - `chainedLookaheadRoundCount`: 1手の先読みのうち、前の1手の先読みから、ほかの読みで狭めた組が
 *   `BRIDGES_LOOKAHEAD_CHAIN_GAP` 以下のうちに、別の行き先で続けて要った回数。先読みの結果からすぐ次の先読みが要る所。
 * - `lookaheadSpotCount`: 1手の先読みが要った場所の数（続けて要った先読みは1つの場所）。
 * - `longestLookaheadChain`: 1つの場所で続けて要った1手の先読みの数の最大。
 * - `crossingBlockCount`: 架かると決まった橋と交わって0本になった行き先のうち、両端の島がまだ足りなかった行き先の数。
 *   交差で行き先が消え、数字の読みが進む所。
 * - `cornerOpeningIslandCount`: 解き始めの決め打ちの島のうち、盤面の四隅の島の数。
 * - `countLookaheadRoundCount`: 1手の先読みのうち、本数が破れるのを見て退けた手詰まりの回数。
 * - `cappingLookaheadRoundCount`: 1手の先読みのうち、架けすぎる手を退けて上限を下げた手詰まりの回数。
 * - `isolatingLookaheadRoundCount`: 1手の先読みのうち、数島のまとまりが孤立するのを見て退けた手詰まりの回数。
 * - `readingCappingLookaheadRoundCount`: 1手の先読みのうち、架けすぎる手を本数の破れか組の閉じるので退けて上限を下げた回数。
 * - `lastConnectivityDecidedRatio`: 最後のつながりの読み（C1p・C1g・C3・D）の前に、本数が決まっていた行き先の割合。
 *   大きいほど、解き進みの後の方まで読みの山場が残る。つながりの読みが無ければ 0。
 * - `firstLookaheadDecidedRatio`: 最初の1手の先読みの前に、本数が決まっていた行き先の割合。先読みが無ければ 0。
 * - `lookaheadReasonKindCount`: 1手の先読みで手を退けた理由の種類（組が閉じる・孤立する・本数が破れる・上限を下げる）の数。
 */
export type BridgesReasoningFeatures = {
  maximumTier: Exclude<BridgesReasoningTier, "T">;
  countRoundCount: number;
  connectivityRoundCount: number;
  roundCountByTier: Readonly<Record<BridgesReasoningTier, number>>;
  countReasoningUndecidedRatio: number;
  openingEdgeRatio: number;
  openingSaturatedIslandCount: number;
  closureRoundCount: number;
  sweepRoundCount: number;
  groupClosureRoundCount: number;
  lookaheadRoundCount: number;
  passageRoundCount: number;
  readingRoundCount: number;
  groupLookaheadRoundCount: number;
  chainedLookaheadRoundCount: number;
  crossingBlockCount: number;
  cornerOpeningIslandCount: number;
  countLookaheadRoundCount: number;
  cappingLookaheadRoundCount: number;
  isolatingLookaheadRoundCount: number;
  lookaheadSpotCount: number;
  longestLookaheadChain: number;
  readingCappingLookaheadRoundCount: number;
  lastConnectivityDecidedRatio: number;
  firstLookaheadDecidedRatio: number;
  lookaheadReasonKindCount: number;
};

/**
 * 素朴な解き方（数字の読みと試し置き）を問題ごとに決まった乱数で数回試した結果。
 * - `medianBacktrackCount`: 戻した回数の中央値。試しに架けて直す進め方で、何度やり直しになるか。
 * - `medianDisconnectedFullCount`: 全島の本数がちょうどなのに、つながっていなかった回数の中央値。
 * - `firstTrySolvedRatio`: 1度も戻さずに解けた試行の割合。
 */
export type BridgesTrialFeatures = {
  medianBacktrackCount: number;
  medianDisconnectedFullCount: number;
  firstTrySolvedRatio: number;
};

/**
 * - `analyzed`: 一意解。`requiresTrial` が偽なら段 A1〜D で決め切れ、`reasoning` はその経過。真なら試し置き（T）が要り、
 *   推理だけでは決まらない（`reasoning` は使わない）。
 * - `unsupported`: 一意解だが、試し置きまで使っても決まらない辺が残る。評価不能。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
export type BridgesDifficultyAnalysis =
  | {
      status: "analyzed";
      requiresTrial: false;
      scale: BridgesScaleMetrics;
      reasoning: BridgesReasoningFeatures;
      trial: BridgesTrialFeatures;
    }
  | { status: "analyzed"; requiresTrial: true; scale: BridgesScaleMetrics }
  | { status: "unsupported"; scale: BridgesScaleMetrics }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-limit";
    };

/** 一意性を確かめる探索の局面の数の上限。研究用の解法器と同じ値で、10×10 でも届いた問題は無い。 */
export const BRIDGES_UNIQUENESS_NODE_LIMIT = 200_000;

/** 素朴な解き方を1問に試す回数。 */
export const BRIDGES_NAIVE_TRIAL_COUNT = 5;

/** 推理の段。試し置き（T）を除く。 */
const bridgesDeductionTiers = bridgesReasoningTiers.filter(
  (tier): tier is Exclude<BridgesReasoningTier, "T"> => tier !== "T",
);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function measureScale(
  problem: BridgesProblem,
  solution: readonly number[],
): BridgesScaleMetrics {
  const clues = problem.islands.map(({ clue }) => clue);
  const clueCounts = new Map<number, number>();
  for (const clue of clues) {
    clueCounts.set(clue, (clueCounts.get(clue) ?? 0) + 1);
  }
  const usedEdgeCount = solution.filter((count) => count > 0).length;
  const { edges } = getBridgesNetwork(problem);
  const last = problem.width - 1;
  let borderBridges = 0;
  let longBridges = 0;
  let shortBridges = 0;
  for (const [edge, { from, to }] of edges.entries()) {
    if (solution[edge]! === 0) {
      continue;
    }
    const start = problem.islands[from]!;
    const end = problem.islands[to]!;
    if (
      (start.row === end.row && (start.row === 0 || start.row === last)) ||
      (start.column === end.column &&
        (start.column === 0 || start.column === last))
    ) {
      borderBridges += 1;
    }
    const length =
      Math.abs(start.row - end.row) + Math.abs(start.column - end.column);
    if (length * 2 >= problem.width) {
      longBridges += 1;
    }
    if (length === 2) {
      shortBridges += 1;
    }
  }
  const occupied = new Set(
    problem.islands.map(({ row, column }) => `${row}:${column}`),
  );
  const diagonalNeighbors = problem.islands.filter(({ row, column }) =>
    [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ].some(([rowStep, columnStep]) =>
      occupied.has(`${row + rowStep!}:${column + columnStep!}`),
    ),
  ).length;
  const pointSymmetric = problem.islands.every(({ row, column }) =>
    occupied.has(`${problem.height - 1 - row}:${problem.width - 1 - column}`),
  );
  return {
    size: problem.width,
    islandCount: problem.islands.length,
    edgeCount: edges.length,
    bridgeCount: solution.reduce((total, count) => total + count, 0),
    clueMean: clues.reduce((total, clue) => total + clue, 0) / clues.length,
    highClueCount: clues.filter((clue) => clue >= HIGH_CLUE_MINIMUM).length,
    veryHighClueCount: clues.filter((clue) => clue >= VERY_HIGH_CLUE_MINIMUM)
      .length,
    maximumClue: Math.max(...clues),
    dominantClueShare: Math.max(...clueCounts.values()) / clues.length,
    twoClueShare: (clueCounts.get(2) ?? 0) / clues.length,
    doubleBridgeRatio:
      usedEdgeCount === 0
        ? 0
        : solution.filter((count) => count === 2).length / usedEdgeCount,
    loopCount: usedEdgeCount - problem.islands.length + 1,
    borderBridgeShare: usedEdgeCount === 0 ? 0 : borderBridges / usedEdgeCount,
    longBridgeShare: usedEdgeCount === 0 ? 0 : longBridges / usedEdgeCount,
    usedEdgeShare: edges.length === 0 ? 0 : usedEdgeCount / edges.length,
    islandShare: problem.islands.length / (problem.width * problem.height),
    diagonalNeighborShare: diagonalNeighbors / problem.islands.length,
    shortBridgeShare: usedEdgeCount === 0 ? 0 : shortBridges / usedEdgeCount,
    longBridgeCount: longBridges,
    pointSymmetric: pointSymmetric ? 1 : 0,
    borderIslandShare:
      problem.islands.filter(
        ({ row, column }) =>
          row === 0 || row === last || column === 0 || column === last,
      ).length / problem.islands.length,
    gridAlignmentShare:
      Math.max(
        ...[0, 1, 2, 3].map(
          (parity) =>
            problem.islands.filter(
              ({ row, column }) => (row % 2) * 2 + (column % 2) === parity,
            ).length,
        ),
      ) / problem.islands.length,
  };
}

/** 大きい数字とみなす島の数字の下限。 */
const HIGH_CLUE_MINIMUM = 5;

/** とても大きい数字とみなす島の数字の下限。行き先が3つ以上要る。 */
const VERY_HIGH_CLUE_MINIMUM = 6;

const closureTiers: readonly BridgesReasoningTier[] = ["C1p", "C1g"];

/**
 * 素朴な解き方を、盤面の回転・反転の正規化キーから決まる乱数で試す。同じ形の盤面からは同じ乱数列を使う。
 */
export function measureBridgesTrialFeatures(
  problem: BridgesProblem,
): BridgesTrialFeatures {
  const boardKey = getBridgesSymmetryKey(problem);
  const results = Array.from(
    { length: BRIDGES_NAIVE_TRIAL_COUNT },
    (_, trial) =>
      tryBridgesNaively(
        problem,
        createProblemSeededRandom(`bridges-naive:${trial}:${boardKey}`),
      ),
  );
  return {
    medianBacktrackCount: median(
      results.map((result) => result.backtrackCount),
    ),
    medianDisconnectedFullCount: median(
      results.map((result) => result.disconnectedFullCount),
    ),
    firstTrySolvedRatio:
      results.filter((result) => result.solved && result.backtrackCount === 0)
        .length / results.length,
  };
}

function countRounds(
  rounds: readonly { tier: BridgesReasoningTier }[],
): Record<BridgesReasoningTier, number> {
  const counts = Object.fromEntries(
    bridgesReasoningTiers.map((tier) => [tier, 0]),
  ) as Record<BridgesReasoningTier, number>;
  for (const { tier } of rounds) {
    counts[tier] += 1;
  }
  return counts;
}

/**
 * 問題を分析する。完全解法器で一意解かを確かめ、人間向け解法器で段 A1〜D の経過を求め、素朴な解き方を試す。
 * 人間向け解法器が解き切った橋は、完全解法器の解と一致することを確かめる。
 */
export function analyzeBridgesDifficulty(
  problem: BridgesProblem,
): BridgesDifficultyAnalysis {
  const count = countBridgesSolutions(problem, {
    limit: 2,
    nodeLimit: BRIDGES_UNIQUENESS_NODE_LIMIT,
  });
  if (count.exceededNodeLimit) {
    return { status: "invalid", reason: "search-limit" };
  }
  if (count.solutionCount !== 1 || count.firstSolution === null) {
    return {
      status: "invalid",
      reason: count.solutionCount === 0 ? "no-solution" : "multiple-solutions",
    };
  }
  const solution = count.firstSolution;
  const scale = measureScale(problem, solution);
  const trace = traceBridgesHumanSolve(problem, "T");
  if (trace.status !== "solved") {
    return { status: "unsupported", scale };
  }
  if (trace.bridges.some((bridges, edge) => bridges !== solution[edge])) {
    throw new Error("The human solver disagrees with the exact solver");
  }
  const roundCountByTier = countRounds(trace.rounds);
  if (roundCountByTier.T > 0) {
    return { status: "analyzed", requiresTrial: true, scale };
  }
  const maximumTier =
    bridgesDeductionTiers.findLast((tier) => roundCountByTier[tier] > 0) ??
    "A1";
  const countTrace = traceBridgesHumanSolve(problem, "A2");
  const connectivityRounds = trace.rounds.filter(({ tier }) =>
    (bridgesConnectivityTiers as readonly BridgesReasoningTier[]).includes(
      tier,
    ),
  );
  const { lookaheads, mergedRoundCount, spotCount, longestChain } =
    summarizeBridgesLookaheads(trace.rounds);
  const countRoundCount = countBridgesCountReadingPhases(trace.rounds);
  const connectivityRoundCount = connectivityRounds.length - mergedRoundCount;
  return {
    status: "analyzed",
    requiresTrial: false,
    scale,
    reasoning: {
      maximumTier,
      countRoundCount,
      connectivityRoundCount,
      roundCountByTier,
      countReasoningUndecidedRatio: countTrace.undecidedEdgeRatio,
      openingEdgeRatio:
        scale.edgeCount === 0
          ? 0
          : countBridgesOpeningEdges(problem) / scale.edgeCount,
      openingSaturatedIslandCount: countBridgesOpeningSaturatedIslands(problem),
      closureRoundCount: trace.rounds.filter(
        ({ tier, edgeCount }) =>
          closureTiers.includes(tier) &&
          edgeCount <= BRIDGES_SHARP_ROUND_EDGE_LIMIT,
      ).length,
      sweepRoundCount: connectivityRounds.filter(
        ({ edgeCount }) => edgeCount > BRIDGES_SHARP_ROUND_EDGE_LIMIT,
      ).length,
      groupClosureRoundCount: roundCountByTier.C1g,
      lookaheadRoundCount: lookaheads.length,
      passageRoundCount: roundCountByTier.C3,
      readingRoundCount: countRoundCount + connectivityRoundCount,
      groupLookaheadRoundCount: lookaheads.filter(
        ({ readsGroup }) => readsGroup,
      ).length,
      chainedLookaheadRoundCount: lookaheads.length - spotCount,
      crossingBlockCount: trace.crossingBlockCount,
      cornerOpeningIslandCount: countBridgesCornerOpeningIslands(problem),
      countLookaheadRoundCount: lookaheads.filter(
        ({ readsCount }) => readsCount,
      ).length,
      cappingLookaheadRoundCount: lookaheads.filter(
        ({ lowersUpper }) => lowersUpper,
      ).length,
      isolatingLookaheadRoundCount: lookaheads.filter(
        ({ readsIsolation }) => readsIsolation,
      ).length,
      lookaheadSpotCount: spotCount,
      longestLookaheadChain: longestChain,
      readingCappingLookaheadRoundCount: lookaheads.filter(
        ({ lowersUpperByReading }) => lowersUpperByReading,
      ).length,
      lastConnectivityDecidedRatio:
        connectivityRounds.at(-1)?.decidedRatio ?? 0,
      firstLookaheadDecidedRatio:
        trace.rounds.find(({ tier }) => tier === "D")?.decidedRatio ?? 0,
      lookaheadReasonKindCount: [
        lookaheads.some(({ readsClosure }) => readsClosure),
        lookaheads.some(({ readsIsolation }) => readsIsolation),
        lookaheads.some(({ readsCount }) => readsCount),
        lookaheads.some(({ lowersUpper }) => lowersUpper),
      ].filter(Boolean).length,
    },
    trial: measureBridgesTrialFeatures(problem),
  };
}
