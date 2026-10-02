import {
  assessReflectionDifficulty,
  type ReflectionDifficulty,
  type ReflectionLevelCombination,
  reflectionDifficulties,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import { analyzeReflectionDifficulty } from "@/games/reflection/problem/difficulty-analysis";
import { getReflectionSymmetryKey } from "@/games/reflection/problem/generation/symmetry";
import { traceReflectionTrialSolve } from "@/games/reflection/problem/generation/trial-solver";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  REFLECTION_GENERATOR_VERSION,
  type ReflectionRecordedProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  listReflectionPoolEntries,
  toReflectionPooledProblem,
} from "@/games/reflection/problem/problem-pool";
import {
  restoreReflectionProblem,
  selectReflectionProblemForDifficulty,
} from "@/games/reflection/problem-selection";
import {
  isReflectionSolved,
  listReflectionClueMatches,
} from "@/games/reflection/puzzle/rules";

const difficulties = reflectionDifficulties.map(({ id }) => id);

// 全問の一意性確認・分析・再生成には数十分かかるため、テストでは等間隔に抜き出した問題だけを確かめる。
// 人間向け解法器の分析はレベル5 の 9×9〜11×11 で1問数秒〜数十秒かかるので、レベル1〜4 だけで行う。
// 全問の検証は `bun run generate:reflection-pool -- --verify` で行う。
const analyzedEntryCountByDifficulty = {
  "1": 20,
  "2": 20,
  "3": 20,
  "4": 4,
} as const satisfies Partial<Record<ReflectionDifficulty, number>>;
const trialCheckedEntryCountPerDifficulty = 20;
const regeneratedEntryCountPerDifficulty = 4;

function listPooledProblems(difficulty: ReflectionDifficulty) {
  return listReflectionPoolEntries(difficulty).map((_, entryIndex) =>
    toReflectionPooledProblem(difficulty, entryIndex),
  );
}

function sampleEvenly<T>(values: readonly T[], count: number): T[] {
  const step = Math.max(1, Math.floor(values.length / count));
  return values.filter((_, index) => index % step === 0).slice(0, count);
}

describe("問題集", () => {
  test.each(difficulties)(
    "レベル %s の全問題が、今の生成器の identity を持つこと",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      expect(pooled.length).toBeGreaterThan(0);
      expect(
        new Set(pooled.map(({ identity }) => identity.generatorVersion)),
      ).toEqual(new Set([REFLECTION_GENERATOR_VERSION]));
    },
  );

  test("全レベルを通して同型の問題・同じ identity を含まないこと", () => {
    const pooled = difficulties.flatMap(listPooledProblems);

    const symmetryKeys = pooled.map(({ problem }) =>
      getReflectionSymmetryKey(problem.solution),
    );
    const seeds = pooled.map(({ identity }) => identity.seed);
    expect(new Set(symmetryKeys).size).toBe(pooled.length);
    expect(new Set(seeds).size).toBe(pooled.length);
  });

  test.each(Object.entries(analyzedEntryCountByDifficulty))(
    "レベル %s から抜き出した %i 問が、分析でそのレベルに分類され、作業の量が分析の結果と一致すること",
    (difficulty, count) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty as ReflectionDifficulty),
        count,
      );

      const analyses = sampled.map(({ problem }) =>
        analyzeReflectionDifficulty(problem),
      );

      expect(
        new Set(
          analyses.map((analysis) => {
            const assessment = assessReflectionDifficulty(analysis);
            return assessment.status === "classified"
              ? assessment.difficulty
              : assessment.status;
          }),
        ),
      ).toEqual(new Set([difficulty]));
      expect(
        analyses.map((analysis) =>
          analysis.status === "analyzed"
            ? {
                propagationRoundCount: analysis.features.propagationRoundCount,
                assumptionTestCount: analysis.features.assumptionTestCount,
                trialMoveCount: analysis.trial.solved
                  ? analysis.trial.moveCount
                  : null,
              }
            : null,
        ),
      ).toEqual(
        sampled.map(({ workload }) => ({
          propagationRoundCount: workload.propagationRoundCount,
          assumptionTestCount: workload.assumptionTestCount,
          trialMoveCount: workload.trialMoveCount,
        })),
      );
    },
    60_000,
  );

  test.each(difficulties)(
    "レベル %s から抜き出した問題が、試し置きの手数を作業の量に持ち、そのレベルの試し置きの下限を満たすこと",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        trialCheckedEntryCountPerDifficulty,
      );
      const { minimumTrialRetryCount = 0 }: ReflectionLevelCombination =
        reflectionLevelCombinations[difficulty];

      const traces = sampled.map(({ problem }) =>
        traceReflectionTrialSolve(problem),
      );

      expect(
        traces.map((trace) =>
          trace.status === "solved" ? trace.moveCount : null,
        ),
      ).toEqual(sampled.map(({ workload }) => workload.trialMoveCount));
      expect(
        traces.every(
          (trace) =>
            trace.status !== "solved" ||
            trace.retryCount >= minimumTrialRetryCount,
        ),
      ).toBe(true);
    },
    60_000,
  );

  test.each(difficulties)(
    "レベル %s から抜き出した問題の正解配置では、全外周ヒントが一致してクリアになること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        trialCheckedEntryCountPerDifficulty,
      );

      const results = sampled.map(({ problem }) => ({
        allMatched: listReflectionClueMatches(
          problem.solution,
          problem.clues,
        ).every(Boolean),
        solved: isReflectionSolved(problem.solution, problem),
      }));

      expect(results).toEqual(
        sampled.map(() => ({ allMatched: true, solved: true })),
      );
    },
  );

  test.each(difficulties)(
    "レベル %s から抜き出した問題を、identity から生成し直せること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        regeneratedEntryCountPerDifficulty,
      );

      const regenerated = sampled.map(
        ({ identity }) => generateReflectionProblem(identity).problem,
      );

      expect(regenerated).toEqual(sampled.map(({ problem }) => problem));
    },
  );
});

