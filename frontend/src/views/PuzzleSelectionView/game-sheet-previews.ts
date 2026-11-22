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
import { orderFromSelected } from "@/views/PuzzleSelectionView/carousel-order";

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

/**
 * 台紙を求めるには問題集の全問を並べるので、空いている時間に1ゲームずつ求め、1つ求めるたびに `onFound` を呼ぶ。
 * 送ったときに先に通る、選んでいるゲームの両隣から求める。
 */
function findOpenSheetsWhenIdle(
  games: readonly GameCatalogEntry[],
  selectedGameId: string,
  plays: Plays,
  onFound: () => void,
): () => void {
  const pending = orderFromSelected(
    games,
    games.findIndex(({ id }) => id === selectedGameId),
  ).filter((game) => !hasSheet(game, plays));
  if (pending.length === 0) {
    return function cancelNothing() {};
  }
  let cancel = function cancelNothing() {};
  function findNext() {
    const game = pending.shift();
    if (game === undefined) {
      return;
    }
    findOpenSheet(game, plays);
    onFound();
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

/** パズル選択の額に敷く、そのゲームの台紙の絵の元と、台紙の難易度。 */
export type GameSheetPreview = ZukanSheetPreview & {
  gameId: string;
  difficulty: DifficultyLevel;
  problemCount: number;
};

// 額は同じ元のあいだ絵を描き直さないので、元が同じなら同じものを返す。
const gamePreviews = new Map<string, GameSheetPreview>();

function toGameSheetPreview(
  gameId: string,
  difficulty: DifficultyLevel,
  preview: ZukanSheetPreview,
): GameSheetPreview {
  const cached = gamePreviews.get(gameId);
  if (
    cached !== undefined &&
    cached.difficulty === difficulty &&
    cached.appearanceKey === preview.appearanceKey
  ) {
    return cached;
  }
  const gamePreview = {
    ...preview,
    gameId,
    difficulty,
    problemCount: preview.statuses.length,
  };
  gamePreviews.set(gameId, gamePreview);
  return gamePreview;
}

/**
 * ゲームごとの、ゲームのホームを開いたときに開く台紙の絵の元。解いた問題のピースには評価の色が付き、最後に解いた問題のあたりを初めに見せる。
 * 選んでいるゲームの分はすぐ求め、ほかのゲームの分は空いている時間に1つずつ求め、求め終えたものから返す。
 * `games` はカルーセルに並べる順にする。`selectedGameId` が `undefined` の間は、何も求めない。
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
  const [foundCount, setFoundCount] = useState(0);
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
  useEffect(() => {
    if (selectedGameId === undefined) {
      return;
    }
    return findOpenSheetsWhenIdle(games, selectedGameId, plays, () =>
      setFoundCount((count) => count + 1),
    );
  }, [games, plays, selectedGameId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ほかのゲームの台紙を1つ求め終えるたびと、ピースが額の台紙にはまるたびに、見せるものを求め直す。
  return useMemo(() => {
    const [viewportWidthPx = 0, viewportHeightPx = 0] = viewportSize
      .split("x")
      .map(Number);
    const previews = new Map<string, GameSheetPreview>();
    for (const game of games) {
      if (game.id !== selectedGameId && !hasSheet(game, plays)) {
        continue;
      }
      const sheet = findOpenSheet(game, plays);
      if (sheet !== null) {
        previews.set(
          game.id,
          toGameSheetPreview(
            game.id,
            sheet.difficulty,
            getZukanSheetPreview(
              sheet.statuses,
              sheet.latestSolvedIndex,
              viewportWidthPx,
              viewportHeightPx,
            ),
          ),
        );
      }
    }
    return previews;
  }, [games, selectedGameId, plays, foundCount, viewportSize, framedCount]);
}
