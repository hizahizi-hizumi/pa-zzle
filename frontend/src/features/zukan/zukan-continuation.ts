import {
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import {
  deriveZukanContinuation,
  type ZukanContinuation,
  type ZukanPlaySource,
} from "@/features/zukan/zukan-collection";

export type ZukanContinuations = {
  find: (gameId: string) => ZukanContinuation | null;
  findLatestPlayedGameId: () => string | null;
};

/** 記録と試行を図鑑に使えるかは確かめない。 */
function findNewestPlayTimes(
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): ReadonlyMap<string, number> {
  const newestTimes = new Map<string, number>();
  function notePlay(gameId: string, playedAt: number) {
    newestTimes.set(gameId, Math.max(newestTimes.get(gameId) ?? 0, playedAt));
  }
  for (const record of records) {
    notePlay(record.gameId, record.completedAt);
  }
  for (const attempt of getAbandonedPlayAttempts(attempts, records)) {
    notePlay(attempt.gameId, attempt.abandonment.abandonedAt);
  }
  return newestTimes;
}

export function createZukanContinuations(
  games: readonly ZukanPlaySource[],
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): ZukanContinuations {
  const continuations = new Map<string, ZukanContinuation | null>();
  let latestPlayedGameId: string | null | undefined;

  function find(gameId: string): ZukanContinuation | null {
    if (continuations.has(gameId)) {
      return continuations.get(gameId) ?? null;
    }
    const game = games.find(({ id }) => id === gameId);
    const continuation = game
      ? deriveZukanContinuation(game, records, attempts)
      : null;
    continuations.set(gameId, continuation);
    return continuation;
  }

  // 履歴を図鑑に使えるかは問題集の索引で確かめ、索引を作るのは重いので、
  // 最後に遊んだゲームは、記録と試行の最も新しい時刻が新しいゲームから順に、それより新しい続きが見つかったところまでだけ求める。
  function findLatestPlayedGame(): string | null {
    const newestTimes = findNewestPlayTimes(records, attempts);
    const candidates = games
      .flatMap(({ id }) => {
        const newestTime = newestTimes.get(id);
        return newestTime === undefined ? [] : [{ id, newestTime }];
      })
      .sort((left, right) => right.newestTime - left.newestTime);
    let latest: { gameId: string; playedAt: number } | null = null;
    for (const { id, newestTime } of candidates) {
      if (latest !== null && newestTime <= latest.playedAt) {
        break;
      }
      const continuation = find(id);
      if (
        continuation !== null &&
        (latest === null || continuation.playedAt > latest.playedAt)
      ) {
        latest = { gameId: id, playedAt: continuation.playedAt };
      }
    }
    return latest?.gameId ?? null;
  }

  return {
    find,
    findLatestPlayedGameId() {
      if (latestPlayedGameId === undefined) {
        latestPlayedGameId = findLatestPlayedGame();
      }
      return latestPlayedGameId;
    },
  };
}
