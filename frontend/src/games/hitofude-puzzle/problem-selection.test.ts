import { difficultyLevels, isInNumericRange } from "@/games/difficulty";
import {
  assessHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficulty,
  hitofudePuzzleLevelCombinations,
} from "@/games/hitofude-puzzle/difficulty";
import {
  analyzeHitofudePuzzleDifficulty,
  getHitofudePuzzleSolveWorkload,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { countHitofudePuzzleHoleLayoutViolations } from "@/games/hitofude-puzzle/problem/generation/hole-layout";
import { measureHitofudePuzzleLookaheadLoad } from "@/games/hitofude-puzzle/problem/generation/human-solver";
import { getHitofudePuzzleSymmetryKey } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import {
  HITOFUDE_PUZZLE_GENERATOR_VERSION,
  type HitofudePuzzleRecordedProblemIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  listHitofudePuzzlePoolEntries,
  toHitofudePuzzlePooledProblem,
} from "@/games/hitofude-puzzle/problem/problem-pool";
import {
  canSelectHitofudePuzzleProblemById,
  restoreHitofudePuzzleProblem,
  selectHitofudePuzzleProblemById,
  selectHitofudePuzzleProblemForDifficulty,
} from "@/games/hitofude-puzzle/problem-selection";
import { createProblemId } from "@/games/problem-id";

const difficulties = difficultyLevels.map(({ id }) => id);

// 全問の分析は数分、難しさへ歩く条件の問題の生成し直しは1問に数秒〜数十秒かかるため、テストでは等間隔に抜き出した問題の
// 分析と、穴の焼きなましだけで作る条件の問題の生成し直しを確かめる。全問の検証は `bun run generate:hitofude-puzzle-pool -- --verify` で行う。
const analyzedEntryCountPerDifficulty = 8;
const regeneratedEntryCountPerDifficulty = 2;

function listPooledProblems(difficulty: HitofudePuzzleDifficulty) {
  return listHitofudePuzzlePoolEntries(difficulty).map(
    toHitofudePuzzlePooledProblem,
  );
}

function sampleEvenly<T>(values: readonly T[], count: number): T[] {
  const step = Math.max(1, Math.floor(values.length / count));
  return values.filter((_, index) => index % step === 0).slice(0, count);
}

describe("問題集", () => {
  test.each(difficulties)(
    "難易度 %s の全問題が、今の生成器の identity と盤面サイズの食い違わない問題であること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      expect(pooled.length).toBeGreaterThan(0);
      expect(
        pooled.filter(
          ({ problem, identity }) =>
            identity.generatorVersion !== HITOFUDE_PUZZLE_GENERATOR_VERSION ||
            problem.size !== identity.conditions.size,
        ),
      ).toEqual([]);
    },
  );

  test.each(difficulties)(
    "難易度 %s の全問題の盤面サイズと作業の量が、その難易度の組み合わせに収まること",
    (difficulty) => {
      const combination = hitofudePuzzleLevelCombinations[difficulty];

      const outOfCombination = listPooledProblems(difficulty).filter(
        ({ problem, workload }) =>
          !isInNumericRange(problem.size, combination.boardSize) ||
          !isInNumericRange(
            measureHitofudePuzzleLookaheadLoad(
              workload.assumptionCount,
              workload.longestRefutationLength,
            ),
            combination.lookaheadLoad,
          ) ||
          workload.fatalBranchCount === 0,
      );

      expect(outOfCombination).toEqual([]);
    },
  );

  test.each(difficulties)(
    "難易度 %s の全問題の穴が見た目の基準を満たすこと",
    (difficulty) => {
      const violating = listPooledProblems(difficulty).filter(
        ({ problem }) => countHitofudePuzzleHoleLayoutViolations(problem) > 0,
      );

      expect(violating).toEqual([]);
    },
  );

  test("全難易度を通して同型の問題・同じ identity を含まないこと", () => {
    const pooled = difficulties.flatMap(listPooledProblems);

    const keys = pooled.map(({ problem }) =>
      getHitofudePuzzleSymmetryKey(problem),
    );
    const seeds = pooled.map(({ identity }) => identity.seed);
    expect(new Set(keys).size).toBe(pooled.length);
    expect(new Set(seeds).size).toBe(pooled.length);
  });

  test.each(difficulties)(
    "難易度 %s から抜き出した問題が、分析でその難易度に分類され、作業の量が分析と一致すること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        analyzedEntryCountPerDifficulty,
      );

      const analyzed = sampled.map(({ problem }) => {
        const analysis = analyzeHitofudePuzzleDifficulty(problem);
        const assessment = assessHitofudePuzzleDifficulty(analysis);
        return {
          difficulty:
            assessment.status === "classified" ? assessment.difficulty : null,
          workload:
            analysis.status === "analyzed"
              ? getHitofudePuzzleSolveWorkload(analysis)
              : null,
        };
      });

      expect(analyzed).toEqual(
        sampled.map(({ workload }) => ({ difficulty, workload })),
      );
    },
    30_000,
  );

  const annealedOnlyDifficulties = difficulties.filter((difficulty) =>
    listPooledProblems(difficulty).some(
      ({ identity }) => identity.conditions.targetLookaheadLoad === 0,
    ),
  );

  test.each(annealedOnlyDifficulties)(
    "難易度 %s から抜き出した、難しさへ歩かない条件の問題を、identity から生成し直せること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty).filter(
          ({ identity }) => identity.conditions.targetLookaheadLoad === 0,
        ),
        regeneratedEntryCountPerDifficulty,
      );

      const regenerated = sampled.map(
        ({ identity }) => generateHitofudePuzzleProblem(identity).problem,
      );

      expect(regenerated).toEqual(sampled.map(({ problem }) => problem));
    },
    60_000,
  );
});

