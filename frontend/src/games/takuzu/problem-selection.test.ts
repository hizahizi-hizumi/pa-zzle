import {
  assessTakuzuDifficulty,
  type TakuzuDifficulty,
  takuzuDifficulties,
} from "@/games/takuzu/difficulty";
import { analyzeTakuzuDifficulty } from "@/games/takuzu/problem/difficulty-analysis";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import {
  assertTakuzuProblem,
  TAKUZU_GENERATOR_VERSION,
  type TakuzuProblem,
  type TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import {
  listTakuzuPoolEntries,
  toTakuzuPooledProblem,
} from "@/games/takuzu/problem/problem-pool";
import {
  restoreTakuzuProblem,
  selectTakuzuProblemForDifficulty,
} from "@/games/takuzu/problem-selection";

const difficulties = takuzuDifficulties.map(({ id }) => id);

// 全問の分析と再生成は数十秒かかるため、テストでは等間隔に抜き出した問題だけを確かめる。
// 全問の検証は `bun run generate:takuzu-pool -- --verify` で行う。
const analyzedEntryCountPerDifficulty = 40;
const regeneratedEntryCountPerDifficulty = 4;

function listPooledProblems(difficulty: TakuzuDifficulty) {
  return listTakuzuPoolEntries(difficulty).map(toTakuzuPooledProblem);
}

function isValidProblem(problem: TakuzuProblem): boolean {
  try {
    assertTakuzuProblem(problem);
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
    "難易度 %s の全問題が、解と食い違わない 8×8 の問題であること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      expect(pooled.length).toBeGreaterThan(0);
      expect(pooled.filter(({ problem }) => !isValidProblem(problem))).toEqual(
        [],
      );
      expect(new Set(pooled.map(({ problem }) => problem.givens.size))).toEqual(
        new Set([8]),
      );
      expect(
        new Set(pooled.map(({ identity }) => identity.generatorVersion)),
      ).toEqual(new Set([TAKUZU_GENERATOR_VERSION]));
    },
  );

  test("全難易度を通して同じ問題・同じ identity を含まないこと", () => {
    const pooled = difficulties.flatMap(listPooledProblems);

    const givens = pooled.map(({ problem }) => problem.givens.cells.join());
    const seeds = pooled.map(({ identity }) => identity.seed);
    expect(new Set(givens).size).toBe(pooled.length);
    expect(new Set(seeds).size).toBe(pooled.length);
  });

  test.each(difficulties)(
    "難易度 %s から抜き出した問題が、分析でその難易度に分類されること",
    (difficulty) => {
      const assessments = sampleEvenly(
        listPooledProblems(difficulty),
        analyzedEntryCountPerDifficulty,
      ).map(({ problem }) =>
        assessTakuzuDifficulty(analyzeTakuzuDifficulty(problem)),
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
    "難易度 %s から抜き出した問題の作業の量が、分析の結果と一致すること",
    (difficulty) => {
      const sampled = sampleEvenly(
        listPooledProblems(difficulty),
        analyzedEntryCountPerDifficulty,
      );

      const analyzedWorkloads = sampled.map(({ problem }) => {
        const analysis = analyzeTakuzuDifficulty(problem);
        if (analysis.status !== "analyzed") {
          return null;
        }
        return {
          emptyCellCount: analysis.scale.emptyCellCount,
          roundCount: analysis.features.roundCount,
          lineReadingRoundCount: analysis.features.lineReadingRoundCount,
        };
      });

      expect(analyzedWorkloads).toEqual(
        sampled.map(({ workload }) => workload),
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
        ({ identity }) => generateTakuzuProblem(identity).problem,
      );

      expect(regenerated).toEqual(sampled.map(({ problem }) => problem));
    },
  );
});

describe("selectTakuzuProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "難易度 %s で同じ seed から同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectTakuzuProblemForDifficulty(difficulty, "seed-a");
      const second = selectTakuzuProblemForDifficulty(difficulty, "seed-a");

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
          selectTakuzuProblemForDifficulty(difficulty, seed).identity.seed,
      );

      expect(selectedSeeds.every((seed) => poolSeeds.has(seed))).toBe(true);
      expect(new Set(selectedSeeds).size).toBeGreaterThan(1);
    },
  );

  test("選んだ結果に難易度分析を含めず、基準時間に使う作業の量だけを伴うこと", () => {
    const selected = selectTakuzuProblemForDifficulty("1", "seed-a");

    expect(Object.keys(selected).sort()).toEqual([
      "identity",
      "problem",
      "workload",
    ]);
  });
});

describe("restoreTakuzuProblem", () => {
  const selected = selectTakuzuProblemForDifficulty("4", "seed-a");

  const recordedIdentity = structuredClone(selected.identity);

  test("問題集の identity から同じ問題を復元すること", () => {
    const restored = restoreTakuzuProblem(recordedIdentity);

    expect(restored).toEqual(selected);
  });

  const unknownIdentities: readonly [string, TakuzuProblemIdentity][] = [
    [
      "生成器の版が違う",
      {
        ...selected.identity,
        generatorVersion: "0" as TakuzuProblemIdentity["generatorVersion"],
      },
    ],
    ["問題集に無い seed", { ...selected.identity, seed: "tk-unknown" }],
    [
      "生成条件が違う",
      {
        ...selected.identity,
        conditions: {
          ...selected.identity.conditions,
          extraGivenCount: selected.identity.conditions.extraGivenCount + 1,
        },
      },
    ],
  ];

  test.each(unknownIdentities)(
    "%s identity は復元できないこと",
    (_, identity) => {
      const restored = restoreTakuzuProblem(identity);

      expect(restored).toBeNull();
    },
  );
});
