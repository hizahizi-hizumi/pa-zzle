import {
  type CollectionSource,
  createCollectionJourney,
} from "@/features/collection/collection";
import type { PlayRecord } from "@/features/records/play-record";
import {
  deriveGameZukan,
  type ZukanGameSource,
} from "@/features/zukan/zukan-collection";

const alpha: CollectionSource = {
  id: "alpha",
  recordProblemPlayTarget(record) {
    const payload = record.payload as {
      difficulty: string;
      problem: string;
      retired?: boolean;
    };
    return payload.retired
      ? null
      : { difficulty: payload.difficulty, problemId: payload.problem };
  },
  playRecordDefinition: {
    gameId: "alpha",
    isRecord: (record) => record.gameId === "alpha",
    getComparisonKey: () => null,
    personalBestMetrics: [
      {
        id: "play-score",
        direction: "higher",
        getValue: (record) => (record.payload as { score: number }).score,
      },
    ],
    getClearPerformance(record) {
      const score = (record.payload as { score: number }).score;
      return Number.isFinite(score) ? { elapsedMs: 1000 } : null;
    },
  },
};

const zukanAlpha: ZukanGameSource = {
  ...alpha,
  listPoolProblemIds(difficulty) {
    return difficulty === "1" ? ["a"] : difficulty === "2" ? ["b"] : [];
  },
  attemptProblemPlayTarget() {
    return null;
  },
};
const now = new Date(2026, 3, 7);
const jan = new Date(2026, 0, 10).getTime();
const feb = new Date(2026, 1, 12).getTime();
const mar = new Date(2026, 2, 14).getTime();
function record(
  gameId: string,
  problem: string,
  score: number,
  completedAt: number,
  difficulty = "1",
  retired = false,
): PlayRecord {
  return {
    id: `${gameId}:${problem}:${score}:${completedAt}`,
    gameId,
    startedAt: completedAt - 100,
    completedAt,
    payloadVersion: 1,
    payload: { problem, score, difficulty, retired },
  };
}

const plays = [
  record("alpha", "a", 82, jan),
  record("alpha", "a", 93, feb),
  record("alpha", "a", 99, mar),
  record("alpha", "b", 100, feb, "2"),
  record("alpha", "retired", 100, jan, "1", true),
] as const;

describe("CollectionとZukanの接続", () => {
  test("同じ問題集と履歴で図鑑とコレクションの最高評価が一致すること", () => {
    const journey = createCollectionJourney(plays, [alpha], now);
    const zukan = deriveGameZukan(zukanAlpha, plays, []);
    const solved = zukan.sections.flatMap(({ problems }) =>
      problems.filter((problem) => problem.kind === "solved"),
    );
    const game = journey.snapshots.at(-1)?.find(({ id }) => id === "alpha");

    expect(game?.total).toBe(zukan.solvedCount);
    expect(game?.counts.perfect).toBe(
      solved.filter(({ bestScore }) => bestScore === 100).length,
    );
    expect(game?.counts.great).toBe(
      solved.filter(({ bestScore }) => bestScore >= 90 && bestScore < 100)
        .length,
    );
  });
});
