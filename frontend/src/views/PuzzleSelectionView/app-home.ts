import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type GameCatalogEntry,
  toZukanGameSource,
} from "@/app/game-integration/game-catalog-entry";
import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import {
  readPlayAttemptsSnapshot,
  readPlayRecords,
  subscribePlayAttempts,
} from "@/features/records/read-play-history";
import type { ZukanContinuation } from "@/features/zukan/zukan-collection";
import {
  createZukanContinuations,
  type ZukanContinuations,
} from "@/features/zukan/zukan-continuation";
import { scheduleIdleTask } from "@/lib/idle-task";

export type AppHome = {
  selectedGameIndex: number;
  selectedGameContinuation: ZukanContinuation | null;
  selectGame: (index: number) => void;
  /** ホームを開いたときの完了記録と、離脱したプレイ。 */
  records: readonly PlayRecord[];
  attempts: readonly PlayAttempt[];
};

type AppHomeOptions = {
  opensCovered: boolean;
  /** ゲームの画面からホームへ来たときの、そのゲーム。 */
  originGameId?: string | null;
  fallbackGameId?: string;
};

/** 選んだときに待たせないよう、ゲームの続きを先に求めておく。 */
function prefetchContinuations(
  gameIds: readonly string[],
  continuations: ZukanContinuations,
): () => void {
  const pending = [...gameIds];
  let cancel = () => {};
  function findNext() {
    const gameId = pending.shift();
    if (gameId === undefined) {
      return;
    }
    continuations.find(gameId);
    cancel = scheduleIdleTask(findNext);
  }
  cancel = scheduleIdleTask(findNext);
  return () => cancel();
}

export function useAppHome(
  games: readonly GameCatalogEntry[],
  { opensCovered, originGameId, fallbackGameId }: AppHomeOptions,
): AppHome {
  const [records] = useState(() => readPlayRecords());
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const [chosenGameId, setChosenGameId] = useState<string | null>(null);
  // 続きを求めるには問題集の索引が要り、作るのが重い。タイトルで覆われている間は、タイトルを描いたあとに求める。
  const defersContinuations = useDeferredValue(false, opensCovered);
  const continuations = useMemo(
    () =>
      defersContinuations
        ? null
        : createZukanContinuations(
            games.map(toZukanGameSource),
            records,
            attempts,
          ),
    [defersContinuations, games, records, attempts],
  );

  useEffect(() => {
    if (continuations === null) {
      return;
    }
    return prefetchContinuations(
      games.map(({ id }) => id),
      continuations,
    );
  }, [games, continuations]);

  const originGameIndex = games.findIndex(({ id }) => id === originGameId);
  // 離脱はこの画面を描いたあとに保存されることがあるので、選ぶまでは求め直す。
  const chosenIndex = games.findIndex(({ id }) => id === chosenGameId);
  const latestPlayedGameId =
    chosenIndex === -1 && originGameIndex === -1
      ? (continuations?.findLatestPlayedGameId() ?? null)
      : null;
  const latestPlayedIndex = games.findIndex(
    ({ id }) => id === latestPlayedGameId,
  );
  const fallbackGameIndex = games.findIndex(({ id }) => id === fallbackGameId);
  const selectedGameIndex =
    [chosenIndex, originGameIndex, latestPlayedIndex].find(
      (index) => index !== -1,
    ) ?? Math.max(fallbackGameIndex, 0);
  const selectedGame = games[selectedGameIndex];

  return {
    selectedGameIndex,
    selectedGameContinuation:
      selectedGame && continuations
        ? continuations.find(selectedGame.id)
        : null,
    selectGame(index) {
      const game = games[index];
      if (game) setChosenGameId(game.id);
    },
    records,
    attempts,
  };
}
