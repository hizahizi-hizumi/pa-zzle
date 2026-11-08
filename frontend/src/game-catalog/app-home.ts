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
} from "@/game-catalog/game-catalog-entry";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import type { ZukanContinuation } from "@/zukan/zukan-collection";
import {
  createZukanContinuations,
  type ZukanContinuations,
} from "@/zukan/zukan-continuation";

export type AppHome = {
  /** 選んでいるゲームの、並びの中の位置。 */
  selectedGameIndex: number;
  /** 選んでいるゲームの続き。そのゲームを遊んだことが無ければ `null`。 */
  selectedGameContinuation: ZukanContinuation | null;
  selectGame: (index: number) => void;
};

type AppHomeOptions = {
  /** ホームを開いたときに、ホームがタイトルで覆われているか。 */
  isCovered: boolean;
  /** 遊んだ履歴がないとき、選んでおくゲームの ID。 */
  firstGameId?: string;
};

/** 空いている時間に `task` を呼ぶ。`requestIdleCallback` の無いブラウザでは次のタスクで呼ぶ。 */
function scheduleIdleTask(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}

/** 選んだときに待たせないよう、ゲームの続きを空いている時間に1ゲームずつ求めておく。 */
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

/**
 * アプリのホームで選んでいるゲームと、その続きを、記録と離脱したプレイへつなぐ。
 * 利用者が選ぶまでは、最後に遊んだゲームを選んでおき、遊んだゲームが無ければ並びの先頭を選んでおく。
 * 離脱はこの画面を描いたあとに保存されることがあるので、選ぶまでは求め直す。
 */
export function useAppHome(
  games: readonly GameCatalogEntry[],
  { isCovered, firstGameId }: AppHomeOptions,
): AppHome {
  const [records] = useState(() => readPlayRecords());
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  // 続きを求めるには問題集の索引が要り、作るのが重い。タイトルで覆われている間は、タイトルを描いたあとに求める。
  const defersContinuations = useDeferredValue(false, isCovered);
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

  const latestPlayedGameId =
    chosenIndex === null
      ? (continuations?.findLatestPlayedGameId() ?? null)
      : null;
  const latestPlayedIndex = games.findIndex(
    ({ id }) => id === latestPlayedGameId,
  );
  const firstGameIndex = games.findIndex(({ id }) => id === firstGameId);
  const selectedGameIndex =
    chosenIndex ??
    (latestPlayedIndex === -1
      ? Math.max(firstGameIndex, 0)
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
