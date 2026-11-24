import {
  measureShuttleParkingRuleBestWinProbability,
  measureShuttleParkingRuleWinProbability,
  SHUTTLE_PARKING_NAIVE_RULES,
  type ShuttleParkingNaiveRule,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import {
  countShuttleParkingDecisions,
  measureShuttleParkingNaiveReaderWinProbability,
  measureShuttleParkingWeightBounds,
  SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
  type ShuttleParkingDecisionCounts,
  ShuttleParkingReader,
  type ShuttleParkingWeightBounds,
} from "@/games/shuttle-parking/problem/generation/readers";
import {
  AnalysisGame,
  findShuttleParkingMinimumBays,
} from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";

/**
 * 難易度の判定に使う問題の特徴。罠の重さ = 罠の手の後に乗れる人数 + 1（その罠の負けが見えるのに要る人数）。
 * - `headFirst`: 先頭に合わせる人の勝ち筋の上の、罠の重さの最大の、勝ち筋の中での最小と最大。
 *   `best` は罠の深さを最善の続きで、`continuation` は罠に気づかず素朴な解き方（`listNaiveMoves`）で続けた場合で取る。
 * - `window`: 先回りする人（先頭から5人に出てくる色の車とそれを塞ぐ車を候補にする）の同じ量。
 * - `freePath`: 罠は先頭に合わせる人の候補で数え、進め方は勝つ手ならどれでもよいとしたときの同じ量の最小。
 * - `rules`: 前もって固定した素朴な規則ごとの、同点を一様に選んだ勝率。
 * - `bestRules`: 同じ規則の、同点の選び方（`SHUTTLE_PARKING_TIE_BREAKS`）ごとの勝率の最大。上位を止める条件はこちらで見る。
 * - `naiveReader`: Lv3〜5 ごとに、素朴な解き方の候補から、そのレベルの重さの下限より1人少なく読む人の勝率。
 * - `decisions`: 記録だけ。勝ち筋の上で出会う判断（同じ車が罠のまま続く局面の並びを1つ）の回数。
 */
export type ShuttleParkingDifficultyFeatures = {
  bayCount: number;
  headFirst: {
    best: ShuttleParkingWeightBounds;
    continuation: ShuttleParkingWeightBounds;
  };
  window: ShuttleParkingWeightBounds;
  freePathMinimumWeight: number;
  rules: Record<ShuttleParkingNaiveRule, number>;
  bestRules: Record<ShuttleParkingNaiveRule, number>;
  naiveReader: Record<ShuttleParkingUpperLevel, number>;
  decisions: {
    best: ShuttleParkingDecisionCounts;
    continuation: ShuttleParkingDecisionCounts;
    window: ShuttleParkingDecisionCounts;
  };
};

/** 素朴な規則と読む人で上限を確かめるレベル。 */
export type ShuttleParkingUpperLevel = "3" | "4" | "5";

/**
 * 分析が使うレベルの境目。正本は `difficulty.ts` で、分析は引数で受け取る。
 * - `upperLevelMinimumWeights`: Lv3〜5 の罠の重さの下限。読む人はそれより1人少なく読む。
 * - `decisionThresholds`: 判断の回数を数える重さの段（記録だけ）。
 */
export type ShuttleParkingAnalysisLevelWeights = {
  upperLevelMinimumWeights: Readonly<Record<ShuttleParkingUpperLevel, number>>;
  decisionThresholds: readonly number[];
};

/**
 * - `analyzed`: 特徴を測れた。
 * - `unsupported`: 待機枠が、解ける最小の数でない（多すぎる・足りない・全部出せない）。生成は最小の数だけを出す。
 */
export type ShuttleParkingDifficultyAnalysis =
  | { status: "analyzed"; features: ShuttleParkingDifficultyFeatures }
  | { status: "unsupported"; minimumBayCount: number | null };

function roundProbability(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function measureRules(
  game: AnalysisGame,
  measure: (game: AnalysisGame, rule: ShuttleParkingNaiveRule) => number,
): Record<ShuttleParkingNaiveRule, number> {
  return Object.fromEntries(
    (Object.keys(SHUTTLE_PARKING_NAIVE_RULES) as ShuttleParkingNaiveRule[]).map(
      (rule) => [rule, roundProbability(measure(game, rule))],
    ),
  ) as Record<ShuttleParkingNaiveRule, number>;
}

export function analyzeShuttleParkingDifficulty(
  problem: ShuttleParkingProblem,
  {
    upperLevelMinimumWeights,
    decisionThresholds,
  }: ShuttleParkingAnalysisLevelWeights,
): ShuttleParkingDifficultyAnalysis {
  const minimumBayCount = findShuttleParkingMinimumBays(problem);
  if (minimumBayCount !== problem.bayCount) {
    return { status: "unsupported", minimumBayCount };
  }
  const game = new AnalysisGame(problem);
  const best = new ShuttleParkingReader(game, "best");
  const continuation = new ShuttleParkingReader(game, "continuation");
  const window = new ShuttleParkingReader(game, "best");
  const windowWiden = ["window"] as const;
  return {
    status: "analyzed",
    features: {
      bayCount: problem.bayCount,
      headFirst: {
        best: measureShuttleParkingWeightBounds(
          best,
          SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
        ),
        continuation: measureShuttleParkingWeightBounds(
          continuation,
          SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
        ),
      },
      window: measureShuttleParkingWeightBounds(window, windowWiden),
      freePathMinimumWeight: measureShuttleParkingWeightBounds(
        best,
        SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
        { freePath: true },
      ).minimum,
      rules: measureRules(game, measureShuttleParkingRuleWinProbability),
      bestRules: measureRules(
        game,
        measureShuttleParkingRuleBestWinProbability,
      ),
      naiveReader: Object.fromEntries(
        Object.entries(upperLevelMinimumWeights).map(([level, minimum]) => [
          level,
          roundProbability(
            measureShuttleParkingNaiveReaderWinProbability(game, minimum - 1),
          ),
        ]),
      ) as Record<ShuttleParkingUpperLevel, number>,
      decisions: {
        best: countShuttleParkingDecisions(
          best,
          SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
          decisionThresholds,
        ),
        continuation: countShuttleParkingDecisions(
          continuation,
          SHUTTLE_PARKING_HEAD_FIRST_WIDEN,
          decisionThresholds,
        ),
        window: countShuttleParkingDecisions(
          window,
          windowWiden,
          decisionThresholds,
        ),
      },
    },
  };
}
