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
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import type { ZukanContinuation } from "@/features/zukan/zukan-collection";
import {
  createZukanContinuations,
  type ZukanContinuations,
} from "@/features/zukan/zukan-continuation";

export type AppHome = {
  selectedGameIndex: number;
  selectedGameContinuation: ZukanContinuation | null;
  selectGame: (index: number) => void;
};

type AppHomeOptions = {
  opensCovered: boolean;
  fallbackGameId?: string;
};

function scheduleIdleTask(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}

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
  { opensCovered, fallbackGameId }: AppHomeOptions,
): AppHome {
  const [records] = useState(() => readPlayRecords());
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
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

  // 離脱はこの画面を描いたあとに保存されることがあるので、選ぶまでは求め直す。
  const latestPlayedGameId =
    chosenIndex === null
      ? (continuations?.findLatestPlayedGameId() ?? null)
      : null;
  const latestPlayedIndex = games.findIndex(
    ({ id }) => id === latestPlayedGameId,
  );
  const fallbackGameIndex = games.findIndex(({ id }) => id === fallbackGameId);
  const selectedGameIndex =
    chosenIndex ??
    (latestPlayedIndex === -1
      ? Math.max(fallbackGameIndex, 0)
      : latestPlayedIndex);
  const selectedGame = games[selectedGameIndex];

  return {
    selectedGameIndex,
    selectedGameContinuation:
      selectedGame && continuations
        ? continuations.find(selectedGame.id)
        : null,
    selectGame: setChosenIndex,
  };
}
