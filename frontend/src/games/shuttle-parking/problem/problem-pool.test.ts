import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import {
  assessShuttleParkingDifficulty,
  SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
} from "@/games/shuttle-parking/difficulty";
import { analyzeShuttleParkingDifficulty } from "@/games/shuttle-parking/problem/difficulty-analysis";
import {
  createShuttleParkingProblemSeed,
  restoreShuttleParkingProblem,
} from "@/games/shuttle-parking/problem/problem";
import {
  decodeShuttleParkingPoolEntry,
  findShuttleParkingPoolEntryByProblemId,
  getShuttleParkingPoolDifficultyModelVersion,
  listShuttleParkingPoolEntries,
  listShuttleParkingPoolProblemIds,
  restoreShuttleParkingPoolEntry,
} from "@/games/shuttle-parking/problem/problem-pool";
import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import { createShuttleParkingInitialState } from "@/games/shuttle-parking/puzzle/rules";

const SHUTTLE_PARKING_POOL_SIZE = 500;
const ANALYSIS_SAMPLE_STEP = 25;

describe.each(difficultyLevels.map(({ id }) => id))(
  "レベル %s の問題集の場合",
  (difficulty) => {
    const entries = listShuttleParkingPoolEntries(difficulty);

    test("500問あること", () => {
      expect(entries).toHaveLength(SHUTTLE_PARKING_POOL_SIZE);
    });

    // 全問の分析し直しは generate:shuttle-parking-pool -- --verify で行う。ここでは間引いた問題だけを確かめる。
    test.each(
      entries
        .filter((_, index) => index % ANALYSIS_SAMPLE_STEP === 0)
        .map((entry) => ({ seed: entry[0], entry })),
    )("$seed を分析し直すと同じレベルと罠の重さになること", ({ entry }) => {
      const { problem, trapWeight } = restoreShuttleParkingPoolEntry(entry);

      const analysis = analyzeShuttleParkingDifficulty(problem);
      const assessment = assessShuttleParkingDifficulty(analysis);

      expect(assessment).toEqual({ status: "classified", difficulty });
      expect(
        analysis.status === "analyzed"
          ? analysis.features.headFirst.best.minimum
          : null,
      ).toBe(trapWeight);
    });

    test.each(entries.map((entry) => ({ seed: entry[0], entry })))(
      "$seed は復元でき、全員を送り出せること",
      ({ seed, entry }) => {
        const { problem } = restoreShuttleParkingProblem(
          decodeShuttleParkingPoolEntry(entry),
        );

        const clearable = createShuttleParkingClearability(problem).canClear(
          createShuttleParkingInitialState(problem),
        );

        expect(createShuttleParkingProblemSeed(problem)).toBe(seed);
        expect(clearable).toBe(true);
      },
    );

    test("並び順の問題IDでその問題を引けること", () => {
      const problemIds = listShuttleParkingPoolProblemIds(difficulty);

      const found = problemIds.map((problemId) =>
        findShuttleParkingPoolEntryByProblemId(difficulty, problemId),
      );

      expect(found).toEqual(entries);
      expect(problemIds).toEqual(
        entries.map((entry) =>
          createProblemId(decodeShuttleParkingPoolEntry(entry)),
        ),
      );
    });
  },
);

describe("getShuttleParkingPoolDifficultyModelVersion", () => {
  test("問題集が今の判定モデルの版で作られていること", () => {
    expect(getShuttleParkingPoolDifficultyModelVersion()).toBe(
      SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
    );
  });
});

describe("findShuttleParkingPoolEntryByProblemId", () => {
  const [problemId] = listShuttleParkingPoolProblemIds("1");

  test("別のレベルの問題IDには null を返すこと", () => {
    const found = findShuttleParkingPoolEntryByProblemId("2", problemId!);

    expect(found).toBeNull();
  });
});
