import { difficultyLevels } from "@/games/difficulty";
import {
  assessNanpureDifficulty,
  type NanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { analyzeNanpureDifficulty } from "@/games/nanpure/problem/difficulty-analysis";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import {
  assertNanpureProblem,
  NANPURE_GENERATOR_VERSION,
  type NanpureProblem,
} from "@/games/nanpure/problem/problem";
import {
  listNanpurePoolEntries,
  toNanpurePooledProblem,
} from "@/games/nanpure/problem/problem-pool";
import {
  restoreNanpureProblem,
  selectNanpureProblemForDifficulty,
} from "@/games/nanpure/problem-selection";

const difficulties = difficultyLevels.map(({ id }) => id);

// 全問の分析と再生成は数十秒かかるため、テストでは等間隔に抜き出した問題だけを確かめる。
// 全問の検証は `bun run generate:nanpure-pool -- --verify` で行う。
const analyzedEntryCountPerDifficulty = 30;
const regeneratedEntryCountPerDifficulty = 3;

function listPooledProblems(difficulty: NanpureDifficulty) {
  return listNanpurePoolEntries(difficulty).map(toNanpurePooledProblem);
}

function isValidProblem(problem: NanpureProblem): boolean {
  try {
    assertNanpureProblem(problem);
    return true;
  } catch {
    return false;
  }
}

function sampleEvenly<T>(values: readonly T[], count: number): T[] {
  const step = Math.max(1, Math.floor(values.length / count));
  return values.filter((_, index) => index % step === 0).slice(0, count);
}

describe("問題集", () => {
  test.each(difficulties)(
    "難易度 %s の全問題が、解と食い違わない問題であること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      expect(pooled.length).toBeGreaterThan(0);
      expect(pooled.filter(({ problem }) => !isValidProblem(problem))).toEqual(
        [],
      );
      expect(
        new Set(pooled.map(({ identity }) => identity.generatorVersion)),
      ).toEqual(new Set([NANPURE_GENERATOR_VERSION]));
    },
  );

  test("全難易度を通して同じ問題・同じ identity を含まないこと", () => {
    const pooled = difficulties.flatMap(listPooledProblems);

    const clues = pooled.map(({ problem }) => problem.clues.join());
    const seeds = pooled.map(({ identity }) => identity.seed);
    expect(new Set(clues).size).toBe(pooled.length);
    expect(new Set(seeds).size).toBe(pooled.length);
  });

  test.each(difficulties)(
    "難易度 %s から抜き出した問題が、分析でその難易度に分類されること",
    (difficulty) => {
      const assessments = sampleEvenly(
        listPooledProblems(difficulty),
        analyzedEntryCountPerDifficulty,
      ).map(({ problem }) =>
        assessNanpureDifficulty(analyzeNanpureDifficulty(problem.clues)),
      );

      expect(assessments).toHaveLength(analyzedEntryCountPerDifficulty);
      expect(
        new Set(assessments.map((assessment) => JSON.stringify(assessment))),
      ).toEqual(
        new Set([JSON.stringify({ status: "classified", difficulty })]),
      );
    },
  );

  test.each(difficulties)(
    "難易度 %s から抜き出した問題を、identity から生成し直せること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        regeneratedEntryCountPerDifficulty,
      );

      const regenerated = sampled.map(
        ({ identity }) => generateNanpureProblem(identity).problem,
      );

      expect(regenerated).toEqual(sampled.map(({ problem }) => problem));
    },
  );
});

describe("selectNanpureProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "難易度 %s で同じ seed から同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectNanpureProblemForDifficulty(difficulty, "seed-a");
      const second = selectNanpureProblemForDifficulty(difficulty, "seed-a");

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
          selectNanpureProblemForDifficulty(difficulty, seed).identity.seed,
      );

      expect(selectedSeeds.every((seed) => poolSeeds.has(seed))).toBe(true);
      expect(new Set(selectedSeeds).size).toBeGreaterThan(1);
    },
  );
});

describe("restoreNanpureProblem", () => {
  const selected = selectNanpureProblemForDifficulty("4", "seed-a");
  const recordedIdentity = structuredClone(selected.identity);

  test("問題集の identity から同じ問題を復元すること", () => {
    const restored = restoreNanpureProblem(recordedIdentity);

    expect(restored).toEqual(selected);
  });

  const unknownIdentities = [
    ["生成器の版が今と違う", { ...selected.identity, generatorVersion: "1" }],
    ["問題集に無い seed", { ...selected.identity, seed: "np-unknown" }],
    [
      "生成条件が違う",
      {
        ...selected.identity,
        conditions: { removalTechniqueLimit: "full-house" },
      },
    ],
    [
      "3段階の難易度で記録した identity",
      {
        generatorVersion: "1",
        seed: "legacy-seed",
        conditions: { clueCount: 32 },
        generationAttempt: 1,
      },
    ],
  ] as const;

  test.each(unknownIdentities)(
    "%s identity には null を返すこと",
    (_, identity) => {
      const restored = restoreNanpureProblem(identity);

      expect(restored).toBeNull();
    },
  );
});
