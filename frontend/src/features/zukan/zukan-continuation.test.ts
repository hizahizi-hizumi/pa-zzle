import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import { PLAY_SCORE_METRIC_ID } from "@/features/records/play-record-definition";
import type { ZukanPlaySource } from "@/features/zukan/zukan-collection";
import { createZukanContinuations } from "@/features/zukan/zukan-continuation";

type RecordedProblem = { difficulty: string; problemId: string };

/** 問題 ID が `p-` で始まる問題だけを、今の問題集で引ける問題とする。 */
function toTarget({ difficulty, problemId }: RecordedProblem) {
  return problemId.startsWith("p-") ? { difficulty, problemId } : null;
}

function createGame(id: string): ZukanPlaySource {
  return {
    id,
    recordProblemPlayTarget: vi.fn((record: PlayRecord) =>
      toTarget(record.payload as RecordedProblem),
    ),
    attemptProblemPlayTarget: vi.fn(({ start }: PlayAttempt) =>
      toTarget({
        difficulty: start.difficulty,
        problemId: String(start.problemIdentity.problemId),
      }),
    ),
    playRecordDefinition: {
      gameId: id,
      isRecord(record) {
        return record.gameId === id;
      },
      getComparisonKey(record) {
        return (record.payload as RecordedProblem).difficulty;
      },
      personalBestMetrics: [
        {
          id: PLAY_SCORE_METRIC_ID,
          direction: "higher",
          getValue() {
            return 90;
          },
        },
      ],
      getClearPerformance() {
        return { elapsedMs: 60_000 };
      },
    },
  };
}

function createRecord(
  gameId: string,
  completedAt: number,
  problem: RecordedProblem,
): PlayRecord {
  return {
    id: `${gameId}-${completedAt}`,
    gameId,
    startedAt: completedAt - 1_000,
    completedAt,
    payloadVersion: 1,
    payload: problem,
  };
}

function createAbandonedAttempt(
  gameId: string,
  abandonedAt: number,
  { difficulty, problemId }: RecordedProblem,
): PlayAttempt {
  return {
    gameId,
    startedAt: abandonedAt - 1_000,
    start: { difficulty, problemIdentity: { problemId } },
    abandonment: { abandonedAt, progress: {} },
  };
}

describe("createZukanContinuations", () => {
  describe("記録も試行も無い場合", () => {
    const games = [createGame("first"), createGame("second")];
    const continuations = createZukanContinuations(games, [], []);

    test("最後に遊んだゲームを無しとすること", () => {
      const gameId = continuations.findLatestPlayedGameId();

      expect(gameId).toBeNull();
    });

    test("どのゲームの続きも無しとすること", () => {
      const found = games.map(({ id }) => continuations.find(id));

      expect(found).toEqual([null, null]);
    });
  });

  describe("いくつかのゲームを遊んだ場合", () => {
    let games: ZukanPlaySource[];
    let first: ZukanPlaySource;
    let second: ZukanPlaySource;
    let third: ZukanPlaySource;
    const records = [
      createRecord("first", 5_000, { difficulty: "2", problemId: "p-a" }),
      createRecord("second", 3_000, { difficulty: "1", problemId: "p-b" }),
      createRecord("third", 1_000, { difficulty: "5", problemId: "p-c" }),
      // 今の問題集で引けないので、最も新しくても図鑑には使わない。
      createRecord("second", 9_000, { difficulty: "4", problemId: "gone" }),
    ];
    const attempts = [
      createAbandonedAttempt("first", 4_000, {
        difficulty: "2",
        problemId: "p-d",
      }),
    ];

    beforeEach(() => {
      first = createGame("first");
      second = createGame("second");
      third = createGame("third");
      games = [first, second, third];
    });

    test("図鑑に使える履歴のうち、最も新しくクリアまたは離脱したプレイのゲームを最後に遊んだゲームとすること", () => {
      const continuations = createZukanContinuations(games, records, attempts);

      const gameId = continuations.findLatestPlayedGameId();

      expect(gameId).toBe("first");
    });

    test("最後に遊んだゲームを求めるとき、それより古い履歴しか無いゲームの続きは求めないこと", () => {
      const continuations = createZukanContinuations(games, records, attempts);

      continuations.findLatestPlayedGameId();

      expect(third.recordProblemPlayTarget).not.toHaveBeenCalled();
    });

    test("ゲームごとの続きを返し、同じゲームの続きは一度だけ求めること", () => {
      const continuations = createZukanContinuations(games, records, attempts);

      const found = [
        continuations.find("first"),
        continuations.find("second"),
        continuations.find("first"),
      ];

      expect(found).toEqual([
        { difficulty: "2", playedAt: 5_000, attemptedCount: 1 },
        { difficulty: "1", playedAt: 3_000, attemptedCount: 0 },
        { difficulty: "2", playedAt: 5_000, attemptedCount: 1 },
      ]);
      expect(first.recordProblemPlayTarget).toHaveBeenCalledOnce();
    });

    test("知らないゲームの続きを無しとすること", () => {
      const continuations = createZukanContinuations(games, records, attempts);

      const continuation = continuations.find("unknown");

      expect(continuation).toBeNull();
    });
  });
});
