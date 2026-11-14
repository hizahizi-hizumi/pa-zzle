import {
  type CollectionSource,
  createCollectionJourney,
  totalCollectionCounts,
} from "@/features/collection/collection";
import type { PlayRecord } from "@/features/records/play-record";

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
const beta: CollectionSource = {
  ...alpha,
  id: "beta",
  playRecordDefinition: {
    ...alpha.playRecordDefinition,
    gameId: "beta",
    isRecord: (record) => record.gameId === "beta",
  },
};
const sources = [alpha, beta] as const;

const now = new Date(2026, 3, 7);
const dec = new Date(2025, 11, 10).getTime();
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
  record("alpha", "a", 91, feb),
  record("alpha", "a", 93, feb + 1),
  record("alpha", "a", 99, mar),
  record("alpha", "b", 100, feb, "2"),
  record("beta", "c", 78, mar, "5"),
  record("alpha", "retired", 100, jan, "1", true),
  record("alpha", "old", 100, jan, "easy"),
  record("removed-game", "d", 100, mar),
] as const;

const yearCrossing = [
  record("alpha", "last-year", 75, dec),
  record("alpha", "new-year", 93, jan),
] as const;
const atNewYear = new Date(2026, 0, 15);
const earliest = [record("alpha", "epoch", 100, 1_000)] as const;
const invalid = [
  record("alpha", "future", 100, new Date(2027, 1, 1).getTime()),
  record("alpha", "nan", Number.NaN, mar),
  record("alpha", "ancient", 100, -8_000_000_000_000_000),
] as const;
const updatedSameMonth = [
  record("alpha", "x", 80, feb),
  record("alpha", "x", 100, feb + 100),
] as const;

describe("createCollectionJourney", () => {
  test("月と年の境界を越えて記録月から現在までの期間を作ること", () => {
    const journey = createCollectionJourney(yearCrossing, sources, atNewYear);

    expect(journey.periods.map(({ key }) => key)).toEqual([
      "2025-12",
      "2026-01",
    ]);
    expect(journey.snapshots[0]?.[0]?.total).toBe(1);
    expect(journey.snapshots[1]?.[0]?.total).toBe(2);
  });

  test("同じ問題の再挑戦を重複して数えず、最高評価だけを月末に残すこと", () => {
    const journey = createCollectionJourney(plays, sources, now);
    const janGame = journey.snapshots[0]?.[0];
    const febGame = journey.snapshots[1]?.[0];
    const marchGame = journey.snapshots[2]?.[0];

    expect(janGame?.counts.good).toBe(1);
    expect(febGame?.total).toBe(2);
    expect(febGame?.counts.great).toBe(1);
    expect(febGame?.counts.perfect).toBe(1);
    expect(marchGame?.counts.great).toBe(1);
    expect(marchGame?.counts.perfect).toBe(1);
    expect(marchGame?.difficulties[1]?.counts.perfect).toBe(1);
    expect(journey.snapshots[3]?.[0]?.total).toBe(2);
  });

  test("最高評価の上昇は月につき問題1件として数え、同じ段階の点数更新では増やさないこと", () => {
    const journey = createCollectionJourney(plays, sources, now);
    const updates = journey.activity.alpha;

    expect(updates?.map(({ added, raised }) => [added, raised])).toEqual([
      [1, 0],
      [1, 1],
      [0, 0],
      [0, 0],
    ]);
    expect(updates?.[1]?.addedByLevel.perfect).toBe(1);
  });

  test("今の問題集から引けない記録や未知のゲームを含めず、全体の合計と内訳が一致すること", () => {
    const journey = createCollectionJourney(plays, sources, now);
    const games = journey.snapshots.at(-1) ?? [];
    const totals = totalCollectionCounts(games);

    expect(games.map(({ id, total }) => [id, total])).toEqual([
      ["alpha", 2],
      ["beta", 1],
    ]);
    expect(totals).toEqual({ clear: 1, good: 0, great: 1, perfect: 1 });
    expect(games.reduce((sum, game) => sum + game.total, 0)).toBe(3);
  });

  test("履歴が無いとき現在月の空の集計を返すこと", () => {
    const journey = createCollectionJourney([], sources, now);

    expect(journey.periods.map(({ key }) => key)).toEqual(["2026-04"]);
    expect(journey.snapshots[0]?.every(({ total }) => total === 0)).toBe(true);
    expect(journey.activity.alpha?.[0]?.added).toBe(0);
  });

  test("1970年の記録も正常な長期履歴として残すこと", () => {
    const journey = createCollectionJourney(earliest, sources, now);

    expect(journey.periods[0]?.key).toBe("1970-01");
    expect(journey.snapshots.at(-1)?.[0]?.total).toBe(1);
  });

  test("日付が未来の履歴や評価不能な記録を集計しないこと", () => {
    const journey = createCollectionJourney(invalid, sources, now);

    expect(journey.periods).toHaveLength(1);
    expect(journey.snapshots[0]?.[0]?.total).toBe(0);
  });

  test("1つの月に最初のクリアと再挑戦があっても最新評価で1問だけ積み上がること", () => {
    const journey = createCollectionJourney(updatedSameMonth, sources, now);

    expect(journey.activity.alpha?.[0]).toMatchObject({
      added: 1,
      raised: 0,
      addedByLevel: { perfect: 1 },
    });
    expect(journey.snapshots[0]?.[0]?.counts.perfect).toBe(1);
  });
});
