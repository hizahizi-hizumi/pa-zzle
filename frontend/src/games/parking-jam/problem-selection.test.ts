import { difficultyLevels } from "@/games/difficulty";
import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  restoreParkingJamProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  getParkingJamProblemPoolDifficultyModelVersion,
  listParkingJamPoolEntries,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";

const difficulties = difficultyLevels.map(({ id }) => id);

// 全問の分析は1スレッドで数十秒かかるため、テストでは等間隔に抜き出した問題だけを分析する。
// 全問の検証は `bun run generate:parking-jam-pool -- --verify` で行う。
const sampledEntryCountPerDifficulty = 20;

function listPoolIdentities(difficulty: ParkingJamDifficulty) {
  return listParkingJamPoolEntries(difficulty).map((entry) =>
    toParkingJamPoolIdentity(entry),
  );
}

function sampleEvenly<T>(values: readonly T[], count: number): T[] {
  const step = Math.max(1, Math.floor(values.length / count));
  return values.filter((_, index) => index % step === 0);
}

describe("問題集", () => {
  test("現在の難易度判定モデルで分類した問題集であること", () => {
    const modelVersion = getParkingJamProblemPoolDifficultyModelVersion();

    expect(modelVersion).toBe(PARKING_JAM_DIFFICULTY_MODEL_VERSION);
  });

  test.each(difficulties)("レベル %s に1000問あること", (difficulty) => {
    const entries = listParkingJamPoolEntries(difficulty);

    expect(entries).toHaveLength(1000);
  });

  test("全レベルを通して同じ identity の問題を含まないこと", () => {
    const identityKeys = difficulties.flatMap((difficulty) =>
      listPoolIdentities(difficulty).map((identity) =>
        JSON.stringify(identity),
      ),
    );

    expect(new Set(identityKeys).size).toBe(identityKeys.length);
  });

  test.each(difficulties)(
    "レベル %s から抜き出した問題が分析でそのレベルに分類されること",
    (difficulty) => {
      const assessments = sampleEvenly(
        listPoolIdentities(difficulty),
        sampledEntryCountPerDifficulty,
      ).map((identity) =>
        assessParkingJamDifficulty(
          restoreParkingJamProblem(identity).difficultyAnalysis,
        ),
      );

      expect(assessments.length).toBeGreaterThanOrEqual(
        sampledEntryCountPerDifficulty,
      );
      expect(
        new Set(
          assessments.map((assessment) =>
            assessment.status === "classified"
              ? assessment.difficulty
              : assessment.status,
          ),
        ),
      ).toEqual(new Set([difficulty]));
    },
  );
});

describe("selectParkingJamProblemForDifficulty", () => {
  const seeds = Array.from({ length: 10 }, (_, index) => `seed-${index}`);

  test.each(difficulties)(
    "レベル %s で同じseedから同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectParkingJamProblemForDifficulty(difficulty, "seed-a");
      const second = selectParkingJamProblemForDifficulty(difficulty, "seed-a");

      expect(second).toEqual(first);
    },
  );

  test.each(difficulties)(
    "レベル %s で異なるseedから問題集の複数の問題を選ぶこと",
    (difficulty) => {
      const poolIdentityKeys = new Set(
        listPoolIdentities(difficulty).map((identity) =>
          JSON.stringify(identity),
        ),
      );

      const selected = seeds.map((seed) =>
        selectParkingJamProblemForDifficulty(difficulty, seed),
      );

      expect(
        selected.every(({ identity }) =>
          poolIdentityKeys.has(JSON.stringify(identity)),
        ),
      ).toBe(true);
      expect(
        new Set(selected.map(({ identity }) => JSON.stringify(identity))).size,
      ).toBeGreaterThan(1);
    },
  );

  describe("選んだ問題の場合", () => {
    const selected = selectParkingJamProblemForDifficulty("3", "seed-a");

    test("identity から復元した盤面を遊ぶこと", () => {
      const restored = restoreParkingJamProblemWithoutAnalysis(
        selected.identity,
      );

      expect(selected.problem).toEqual(restored.problem);
    });

    test("可解性と難易度の解析を含めないこと", () => {
      const properties = Object.keys(selected);

      expect(properties).toEqual(["problem", "identity"]);
    });
  });
});