describe("selectHitofudePuzzleProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "難易度 %s で同じ seed から同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectHitofudePuzzleProblemForDifficulty(
        difficulty,
        "seed-a",
      );
      const second = selectHitofudePuzzleProblemForDifficulty(
        difficulty,
        "seed-a",
      );

      expect(second).toEqual(first);
    },
  );

  test.each(difficulties)(
    "難易度 %s で異なる seed からその難易度の問題集の複数の問題を選ぶこと",
    (difficulty) => {
      const poolSeeds = new Set(
        listPooledProblems(difficulty).map(({ identity }) => identity.seed),
      );

      const selectedSeeds = seeds.map(
        (seed) =>
          selectHitofudePuzzleProblemForDifficulty(difficulty, seed).identity
            .seed,
      );

      expect(selectedSeeds.every((seed) => poolSeeds.has(seed))).toBe(true);
      expect(new Set(selectedSeeds).size).toBeGreaterThan(1);
    },
  );

  test("選んだ結果に解の道と難易度分析を含めず、基準時間に使う作業の量だけを伴うこと", () => {
    const selected = selectHitofudePuzzleProblemForDifficulty("1", "seed-a");

    expect(Object.keys(selected).sort()).toEqual([
      "identity",
      "problem",
      "workload",
    ]);
  });
});

describe("restoreHitofudePuzzleProblem", () => {
  const selected = selectHitofudePuzzleProblemForDifficulty("4", "seed-a");
  const recordedIdentity = structuredClone(selected.identity);

  test("問題集の identity から同じ問題を復元すること", () => {
    const restored = restoreHitofudePuzzleProblem(recordedIdentity);

    expect(restored).toEqual(selected);
  });

  const unknownIdentities: readonly [
    string,
    HitofudePuzzleRecordedProblemIdentity,
  ][] = [
    ["生成器の版が今と違う", { ...selected.identity, generatorVersion: "0" }],
    ["問題集に無い seed の", { ...selected.identity, seed: "hp-8-0-999999" }],
  ];

  test.each(unknownIdentities)(
    "%s identity は復元できないこと",
    (_, identity) => {
      const restored = restoreHitofudePuzzleProblem(identity);

      expect(restored).toBeNull();
    },
  );
});

describe("selectHitofudePuzzleProblemById", () => {
  const selected = selectHitofudePuzzleProblemForDifficulty("2", "by-id");
  const problemId = createProblemId(selected.identity);

  test("問題 ID の問題を問題集から引くこと", () => {
    const result = selectHitofudePuzzleProblemById("2", problemId);

    expect(result).toEqual(selected);
  });

  const unknownCases = [
    ["別の難易度の問題 ID", "4", problemId],
    ["問題集に無い問題 ID", "2", "0000000000"],
  ] as const;

  test.each(unknownCases)("%sには null を返すこと", (_, difficulty, id) => {
    const result = selectHitofudePuzzleProblemById(difficulty, id);

    expect(result).toBeNull();
  });
});

describe("canSelectHitofudePuzzleProblemById", () => {
  const selected = selectHitofudePuzzleProblemForDifficulty("5", "by-id");
  const problemId = createProblemId(selected.identity);

  const cases = [
    ["その難易度の問題集にある問題 ID", "5", problemId, true],
    ["別の難易度の問題 ID", "3", problemId, false],
    ["問題集に無い問題 ID", "5", "0000000000", false],
  ] as const;

  test.each(cases)("%sを引けるかを返すこと", (_, difficulty, id, expected) => {
    const result = canSelectHitofudePuzzleProblemById(difficulty, id);

    expect(result).toBe(expected);
  });
});
