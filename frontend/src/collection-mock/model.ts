import { type GameResultLevel, gameResultLevels } from "@/games/result";

/** 実際のプレイ記録を変更せず、遊び方による違いを比較するための架空のコレクション。 */
export const collectionMockPersonas = [
  { id: "explorer", name: "いろいろ遊ぶ" },
  { id: "specialist", name: "ひとつを極める" },
  { id: "perfectionist", name: "満点を磨く" },
] as const;

export type CollectionMockPersona =
  (typeof collectionMockPersonas)[number]["id"];

export const collectionMockPeriods = [
  "1〜2月",
  "3〜4月",
  "5〜6月",
  "7〜8月",
  "9〜11月",
] as const;

export type CollectionMockCounts = Readonly<Record<GameResultLevel, number>>;

export type CollectionMockDifficulty = {
  level: number;
  total: number;
  counts: CollectionMockCounts;
};

export type CollectionMockGame = {
  id: string;
  total: number;
  counts: CollectionMockCounts;
  difficulties: readonly CollectionMockDifficulty[];
};

/** その期間に新たに解いた問題と、以前解いた問題の最高評価を上げた回数。 */
export type CollectionMockActivity = {
  added: number;
  raised: number;
  /** 新たに解いた時点での評価。以前の問題の評価更新は含まない。 */
  addedByLevel: CollectionMockCounts;
};

export type CollectionMockJourney = {
  snapshots: readonly (readonly CollectionMockGame[])[];
  activity: Readonly<Record<string, readonly CollectionMockActivity[]>>;
};

const weights: Record<CollectionMockPersona, readonly number[]> = {
  explorer: [82, 67, 55, 42, 38, 33, 27, 24, 19, 13],
  specialist: [8, 14, 20, 10, 18, 6, 12, 7, 299, 6],
  perfectionist: [32, 35, 38, 45, 56, 60, 49, 43, 24, 18],
};

/** ゲームごとに興味を持ち始めた時期を変える。最終時点では1になる。 */
const fractions = [
  [0.08, 0.35, 0.67, 0.88, 1],
  [0.28, 0.52, 0.69, 0.82, 1],
  [0.04, 0.11, 0.2, 0.66, 1],
  [0.05, 0.08, 0.17, 0.35, 1],
  [0.01, 0.1, 0.48, 0.65, 1],
  [0.21, 0.57, 0.72, 0.92, 1],
  [0.02, 0.07, 0.12, 0.27, 1],
  [0.01, 0.02, 0.11, 0.29, 1],
  [0.04, 0.21, 0.4, 0.51, 1],
  [0.01, 0.01, 0.03, 0.09, 1],
] as const;

function emptyCounts(): Record<GameResultLevel, number> {
  return { clear: 0, good: 0, great: 0, perfect: 0 };
}

function deterministicPercent(game: number, problem: number, salt: number) {
  return (
    ((game * 41 + problem * 67 + Math.floor(problem / 7) * 13 + salt * 83) %
      997) /
    997
  );
}

const ascendingLevels = ["clear", "good", "great", "perfect"] as const;

function startingRank(
  persona: CollectionMockPersona,
  game: number,
  problem: number,
): number {
  const r = deterministicPercent(game, problem, 1);
  const cutoffs =
    persona === "perfectionist"
      ? [0.12, 0.32, 0.56]
      : persona === "specialist"
        ? [0.17, 0.43, 0.72]
        : [0.15, 0.35, 0.62];
  return cutoffs.findIndex((cutoff) => r < cutoff) === -1
    ? 3
    : cutoffs.findIndex((cutoff) => r < cutoff);
}

/** 評価が上がるのは初クリア後の時期だけ。いったん到達した評価は下がらない。 */
function rankAt(
  persona: CollectionMockPersona,
  game: number,
  problem: number,
  born: number,
  period: number,
): number {
  let rank = startingRank(persona, game, problem);
  const probability =
    persona === "perfectionist" ? 0.69 : persona === "specialist" ? 0.22 : 0.16;
  for (let step = born + 1; step <= period; step++) {
    if (deterministicPercent(game, problem, step + 3) < probability) {
      rank = Math.min(3, rank + 1);
    }
  }
  return rank;
}

