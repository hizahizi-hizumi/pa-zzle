import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import {
  PLAY_OPERATION_LABELS,
  type PlayOperation,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import type {
  PlayScore,
  ScoreItem,
  ScoreMaximums,
  SpeedScoreRule,
} from "@/games/score";
import {
  formatElapsedTime,
  formatElapsedTimeWithTenths,
} from "@/lib/format-elapsed-time";
import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";

export type GameResultCountUnit = "回" | "手" | "個" | "本" | "台" | "マス";

/** 基準時間は秒未満を含む式から求まるので、全ゲームで1/10秒まで示す。 */
export function formatScoreReferenceTime(milliseconds: number): string {
  return formatElapsedTimeWithTenths(milliseconds);
}

export function createCountMetric(
  label: string,
  count: number,
  unit: GameResultCountUnit,
  recordMetricId?: string,
): GameResultMetric & GameResultDetailMetric {
  return { label, value: `${count}${unit}`, recordMetricId };
}

export function createOperationCountMetric(
  operation: PlayOperation,
  count: number,
): GameResultMetric & GameResultDetailMetric {
  return createCountMetric(PLAY_OPERATION_LABELS[operation], count, "回");
}

export function createElapsedTimeMetric({
  elapsedMs,
  timeDeltaMs,
}: {
  elapsedMs: number;
  timeDeltaMs: number;
}): GameResultMetric {
  return {
    label: "時間",
    recordMetricId: "time-delta-ms",
    value: formatElapsedTime(elapsedMs),
    comparison: {
      basis: "referenceTime",
      difference: timeDeltaMs,
      display: formatElapsedTimeDelta(timeDeltaMs),
    },
  };
}

export function createMoveCountMetric({
  moveCount,
  moveDelta,
}: {
  moveCount: number;
  moveDelta: number;
}): GameResultMetric {
  return {
    ...createCountMetric("手数", moveCount, "手"),
    recordMetricId: "move-delta",
    comparison: {
      basis: "minimumMoves",
      difference: moveDelta,
      display: formatCountDelta(moveDelta),
    },
  };
}

export function createSpeedFullScoreMetric({
  fullScoreMs,
}: SpeedScoreRule): GameResultDetailMetric {
  return { label: "基準時間", value: formatScoreReferenceTime(fullScoreMs) };
}

export function listScoreBreakdownMetrics<Item extends ScoreItem>(
  score: PlayScore<Item>,
  maximumsInDisplayOrder: ScoreMaximums<Item>,
): GameResultDetailMetric[] {
  const items = Object.keys(maximumsInDisplayOrder) as Item[];
  return items.map((item) => ({
    label: SCORE_ITEM_LABELS[item],
    value: `${score.breakdown[item]} / ${maximumsInDisplayOrder[item]}`,
  }));
}
