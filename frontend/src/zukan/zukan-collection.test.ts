import type { DifficultyLevel } from "@/games/difficulty";
import type { PlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import { PLAY_SCORE_METRIC_ID } from "@/records/play-record-definition";
import {
  countZukanProblemsByStatus,
  deriveGameZukan,
  getZukanProblemStatus,
  type ZukanGameSource,
  type ZukanProblem,
} from "@/zukan/zukan-collection";

type RecordedProblem = { difficulty: string; problemId: string };
type RecordedPayload = RecordedProblem & {
  score: number | null;
  elapsedMs?: number;
  completionMoveCount?: number;
  mistakeCount?: number;
};

const OPTIMAL_MOVE_COUNT = 10;

function readPayload(record: PlayRecord): RecordedPayload {
  return record.payload as RecordedPayload;
}

const poolProblemIds: Record<DifficultyLevel, readonly string[]> = {
  "1": ["p-a", "p-b"],
  "2": ["p-c"],
  "3": [],
  "4": ["p-d", "p-e"],
  "5": [],
};

function toTarget(problem: RecordedProblem | null) {
  const difficulty = problem?.difficulty as DifficultyLevel | undefined;
  return problem !== null &&
    difficulty !== undefined &&
    poolProblemIds[difficulty]?.includes(problem.problemId)
    ? { difficulty: problem.difficulty, problemId: problem.problemId }
    : null;
}

const game: ZukanGameSource = {
  id: "game",
  listPoolProblemIds(difficulty) {
    return poolProblemIds[difficulty];
  },
  recordProblemPlayTarget(record) {
    return toTarget(readPayload(record));
  },
  attemptProblemPlayTarget({ start }) {
    return toTarget({
      difficulty: start.difficulty,
      problemId: String(start.problemIdentity.problemId),
    });
  },
  playRecordDefinition: {
    gameId: "game",
    isRecord(record) {
      return record.gameId === "game";
    },
    getComparisonKey(record) {
      return readPayload(record).difficulty;
    },
    personalBestMetrics: [
      {
        id: PLAY_SCORE_METRIC_ID,
        direction: "higher",
        getValue(record) {
          return readPayload(record).score;
        },
      },
    ],
    getClearPerformance(record) {
      const {
        elapsedMs = 60_000,
        completionMoveCount,
        mistakeCount,
      } = readPayload(record);
      return {
        elapsedMs,
        ...(completionMoveCount === undefined
          ? {}
          : {
              moves: {
                completionMoveCount,
                optimalMoveCount: OPTIMAL_MOVE_COUNT,
              },
            }),
        ...(mistakeCount === undefined ? {} : { mistakeCount }),
      };
    },
  },
};

function createRecord(
  completedAt: number,
  payload: RecordedPayload,
  gameId = "game",
): PlayRecord {
  return {
    id: `record-${completedAt}`,
    gameId,
    startedAt: completedAt - 1_000,
    completedAt,
    payloadVersion: 1,
    payload,
  };
}

function createAbandonedAttempt(
  abandonedAt: number,
  { difficulty, problemId }: RecordedProblem,
  gameId = "game",
): PlayAttempt {
  return {
    gameId,
    startedAt: abandonedAt - 1_000,
    start: { difficulty, problemIdentity: { problemId } },
    abandonment: { abandonedAt, progress: {} },
  };
}

describe("deriveGameZukan", () => {
  describe("記録も試行も無い場合", () => {
    test("問題集の全問を、難易度の昇順・問題集の並び順に通しの番号を付けた空き枠で返すこと", () => {
      const zukan = deriveGameZukan(game, [], []);

      expect(zukan.sections.map(({ problems }) => problems)).toEqual([
        [
          {
            kind: "unsolved",
            number: 1,
            difficulty: "1",
            problemId: "p-a",
            attempted: false,
          },
          {
            kind: "unsolved",
            number: 2,
            difficulty: "1",
            problemId: "p-b",
            attempted: false,
          },
        ],
        [
          {
            kind: "unsolved",
            number: 3,
            difficulty: "2",
            problemId: "p-c",
            attempted: false,
          },
        ],
        [],
        [
          {
            kind: "unsolved",
            number: 4,
            difficulty: "4",
            problemId: "p-d",
            attempted: false,
          },
          {
            kind: "unsolved",
            number: 5,
            difficulty: "4",
            problemId: "p-e",
            attempted: false,
          },
        ],
        [],
      ]);
    });

    test("全問の数を数え、解いた問題を0問とすること", () => {
      const { problemCount, solvedCount } = deriveGameZukan(game, [], []);

      expect({ problemCount, solvedCount }).toEqual({
        problemCount: 5,
        solvedCount: 0,
      });
    });
  });

  describe("同じ問題を複数回クリアした記録がある場合", () => {
    const records = [
      createRecord(5_000, {
        difficulty: "4",
        problemId: "p-e",
        score: 70,
        elapsedMs: 90_000,
      }),
      createRecord(9_000, {
        difficulty: "1",
        problemId: "p-b",
        score: 100,
        elapsedMs: 80_000,
        completionMoveCount: 12,
        mistakeCount: 0,
      }),
      createRecord(3_000, {
        difficulty: "1",
        problemId: "p-b",
        score: 85,
        elapsedMs: 60_000,
        completionMoveCount: 14,
        mistakeCount: 2,
      }),
      createRecord(7_000, {
        difficulty: "1",
        problemId: "p-b",
        score: 60,
        elapsedMs: 120_000,
        completionMoveCount: 11,
        mistakeCount: 1,
      }),
    ];

    test("問題ごとに、最高スコア・最速タイム・最少手数と最短手数・最少ミス・初めてクリアした時刻をそれぞれ別の記録からでもまとめ、問題集の番号のまま返すこと", () => {
      const zukan = deriveGameZukan(game, records, []);

      expect(
        zukan.sections
          .flatMap(({ problems }) => problems)
          .filter(({ kind }) => kind === "solved"),
      ).toEqual([
        {
          kind: "solved",
          number: 2,
          difficulty: "1",
          problemId: "p-b",
          bestScore: 100,
          fastestElapsedMs: 60_000,
          fewestMoves: { completionMoveCount: 11, optimalMoveCount: 10 },
          fewestMistakes: 0,
          firstClearedAt: 3_000,
        },
        {
          kind: "solved",
          number: 5,
          difficulty: "4",
          problemId: "p-e",
          bestScore: 70,
          fastestElapsedMs: 90_000,
          fewestMoves: null,
          fewestMistakes: null,
          firstClearedAt: 5_000,
        },
      ]);
    });

    test("難易度ごとと全体の解いた問題の数を数えること", () => {
      const zukan = deriveGameZukan(game, records, []);

      expect({
        sectionSolvedCounts: zukan.sections.map(
          ({ solvedCount }) => solvedCount,
        ),
        solvedCount: zukan.solvedCount,
      }).toEqual({
        sectionSolvedCounts: [1, 0, 0, 1, 0],
        solvedCount: 2,
      });
    });
  });

  describe("使えない記録がある場合", () => {
    const records = [
      createRecord(
        1_000,
        { difficulty: "1", problemId: "p-a", score: 90 },
        "other",
      ),
      createRecord(2_000, { difficulty: "1", problemId: "gone", score: 90 }),
      createRecord(3_000, { difficulty: "easy", problemId: "p-a", score: 90 }),
      createRecord(4_000, { difficulty: "1", problemId: "p-a", score: null }),
      createRecord(5_000, { difficulty: "2", problemId: "p-c", score: 80 }),
    ];

    test("別のゲーム・今の問題集で引けない・評価点を求められない記録を数えないこと", () => {
      const zukan = deriveGameZukan(game, records, []);

      expect(
        zukan.sections
          .flatMap(({ problems }) => problems)
          .filter(({ kind }) => kind === "solved")
          .map(({ problemId }) => problemId),
      ).toEqual(["p-c"]);
    });
  });

  describe("離脱した試行がある場合", () => {
    const records = [
      createRecord(5_000, { difficulty: "1", problemId: "p-a", score: 90 }),
    ];
    const attempts = [
      createAbandonedAttempt(2_000, { difficulty: "1", problemId: "p-a" }),
      createAbandonedAttempt(3_000, { difficulty: "2", problemId: "p-c" }),
      createAbandonedAttempt(8_000, { difficulty: "4", problemId: "p-d" }),
      createAbandonedAttempt(7_000, { difficulty: "4", problemId: "gone" }),
      createAbandonedAttempt(
        9_000,
        { difficulty: "1", problemId: "p-b" },
        "other",
      ),
    ];

    test("まだクリアしていない問題のうち、離脱したことがある問題だけを挑戦中にすること", () => {
      const zukan = deriveGameZukan(game, records, attempts);

      expect(
        zukan.sections
          .flatMap(({ problems }) => problems)
          .map((problem) =>
            problem.kind === "solved"
              ? [problem.problemId, "solved"]
              : [problem.problemId, problem.attempted],
          ),
      ).toEqual([
        ["p-a", "solved"],
        ["p-b", false],
        ["p-c", true],
        ["p-d", true],
        ["p-e", false],
      ]);
    });
  });
  describe("最後に遊んだレベル", () => {
    test("記録も試行も無ければ、無しとすること", () => {
      const { latestPlayedDifficulty } = deriveGameZukan(game, [], []);

      expect(latestPlayedDifficulty).toBeNull();
    });

    test("クリアと離脱のうち、最も新しくクリアまたは離脱したプレイのレベルとすること", () => {
      const records = [
        createRecord(5_000, { difficulty: "1", problemId: "p-a", score: 90 }),
        createRecord(3_000, { difficulty: "4", problemId: "p-d", score: 80 }),
      ];
      const attempts = [
        createAbandonedAttempt(7_000, { difficulty: "2", problemId: "p-c" }),
        createAbandonedAttempt(4_000, { difficulty: "4", problemId: "p-e" }),
      ];

      const { latestPlayedDifficulty } = deriveGameZukan(
        game,
        records,
        attempts,
      );

      expect(latestPlayedDifficulty).toBe("2");
    });

    test("図鑑に使わない記録と試行のレベルにはしないこと", () => {
      const records = [
        createRecord(3_000, { difficulty: "1", problemId: "p-a", score: 90 }),
        createRecord(
          9_000,
          { difficulty: "2", problemId: "p-c", score: 90 },
          "other",
        ),
        createRecord(8_000, { difficulty: "4", problemId: "gone", score: 90 }),
      ];
      const attempts = [
        createAbandonedAttempt(7_000, { difficulty: "4", problemId: "gone" }),
      ];

      const { latestPlayedDifficulty } = deriveGameZukan(
        game,
        records,
        attempts,
      );

      expect(latestPlayedDifficulty).toBe("1");
    });
  });
});

describe("getZukanProblemStatus", () => {
  const solvedProblem = {
    kind: "solved",
    number: 1,
    difficulty: "1",
    problemId: "p-a",
    fastestElapsedMs: 60_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstClearedAt: 1_000,
  } as const;
  const unsolvedProblem = {
    kind: "unsolved",
    number: 2,
    difficulty: "1",
    problemId: "p-b",
  } as const;
  const cases: readonly [string, ZukanProblem, string][] = [
    ["100点", { ...solvedProblem, bestScore: 100 }, "perfect"],
    ["90点", { ...solvedProblem, bestScore: 90 }, "great"],
    ["80点", { ...solvedProblem, bestScore: 80 }, "good"],
    ["79点", { ...solvedProblem, bestScore: 79 }, "clear"],
    ["離脱した", { ...unsolvedProblem, attempted: true }, "attempted"],
    ["手を付けていない", { ...unsolvedProblem, attempted: false }, "untouched"],
  ];

  test.each(cases)("%sの問題を %s の状態とすること", (_, problem, expected) => {
    const status = getZukanProblemStatus(problem);

    expect(status).toBe(expected);
  });
});

describe("countZukanProblemsByStatus", () => {
  const problems = deriveGameZukan(
    game,
    [
      createRecord(1_000, { difficulty: "4", problemId: "p-d", score: 85 }),
      createRecord(2_000, { difficulty: "4", problemId: "p-d", score: 100 }),
      createRecord(3_000, { difficulty: "4", problemId: "p-e", score: 50 }),
    ],
    [createAbandonedAttempt(4_000, { difficulty: "1", problemId: "p-a" })],
  ).sections.flatMap((section) => section.problems);

  test("問題を状態ごとに数え、問題の無い状態を0とすること", () => {
    const counts = countZukanProblemsByStatus(problems);

    expect(counts).toEqual({
      perfect: 1,
      great: 0,
      good: 0,
      clear: 1,
      attempted: 1,
      untouched: 2,
    });
  });

  test("状態の求め方を渡すと、その状態で数えること", () => {
    const counts = countZukanProblemsByStatus(problems, () => "untouched");

    expect(counts).toEqual({
      perfect: 0,
      great: 0,
      good: 0,
      clear: 0,
      attempted: 0,
      untouched: 5,
    });
  });
});
