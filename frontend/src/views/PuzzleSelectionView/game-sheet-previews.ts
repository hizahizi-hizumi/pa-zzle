import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  type GameCatalogEntry,
  toZukanGameSource,
} from "@/app/game-integration/game-catalog-entry";
import { subscribeZukanPieceFramed } from "@/app/shell/zukan-piece-transit";
import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import {
  getZukanSheetPreview,
  type ZukanSheetPreview,
} from "@/features/zukan/ui/zukan-sheet-preview";
import { deriveGameZukan } from "@/features/zukan/zukan-collection";
import {
  findZukanOpenSheet,
  markZukanProblemViewed,
  type ZukanOpenSheet,
} from "@/features/zukan/zukan-open-sheet";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/features/zukan/zukan-viewed-history";
import type { DifficultyLevel } from "@/games/difficulty";
import { scheduleIdleTask } from "@/lib/idle-task";

type Plays = {
  records: readonly PlayRecord[];
  attempts: readonly PlayAttempt[];
};

// ホームへ戻るたびに求め直さないよう、同じ記録と試行から求めた台紙はアプリが開いている間持っておく。
let sheetsPlays: Plays | null = null;
const sheets = new Map<string, ZukanOpenSheet | null>();

function forgetSheetsOfOtherPlays(plays: Plays): void {
  if (
    sheetsPlays?.records !== plays.records ||
    sheetsPlays.attempts !== plays.attempts
  ) {
    sheetsPlays = plays;
    sheets.clear();
  }
}

function findOpenSheet(
  game: GameCatalogEntry,
  plays: Plays,
): ZukanOpenSheet | null {
  forgetSheetsOfOtherPlays(plays);
  const cached = sheets.get(game.id);
  if (cached !== undefined) {
    return cached;
  }
  const source = toZukanGameSource(game);
  const sheet = findZukanOpenSheet(
    source,
    deriveGameZukan(source, plays.records, plays.attempts),
    plays.records,
    readZukanLastViewed(game.id),
  );
  sheets.set(game.id, sheet);
  return sheet;
}

/** 額の台紙にはまった1問を、今の状態で見たことにして保存し、そのゲームの台紙を求め直させる。 */
function markFramedProblemViewed(
  game: GameCatalogEntry,
  plays: Plays,
  difficulty: string,
  index: number,
): void {
  const source = toZukanGameSource(game);
  const viewed = markZukanProblemViewed(
    deriveGameZukan(source, plays.records, plays.attempts),
    readZukanLastViewed(game.id),
    difficulty,
    index,
  );
  if (viewed === null) {
    return;
  }
  writeZukanLastViewed(game.id, viewed);
  sheets.delete(game.id);
}

function hasSheet(game: GameCatalogEntry, plays: Plays): boolean {
  forgetSheetsOfOtherPlays(plays);
  return sheets.has(game.id);
}

/** 台紙を求めるには問題集の全問を並べるので重い。空いている時間に1ゲームずつ求め、求め終えたら `onDone` を呼ぶ。 */
function findOpenSheetsWhenIdle(
  games: readonly GameCatalogEntry[],
  plays: Plays,
  onDone: () => void,
): () => void {
  const pending = games.filter((game) => !hasSheet(game, plays));
  if (pending.length === 0) {
    return function cancelNothing() {};
  }
  let cancel = function cancelNothing() {};
  function findNext() {
    const game = pending.shift();
    if (game === undefined) {
      onDone();
      return;
    }
    findOpenSheet(game, plays);
    cancel = scheduleIdleTask(findNext);
  }
  cancel = scheduleIdleTask(findNext);
  return () => cancel();
}

function subscribeViewportSize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getViewportSize(): string {
  return `${window.innerWidth}x${window.innerHeight}`;
}

/** パズル選択の額に敷く、そのゲームの台紙の絵と、台紙の難易度。 */
export type GameSheetPreview = ZukanSheetPreview & {
  gameId: string;
  difficulty: DifficultyLevel;
  problemCount: number;
};

/**
 * ゲームごとの、ゲームのホームを開いたときに開く台紙の絵。解いた問題のピースには評価の色が付き、最後に解いた問題のあたりを描く。
 * 選んでいるゲームの分はすぐ求め、ほかのゲームの分は空いている時間に求める。求め終えるまでは、選んでいるゲームの分だけ返す。
 * `selectedGameId` が `undefined` の間は、何も求めない。
 */
export function useGameSheetPreviews(
  games: readonly GameCatalogEntry[],
  selectedGameId: string | undefined,
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): ReadonlyMap<string, GameSheetPreview> {
  const viewportSize = useSyncExternalStore(
    subscribeViewportSize,
    getViewportSize,
  );
  const plays = useMemo(() => ({ records, attempts }), [records, attempts]);
  const [idlePlays, setIdlePlays] = useState<Plays | null>(null);
  const [framedCount, setFramedCount] = useState(0);
  const selectedGame = games.find(({ id }) => id === selectedGameId);

  useEffect(() => {
    if (selectedGame === undefined) {
      return;
    }
    return subscribeZukanPieceFramed(({ gameId, difficulty, index }) => {
      if (gameId !== selectedGame.id) {
        return;
      }
      markFramedProblemViewed(selectedGame, plays, difficulty, index);
      setFramedCount((count) => count + 1);
    });
  }, [selectedGame, plays]);
  const hasFoundAll =
    idlePlays === plays || games.every((game) => hasSheet(game, plays));

  useEffect(() => {
    if (selectedGameId === undefined) {
      return;
    }
    return findOpenSheetsWhenIdle(games, plays, () => setIdlePlays(plays));
  }, [games, plays, selectedGameId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ピースが額の台紙にはまるたびに、見せる状態を求め直す。
  return useMemo(() => {
    const [viewportWidthPx = 0, viewportHeightPx = 0] = viewportSize
      .split("x")
      .map(Number);
    const previews = new Map<string, GameSheetPreview>();
    for (const game of games) {
      if (game.id !== selectedGameId && !hasFoundAll) {
        continue;
      }
      const sheet = findOpenSheet(game, plays);
      if (sheet !== null) {
        previews.set(game.id, {
          ...getZukanSheetPreview(
            sheet.statuses,
            sheet.latestSolvedIndex,
            viewportWidthPx,
            viewportHeightPx,
          ),
          gameId: game.id,
          difficulty: sheet.difficulty,
          problemCount: sheet.statuses.length,
        });
      }
    }
    return previews;
  }, [games, selectedGameId, plays, hasFoundAll, viewportSize, framedCount]);
}