describe("selectReflectionProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "レベル %s で同じ seed から同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectReflectionProblemForDifficulty(difficulty, "seed-a");
      const second = selectReflectionProblemForDifficulty(difficulty, "seed-a");

      expect(second).toEqual(first);
    },
  );

  test.each(difficulties)(
    "レベル %s で異なる seed からそのレベルの問題集の複数の問題を選ぶこと",
    (difficulty) => {
      const poolSeeds = new Set(
        listPooledProblems(difficulty).map(({ identity }) => identity.seed),
      );
      const selectedSeeds = seeds.map(
        (seed) =>
          selectReflectionProblemForDifficulty(difficulty, seed).identity.seed,
      );

      expect(selectedSeeds.every((seed) => poolSeeds.has(seed))).toBe(true);
      expect(new Set(selectedSeeds).size).toBeGreaterThan(1);
    },
  );

  test("選んだ結果に難易度分析を含めず、問題集の位置と基準時間に使う作業の量だけを伴うこと", () => {
    const selected = selectReflectionProblemForDifficulty("1", "seed-a");

    expect(Object.keys(selected).sort()).toEqual([
      "identity",
      "poolReference",
      "problem",
      "workload",
    ]);
  });
});

describe("restoreReflectionProblem", () => {
  const selected = selectReflectionProblemForDifficulty("4", "seed-a");
  const recordedIdentity = structuredClone(selected.identity);

  test("問題集の identity から同じ問題を復元すること", () => {
    const restored = restoreReflectionProblem(recordedIdentity);

    expect(restored).toEqual(selected);
  });

  const unknownIdentities: readonly [
    string,
    ReflectionRecordedProblemIdentity,
  ][] = [
    ["生成器の版が今と違う", { ...selected.identity, generatorVersion: "1" }],
    ["問題集に無い seed", { ...selected.identity, seed: "rf-unknown" }],
    [
      "ピース数が違う",
      {
        ...selected.identity,
        conditions: {
          ...selected.identity.conditions,
          pieceCount: selected.identity.conditions.pieceCount + 1,
        },
      },
    ],
  ];

  test.each(unknownIdentities)(
    "%s identity は復元できないこと",
    (_, identity) => {
      const restored = restoreReflectionProblem(identity);

      expect(restored).toBeNull();
    },
  );
});
