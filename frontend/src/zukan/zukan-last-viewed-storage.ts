import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { gameResultLevels } from "@/games/result";
import { isRecordObject } from "@/lib/type-guards";
import { getDefaultStorage, type PlayRecordStorage } from "@/records/storage";
import type {
  ZukanViewedStatus,
  ZukanViewedStatuses,
} from "@/zukan/zukan-last-viewed";

/**
 * ゲームの ID ごとに、そのゲームの図鑑を前回見たときの `ZukanViewedStatuses` を持つ。
 * 挑戦中の問題を残す前の保存は解いた問題の評価段階だけを持ち、同じ形のまま挑戦中の問題が無いものとして読める。
 */
const ZUKAN_LAST_VIEWED_STORAGE_KEY = "pa-zzle.zukan-last-viewed.v1";

function isZukanViewedStatus(value: unknown): value is ZukanViewedStatus {
  return (
    value === "attempted" || gameResultLevels.some((level) => level === value)
  );
}

/** 読めない問題だけを飛ばし、ほかの問題の状態は残す。 */
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

/** 読めない難易度だけを飛ばし、ほかの難易度の状態は残す。 */
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

/**
 * そのゲームの図鑑を前回見たときの状態を読む。
 * 一度も見ていないとき、保存を読めないとき、そのゲームの保存が壊れているときは `null` を返す。
 */
export function readZukanLastViewed(
  gameId: string,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): ZukanViewedStatuses | null {
  return readStoredGame(storage ? readStoredGames(storage) : null, gameId);
}

/**
 * そのゲームの図鑑の難易度を今見た状態として保存する。`statuses` に無い難易度と、ほかのゲームの状態は保つ。
 * 保存できなくても図鑑を見るのを妨げないよう、失敗は無視する。
 */
export function writeZukanLastViewed(
  gameId: string,
  statuses: ZukanViewedStatuses,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }
  const games = readStoredGames(storage) ?? {};
  const game = { ...readStoredGame(games, gameId), ...statuses };
  try {
    storage.setItem(
      ZUKAN_LAST_VIEWED_STORAGE_KEY,
      JSON.stringify({ ...games, [gameId]: game }),
    );
  } catch {
    return;
  }
}
