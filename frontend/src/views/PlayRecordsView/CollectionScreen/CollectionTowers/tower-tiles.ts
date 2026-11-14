import type { CollectionGame } from "@/features/collection/collection";
import {
  type GameResultLevel,
  gameResultLevelsAscending,
} from "@/games/result";

/** 各ゲームの実数を一定数の小片に縮約して、異なる問題数を比較できる高さにする。 */
export function getCollectionTowerTiles(
  game: CollectionGame,
  maxCount: number,
  tileCount: number,
): { id: string; level: GameResultLevel | null }[] {
  const filled =
    game.total === 0
      ? 0
      : Math.max(
          1,
          Math.round((game.total / Math.max(1, maxCount)) * tileCount),
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
