import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  type GameCatalogEntry,
  toZukanGameSource,
} from "@/game-catalog/game-catalog-entry";
import type { DifficultyLevel } from "@/games/difficulty";
import { scheduleIdleTask } from "@/lib/idle-task";
import type { PlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import { subscribeZukanPieceFramed } from "@/zukan/ui/zukan-piece-transit";
import {
  getZukanSheetPreview,
  type ZukanSheetPreview,
} from "@/zukan/ui/zukan-sheet-preview";
import {
  deriveGameZukan,
  getZukanProblemStatus,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import {
  findZukanChanges,
  listZukanViewedStatuses,
} from "@/zukan/zukan-last-viewed";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/zukan/zukan-last-viewed-storage";

/**
 * ゲームのホームを開いたときに開く台紙の難易度と、その全問の見せる状態（番号の順）、最後に解いた問題の番号の順の位置。
 * 見せる状態は、ゲームのホームが開いたときに見せるのと同じく、前回図鑑を見たときから変化した問題では変化する前の状態。
 */
type OpenSheet = {
  difficulty: DifficultyLevel;
  statuses: readonly ZukanProblemStatus[];
  /** その台紙で最後に解いた問題。最後に解いた問題がその台紙に無ければ `null`。 */
  latestSolvedIndex: number | null;
};

type Plays = {
  records: readonly PlayRecord[];
  attempts: readonly PlayAttempt[];
};

// ホームへ戻るたびに求め直さないよう、同じ記録と試行から求めた台紙はアプリが開いている間持っておく。
let sheetsPlays: Plays | null = null;
const sheets = new Map<string, OpenSheet>();

function forgetSheetsOfOtherPlays(plays: Plays): void {
  if (
    sheetsPlays?.records !== plays.records ||
    sheetsPlays.attempts !== plays.attempts
  ) {
    sheetsPlays = plays;
    sheets.clear();
  }
}

/** そのゲームで最後に解いた問題の、台紙 `problemIds` の中の位置。その台紙の問題でなければ `null`。 */
function findLatestSolvedIndex(
  game: GameCatalogEntry,
  records: readonly PlayRecord[],
  difficulty: DifficultyLevel,
  problemIds: readonly string[],
): number | null {
  let latest: PlayRecord | null = null;
  for (const record of records) {
    if (
      record.gameId === game.id &&
      (latest === null || record.completedAt > latest.completedAt)
    ) {
      latest = record;
    }
  }
  const target = latest === null ? null : game.recordProblemPlayTarget(latest);
  if (target === null || target.difficulty !== difficulty) {
    return null;
  }
  const index = problemIds.indexOf(target.problemId);
  return index === -1 ? null : index;
}

/** 開く台紙は、ゲームのホームと同じく、最後にクリアまたは離脱した難易度、遊んだことが無ければ最も低い難易度。 */
function findOpenSheet(game: GameCatalogEntry, plays: Plays): OpenSheet | null {
  forgetSheetsOfOtherPlays(plays);
  const cached = sheets.get(game.id);
  if (cached !== undefined) {
    return cached;
  }
  const zukan = deriveGameZukan(
    toZukanGameSource(game),
    plays.records,
    plays.attempts,
  );
  const section =
    zukan.sections.find(
      ({ difficulty }) => difficulty === zukan.latestPlayedDifficulty,
    ) ?? zukan.sections[0];
  if (section === undefined || section.problems.length === 0) {
    return null;
  }
  const changes = findZukanChanges(zukan, readZukanLastViewed(game.id))
    .byDifficulty[section.difficulty];
  const sheet = {
    difficulty: section.difficulty,
    statuses: section.problems.map(
      (problem) =>
        changes?.get(problem.problemId)?.previousStatus ??
        getZukanProblemStatus(problem),
    ),
    latestSolvedIndex: findLatestSolvedIndex(
      game,
      plays.records,
      section.difficulty,
      section.problems.map(({ problemId }) => problemId),
    ),
  };
  sheets.set(game.id, sheet);
  return sheet;
}

/**
 * 選んでいるゲームの開く台紙を、今の状態で見たことにして保存し、求め直させる。
 * 結果から運んだピースが額の台紙にはまったときに、変化を額で見せ終えたものとして扱う。
 */
function markOpenSheetViewed(game: GameCatalogEntry, plays: Plays): void {
  const sheet = findOpenSheet(game, plays);
  if (sheet === null) {
    return;
  }
  const zukan = deriveGameZukan(
    toZukanGameSource(game),
    plays.records,
    plays.attempts,
  );
  writeZukanLastViewed(
    game.id,
    listZukanViewedStatuses(zukan, [sheet.difficulty]),
  );
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
    return () => {};
  }
  let cancel = () => {};
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
    return subscribeZukanPieceFramed(() => {
      markOpenSheetViewed(selectedGame, plays);
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
          difficulty: sheet.difficulty,
          problemCount: sheet.statuses.length,
        });
      }
    }
    return previews;
  }, [games, selectedGameId, plays, hasFoundAll, viewportSize, framedCount]);
}
