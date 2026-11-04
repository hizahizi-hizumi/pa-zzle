import { findGameCatalogEntry, gameCatalog } from "@/game-catalog/game-catalog";
import type {
  GameCatalogEntry,
  RecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import type { PlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import {
  getPlayRecordMetricValue,
  PLAY_SCORE_METRIC_ID,
} from "@/records/play-record-definition";
import {
  listPlayTimelineEntries,
  type PlayTimelineEntry,
} from "@/records/play-timeline";
import type { PlayTimelineEntryDescription } from "@/records/ui/play-timeline-entry-description";
import {
  createZukanNumberFinder,
  type FindZukanNumber,
} from "@/zukan/zukan-number";

/** 時間の流れの1件を押したときに開く画面。 */
export type PlayTimelineEntryDestination =
  | { kind: "result"; game: GameCatalogEntry; record: PlayRecord }
  | {
      kind: "game-home";
      game: GameCatalogEntry;
      /** ゲームのホームで選んでおく問題。今の問題集で引けない問題なら `undefined`。 */
      problemId: ProblemId | undefined;
    };

/** 今のアプリにあるゲームの完了記録と離脱した試行を、遊んだ時刻の新しい順に並べる。 */
export function listCatalogPlayTimelineEntries(
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): PlayTimelineEntry[] {
  const gameIds = new Set<string>(gameCatalog.map(({ id }) => id));
  return listPlayTimelineEntries(
    records.filter(({ gameId }) => gameIds.has(gameId)),
    attempts.filter(({ gameId }) => gameIds.has(gameId)),
  );
}

function getEntryGameId(entry: PlayTimelineEntry): string {
  return entry.kind === "cleared" ? entry.record.gameId : entry.attempt.gameId;
}

function findEntryProblemTarget(
  game: GameCatalogEntry,
  entry: PlayTimelineEntry,
): RecordProblemPlayTarget | null {
  return entry.kind === "cleared"
    ? game.recordProblemPlayTarget(entry.record)
    : game.attemptProblemPlayTarget(entry.attempt);
}

const zukanNumberFinders = new Map<string, FindZukanNumber>();

function getZukanNumberFinder(game: GameCatalogEntry): FindZukanNumber {
  const existing = zukanNumberFinders.get(game.id);
  if (existing) {
    return existing;
  }
  const finder = createZukanNumberFinder(game.listPoolProblemIds);
  zukanNumberFinders.set(game.id, finder);
  return finder;
}

function requireEntryGame(entry: PlayTimelineEntry): GameCatalogEntry {
  const game = findGameCatalogEntry(getEntryGameId(entry));
  if (game === undefined) {
    throw new Error(
      "時間の流れには、今のアプリにあるゲームのプレイだけを並べる",
    );
  }
  return game;
}

/**
 * 時間の流れの1件に示す、ゲーム・レベル・図鑑の番号・評価点を求める。`listCatalogPlayTimelineEntries` で並べた1件を渡す。
 * 図鑑の番号は、今の問題集で引ける問題だけに付ける。
 */
export function describePlayTimelineEntry(
  entry: PlayTimelineEntry,
): PlayTimelineEntryDescription {
  const game = requireEntryGame(entry);
  const display = game.playRecordDisplay;
  const comparisonKey =
    entry.kind === "cleared"
      ? display.definition.getComparisonKey(entry.record)
      : entry.attempt.start.difficulty;
  const target = findEntryProblemTarget(game, entry);
  const targetDifficulty = parseDifficultyLevel(target?.difficulty);

  return {
    gameName: game.name,
    pictogramSvg: game.pictogramSvg,
    levelLabel:
      comparisonKey === null ? null : display.getComparisonLabel(comparisonKey),
    zukanNumber:
      target === null || targetDifficulty === undefined
        ? null
        : getZukanNumberFinder(game)(targetDifficulty, target.problemId),
    score:
      entry.kind === "cleared"
        ? getPlayRecordMetricValue(
            entry.record,
            display.definition,
            PLAY_SCORE_METRIC_ID,
          )
        : null,
  };
}

/**
 * 時間の流れの1件を押したときに開く画面を求める。結果画面を描ける記録はその結果画面、
 * それ以外（離脱したプレイ・今の規則で結果を作れない記録）はその問題を選んだゲームのホームを開く。
 */
export function findPlayTimelineEntryDestination(
  entry: PlayTimelineEntry,
): PlayTimelineEntryDestination {
  const game = requireEntryGame(entry);
  if (entry.kind === "cleared" && game.hasRecordResult(entry.record)) {
    return { kind: "result", game, record: entry.record };
  }
  return {
    kind: "game-home",
    game,
    problemId: findEntryProblemTarget(game, entry)?.problemId,
  };
}