function toGame(
  id: string,
  counts: Record<GameResultLevel, number>,
  byDifficulty: Record<GameResultLevel, number>[],
): CollectionMockGame {
  const difficulties = byDifficulty.map((item, index) => ({
    level: index + 1,
    total: gameResultLevels.reduce((sum, level) => sum + item[level], 0),
    counts: { ...item },
  }));
  return {
    id,
    total: difficulties.reduce((sum, item) => sum + item.total, 0),
    counts: { ...counts },
    difficulties,
  };
}

/** 問題単位の初クリアとその後の評価更新から、全時点の姿を再構成する。 */
export function createCollectionMockJourney(
  persona: CollectionMockPersona,
  gameIds: readonly string[],
): CollectionMockJourney {
  const snapshots: CollectionMockGame[][] = Array.from(
    { length: collectionMockPeriods.length },
    () => [],
  );
  const activity: Record<string, CollectionMockActivity[]> = {};
  for (const [gameIndex, id] of gameIds.entries()) {
    const total = weights[persona][gameIndex] ?? 0;
    const milestones = (fractions[gameIndex] ?? fractions[0]).map((part) =>
      Math.round(total * part),
    );
    const snapshotCounts = milestones.map(() => emptyCounts());
    const snapshotDifficulties = milestones.map(() =>
      Array.from({ length: 5 }, emptyCounts),
    );
    const changes = milestones.map(() => ({
      added: 0,
      raised: 0,
      addedByLevel: emptyCounts(),
    }));

    for (let problem = 0; problem < total; problem++) {
      const born = milestones.findIndex((count) => problem < count);
      if (born === -1) continue;
      const difficulty = (problem * 7 + gameIndex * 3) % 5;
      let previousRank = -1;
      for (let period = born; period < milestones.length; period++) {
        const rank = rankAt(persona, gameIndex, problem, born, period);
        const level = ascendingLevels[rank];
        const counts = snapshotCounts[period];
        const difficultyCounts = snapshotDifficulties[period]?.[difficulty];
        if (!level || !counts || !difficultyCounts) continue;
        counts[level]++;
        difficultyCounts[level]++;
        const change = changes[period];
        if (change) {
          if (period === born) {
            change.added++;
            change.addedByLevel[level]++;
          } else if (rank > previousRank) {
            change.raised++;
          }
        }
        previousRank = rank;
      }
    }
    activity[id] = changes;
    for (let period = 0; period < milestones.length; period++) {
      const counts = snapshotCounts[period];
      const difficulties = snapshotDifficulties[period];
      if (counts && difficulties) {
        snapshots[period]?.push(toGame(id, counts, difficulties));
      }
    }
  }
  return { snapshots, activity };
}

export function totalMockCounts(
  games: readonly CollectionMockGame[],
): CollectionMockCounts {
  const result = emptyCounts();
  for (const game of games) {
    for (const level of gameResultLevels) result[level] += game.counts[level];
  }
  return result;
}

export function totalMockActivity(
  journey: CollectionMockJourney,
  period: number,
): { added: number; raised: number } {
  return Object.values(journey.activity).reduce(
    (sum, periods) => ({
      added: sum.added + (periods[period]?.added ?? 0),
      raised: sum.raised + (periods[period]?.raised ?? 0),
    }),
    { added: 0, raised: 0 },
  );
}

/** 形は24片に縮約し、数字は縮約せず全問の正確な数を示す。 */
export function getMockTowerTiles(
  game: CollectionMockGame,
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
  const base = ascendingLevels.map((level) => ({
    level,
    ideal: (game.counts[level] / Math.max(1, game.total)) * filled,
  }));
  const allocated = base.map(({ ideal }) => Math.floor(ideal));
  let leftover = filled - allocated.reduce((sum, count) => sum + count, 0);
  const byRemainder = base
    .map(({ ideal }, index) => ({ index, fraction: ideal - Math.floor(ideal) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const item of byRemainder) {
    if (leftover <= 0) break;
    allocated[item.index] = (allocated[item.index] ?? 0) + 1;
    leftover--;
  }
  const levels = ascendingLevels.flatMap((level, index) =>
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
