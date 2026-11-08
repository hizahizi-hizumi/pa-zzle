import {
  createCollectionMockJourney,
  getMockTowerTiles,
  totalMockActivity,
  totalMockCounts,
} from "@/collection-mock/model";
import { gameCatalog } from "@/game-catalog/game-catalog";
import { gameResultLevels } from "@/games/result";

const gameIds = gameCatalog.map(({ id }) => id);

describe("コレクション比較用の架空記録", () => {
  test.each(["explorer", "specialist", "perfectionist"] as const)(
    "%s は時間とともに問題と最高評価が積み重なり、内訳も一致すること",
    (persona) => {
      const journey = createCollectionMockJourney(persona, gameIds);
      expect(journey.snapshots).toHaveLength(5);
      let previousTotal = 0;
      let hasUpgrade = false;
      for (const [period, games] of journey.snapshots.entries()) {
        expect(games).toHaveLength(gameIds.length);
        const total = games.reduce((sum, game) => sum + game.total, 0);
        const tallied = totalMockCounts(games);
        expect(
          gameResultLevels.reduce((sum, level) => sum + tallied[level], 0),
        ).toBe(total);
        const change = totalMockActivity(journey, period);
        expect(change.added).toBe(total - previousTotal);
        hasUpgrade ||= change.raised > 0;
        for (const game of games) {
          expect(game.total).toBe(
            gameResultLevels.reduce(
              (sum, level) => sum + game.counts[level],
              0,
            ),
          );
          expect(game.difficulties.reduce((sum, d) => sum + d.total, 0)).toBe(
            game.total,
          );
          for (const difficulty of game.difficulties) {
            expect(
              gameResultLevels.reduce(
                (sum, level) => sum + difficulty.counts[level],
                0,
              ),
            ).toBe(difficulty.total);
          }
          const previous = journey.snapshots[period - 1]?.find(
            ({ id }) => id === game.id,
          );
          expect(game.total).toBeGreaterThanOrEqual(previous?.total ?? 0);
          expect(game.counts.perfect).toBeGreaterThanOrEqual(
            previous?.counts.perfect ?? 0,
          );
        }
        previousTotal = total;
      }
      expect(hasUpgrade).toBe(true);
    },
  );

  test("遊び方の違いが量とPerfectの割合の両方に表れること", () => {
    const explorer = createCollectionMockJourney("explorer", gameIds);
    const specialist = createCollectionMockJourney("specialist", gameIds);
    const perfectionist = createCollectionMockJourney("perfectionist", gameIds);
    const e = explorer.snapshots[4] ?? [];
    const s = specialist.snapshots[4] ?? [];
    const p = perfectionist.snapshots[4] ?? [];
    const eCounts = totalMockCounts(e);
    const pCounts = totalMockCounts(p);

    expect(s[8]?.total).toBeGreaterThan(e[8]?.total ?? 0);
    expect(s[0]?.total).toBeLessThan(e[0]?.total ?? 0);
    expect(
      pCounts.perfect / p.reduce((sum, game) => sum + game.total, 0),
    ).toBeGreaterThan(
      eCounts.perfect / e.reduce((sum, game) => sum + game.total, 0),
    );
  });

  test("塔の小片は表示できる数に収まり、1問の柱も消えないこと", () => {
    const [game] =
      createCollectionMockJourney("explorer", gameIds).snapshots[4] ?? [];
    if (!game) throw new Error("mock game missing");
    const tower = getMockTowerTiles(game, game.total, 28);
    const single = getMockTowerTiles(
      {
        ...game,
        total: 1,
        counts: { clear: 1, good: 0, great: 0, perfect: 0 },
      },
      500,
      28,
    );

    expect(tower).toHaveLength(28);
    expect(new Set(tower.map(({ id }) => id)).size).toBe(28);
    expect(tower.every(({ level }) => level !== null)).toBe(true);
    expect(single.filter(({ level }) => level !== null)).toHaveLength(1);
  });
});
