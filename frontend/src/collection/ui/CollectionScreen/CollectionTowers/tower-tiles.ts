import type { CollectionGame } from "@/collection/collection";
import {
  type GameResultLevel,
  gameResultLevelsAscending,
} from "@/games/result";
import { findZukanMilestoneAtLeast } from "@/zukan/zukan-milestone";

/**
 * 塔の上端に当たる問題の数。最も多いゲームの数以上の、図鑑と同じ節目にする。
 * 最も多いゲームに合わせると、1問でも塔が満杯に見えて、積み上がりが見えないため。
 */
export function getCollectionTowerScale(maxCount: number): number {
  return findZukanMilestoneAtLeast(maxCount);
}

/** 各ゲームの実数を、上端を `scaleCount` 問とした一定数の小片に縮約して、異なる問題数を比較できる高さにする。 */
export function getCollectionTowerTiles(
  game: CollectionGame,
  scaleCount: number,
  tileCount: number,
): { id: string; level: GameResultLevel | null }[] {
  const filled =
    game.total === 0
      ? 0
      : Math.min(
          tileCount,
          Math.max(
            1,
            Math.round((game.total / Math.max(1, scaleCount)) * tileCount),
          ),
        );
  const byLevel = gameResultLevelsAscending.map((level) => ({
    level,
    ideal: (game.counts[level] / Math.max(1, game.total)) * filled,
  }));
  const allocated = byLevel.map(({ ideal }) => Math.floor(ideal));
  let leftover = filled - allocated.reduce((sum, count) => sum + count, 0);
  const remainders = byLevel
    .map(({ ideal }, index) => ({ index, fraction: ideal - Math.floor(ideal) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { index } of remainders) {
    if (leftover <= 0) break;
    allocated[index] = (allocated[index] ?? 0) + 1;
    leftover--;
  }
  const levels = gameResultLevelsAscending.flatMap((level, index) =>
    Array.from({ length: allocated[index] ?? 0 }, () => level),
  );
  return Array.from({ length: tileCount }, (_, index) => ({
    id: `brick-${index}`,
    level:
      index < tileCount - filled
        ? null
        : (levels[index - tileCount + filled] ?? null),
  }));
}
