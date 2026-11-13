import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { gameResultLevelsAscending } from "@/games/result";
import { isRecordObject } from "@/lib/type-guards";
import { getDefaultStorage, type PlayRecordStorage } from "@/records/storage";
import type {
  ZukanViewedStatus,
  ZukanViewedStatuses,
  ZukanViewedTimes,
} from "@/zukan/zukan-last-viewed";

/**
 * ゲームごとに、難易度をキーにした前回の状態と、`viewedAt` に難易度ごとの残した時刻を持つ。
 * 挑戦中の問題を残す前の保存は解いた問題の評価段階だけを持ち、同じ形のまま挑戦中の問題が無いものとして読める。
 * 時刻を残す前の保存は、同じ形のまま時刻が無いものとして読める。
 */
const ZUKAN_LAST_VIEWED_STORAGE_KEY = "pa-zzle.zukan-last-viewed.v1";
const VIEWED_TIMES_KEY = "viewedAt";

function isZukanViewedStatus(value: unknown): value is ZukanViewedStatus {
  return (
    value === "attempted" ||
    gameResultLevelsAscending.some((level) => level === value)
  );
}

function parseViewedSection(
  value: unknown,
): Record<ProblemId, ZukanViewedStatus> | null {
  if (!isRecordObject(value)) {
    return null;
  }
  const section: Record<ProblemId, ZukanViewedStatus> = {};
  for (const [problemId, status] of Object.entries(value)) {
    if (isZukanViewedStatus(status)) {
      section[problemId] = status;
    }
  }
  return section;
}

function parseViewedStatuses(value: unknown): ZukanViewedStatuses | null {
  if (!isRecordObject(value)) {
    return null;
  }
  const statuses: ZukanViewedStatuses = {};
  for (const [key, sectionValue] of Object.entries(value)) {
    const difficulty = parseDifficultyLevel(key);
    const section = parseViewedSection(sectionValue);
    if (difficulty !== undefined && section !== null) {
      statuses[difficulty] = section;
    }
  }
  return statuses;
}

function parseViewedTimes(value: unknown): ZukanViewedTimes {
  if (!isRecordObject(value)) {
    return {};
  }
  const times: ZukanViewedTimes = {};
  for (const [key, time] of Object.entries(value)) {
    const difficulty = parseDifficultyLevel(key);
    if (difficulty !== undefined && typeof time === "number") {
      times[difficulty] = time;
    }
  }
  return times;
}

function readStoredGames(
  storage: PlayRecordStorage,
): Record<string, unknown> | null {
  try {
    const stored = storage.getItem(ZUKAN_LAST_VIEWED_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    return isRecordObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredGame(
  games: Record<string, unknown> | null,
  gameId: string,
): ZukanViewedStatuses | null {
  return games && Object.hasOwn(games, gameId)
    ? parseViewedStatuses(games[gameId])
    : null;
}

export function readZukanLastViewed(
  gameId: string,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): ZukanViewedStatuses | null {
  return readStoredGame(storage ? readStoredGames(storage) : null, gameId);
}

export function readZukanLastViewedTimes(
  gameId: string,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): ZukanViewedTimes {
  const games = storage ? readStoredGames(storage) : null;
  const game =
    games && Object.hasOwn(games, gameId) ? games[gameId] : undefined;
  return parseViewedTimes(
    isRecordObject(game) ? game[VIEWED_TIMES_KEY] : undefined,
  );
}

/** `statuses` が持つ難易度の状態を、`viewedAt` を残した時刻として置き換える。 */
export function writeZukanLastViewed(
  gameId: string,
  statuses: ZukanViewedStatuses,
  viewedAt: number,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }
  const games = readStoredGames(storage) ?? {};
  const times: ZukanViewedTimes = {
    ...readZukanLastViewedTimes(gameId, storage),
    ...Object.fromEntries(
      Object.keys(statuses).map((difficulty) => [difficulty, viewedAt]),
    ),
  };
  const game = {
    ...readStoredGame(games, gameId),
    ...statuses,
    [VIEWED_TIMES_KEY]: times,
  };
  // 保存できなくても図鑑を見るのを妨げないよう、失敗は無視する。
  try {
    storage.setItem(
      ZUKAN_LAST_VIEWED_STORAGE_KEY,
      JSON.stringify({ ...games, [gameId]: game }),
    );
  } catch {
    return;
  }
}
