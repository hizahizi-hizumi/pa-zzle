import { difficultyLevels } from "@/games/difficulty";
import {
  type GameResultLevel,
  gameResultLevelsAscending,
  getGameResultLevel,
} from "@/games/result";
import { toClearedProblem } from "@/records/cleared-problem";
import type { PlayRecord } from "@/records/play-record";
import type { ZukanPlaySource } from "@/zukan/zukan-collection";

export type CollectionMonth = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type CollectionCounts = Readonly<Record<GameResultLevel, number>>;

export type CollectionDifficulty = {
  level: number;
  total: number;
  counts: CollectionCounts;
};

export type CollectionGame = {
  id: string;
  total: number;
  counts: CollectionCounts;
  difficulties: readonly CollectionDifficulty[];
};

export type CollectionActivity = {
  added: number;
  raised: number;
  addedByLevel: Record<GameResultLevel, number>;
};

export type CollectionJourney = {
  periods: readonly CollectionMonth[];
  snapshots: readonly (readonly CollectionGame[])[];
  activity: Readonly<Record<string, readonly CollectionActivity[]>>;
};

export type CollectionSource = Pick<
  ZukanPlaySource,
  "id" | "recordProblemPlayTarget" | "playRecordDefinition"
>;

type SolvedRecord = {
  gameId: string;
  problemKey: string;
  difficulty: number;
  score: number;
  monthIndex: number;
};

type GameTally = {
  counts: Record<GameResultLevel, number>;
  difficulties: Record<GameResultLevel, number>[];
  scores: Map<string, number>;
};

function emptyCounts(): Record<GameResultLevel, number> {
  return { clear: 0, good: 0, great: 0, perfect: 0 };
}

function monthNumber(time: number): number {
  const date = new Date(time);
  return date.getFullYear() * 12 + date.getMonth();
}

function createMonths(fromMonth: number, toMonth: number): CollectionMonth[] {
  return Array.from({ length: toMonth - fromMonth + 1 }, (_, index) => {
    const monthNumber = fromMonth + index;
    const year = Math.floor(monthNumber / 12);
    const month = (monthNumber % 12) + 1;
    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      year,
      month,
      label: `${year}年${month}月`,
    };
  });
}

function emptyActivity(): CollectionActivity {
  return { added: 0, raised: 0, addedByLevel: emptyCounts() };
}

function createTally(): GameTally {
  return {
    counts: emptyCounts(),
    difficulties: difficultyLevels.map(() => emptyCounts()),
    scores: new Map(),
  };
}

function snapshotGame(id: string, tally: GameTally): CollectionGame {
  const difficulties = tally.difficulties.map((counts, index) => ({
    level: Number(difficultyLevels[index]?.id ?? index + 1),
    total: gameResultLevelsAscending.reduce(
      (sum, level) => sum + counts[level],
      0,
    ),
    counts: { ...counts },
  }));
  return {
    id,
    total: tally.scores.size,
    counts: { ...tally.counts },
    difficulties,
  };
}

export function createCollectionJourney(
  records: readonly PlayRecord[],
  games: readonly CollectionSource[],
  now: Date = new Date(),
): CollectionJourney {
  const finalMonth = monthNumber(now.getTime());
  const sources = new Map(games.map((game) => [game.id, game]));
  const validRecords: (Omit<SolvedRecord, "monthIndex"> & { month: number })[] =
    [];

  for (const record of records) {
    // プレイ記録の日時はUnixミリ秒。1970年より前の異常値で月列を肥大化させない。
    if (record.completedAt < 0 || record.completedAt > now.getTime()) continue;
    const month = monthNumber(record.completedAt);
    if (!Number.isFinite(month)) continue;
    const game = sources.get(record.gameId);
    if (!game) continue;
    const problem = toClearedProblem(record, game);
    if (problem === null) continue;
    validRecords.push({
      gameId: game.id,
      problemKey: `${problem.difficulty}:${problem.problemId}`,
      difficulty: Number(problem.difficulty) - 1,
      score: problem.score,
      month,
    });
  }

  let firstMonth = finalMonth;
  for (const { month } of validRecords)
    firstMonth = Math.min(firstMonth, month);
  const periods = createMonths(firstMonth, finalMonth);
  const monthlyRecords = new Map<number, Map<string, SolvedRecord>>();
  for (const record of validRecords) {
    const monthIndex = record.month - firstMonth;
    const bucket =
      monthlyRecords.get(monthIndex) ?? new Map<string, SolvedRecord>();
    const key = `${record.gameId}:${record.problemKey}`;
    const previous = bucket.get(key);
    if (!previous || record.score > previous.score) {
      bucket.set(key, { ...record, monthIndex });
    }
    monthlyRecords.set(monthIndex, bucket);
  }

  const tallies = new Map(games.map(({ id }) => [id, createTally()]));
  const activity: Record<string, CollectionActivity[]> = {};
  for (const { id } of games) {
    activity[id] = periods.map(emptyActivity);
  }
  const snapshots: CollectionGame[][] = [];
  for (const [index] of periods.entries()) {
    for (const record of monthlyRecords.get(index)?.values() ?? []) {
      const tally = tallies.get(record.gameId);
      const change = activity[record.gameId]?.[index];
      if (!tally || !change) continue;
      const oldScore = tally.scores.get(record.problemKey);
      if (oldScore !== undefined && record.score <= oldScore) continue;
      const currentLevel = getGameResultLevel(record.score);
      const previousLevel =
        oldScore === undefined ? null : getGameResultLevel(oldScore);
      tally.scores.set(record.problemKey, record.score);
      if (previousLevel === null) {
        change.added += 1;
        change.addedByLevel[currentLevel] += 1;
      } else if (previousLevel !== currentLevel) {
        change.raised += 1;
        tally.counts[previousLevel] -= 1;
        const previousDifficulty = tally.difficulties[record.difficulty];
        if (previousDifficulty) previousDifficulty[previousLevel] -= 1;
      } else {
        continue;
      }
      tally.counts[currentLevel] += 1;
      const difficultyCounts = tally.difficulties[record.difficulty];
      if (difficultyCounts) difficultyCounts[currentLevel] += 1;
    }
    snapshots.push(
      games.map(({ id }) => snapshotGame(id, tallies.get(id) ?? createTally())),
    );
  }

  return { periods, snapshots, activity };
}

export function totalCollectionCounts(
  games: readonly CollectionGame[],
): CollectionCounts {
  const counts = emptyCounts();
  for (const game of games) {
    for (const level of gameResultLevelsAscending)
      counts[level] += game.counts[level];
  }
  return counts;
}
