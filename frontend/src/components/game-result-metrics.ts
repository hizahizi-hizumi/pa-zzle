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

/** 結果画面で数を示すときの単位。数には必ず単位を付ける。 */
export type GameResultCountUnit = "回" | "手" | "個" | "本" | "台" | "マス";

/** 採点基準の時間。基準時間は秒未満を含む式から求まるので、全ゲームで1/10秒まで示す。 */
export function formatScoreReferenceTime(milliseconds: number): string {
  return formatElapsedTimeWithTenths(milliseconds);
}

export function createCountMetric(
  label: string,
  count: number,
  unit: GameResultCountUnit,
): GameResultMetric & GameResultDetailMetric {
  return { label, value: `${count}${unit}` };
}

/** プレイ中の操作を使った回数。呼び名は操作の共通の呼び名に揃える。 */
export function createOperationCountMetric(
  operation: PlayOperation,
  count: number,
): GameResultMetric & GameResultDetailMetric {
  return createCountMetric(PLAY_OPERATION_LABELS[operation], count, "回");
}

/** クリアまでの時間と、基準時間との差。 */
export function createElapsedTimeMetric({
  elapsedMs,
  timeDeltaMs,
}: {
  elapsedMs: number;
  timeDeltaMs: number;
}): GameResultMetric {
  return {
    label: "時間",
    value: formatElapsedTime(elapsedMs),
    detail: `基準 ${formatElapsedTimeDelta(timeDeltaMs)}`,
  };
}

/** クリアまでの手数と、最短手数との差。 */
export function createMoveCountMetric({
  moveCount,
  moveDelta,
}: {
  moveCount: number;
  moveDelta: number;
}): GameResultMetric {
  return {
    ...createCountMetric("手数", moveCount, "手"),
    detail: `最短 ${formatCountDelta(moveDelta)}`,
  };
}

export function createSpeedFullScoreMetric({
  fullScoreMs,
}: SpeedScoreRule): GameResultDetailMetric {
  return { label: "基準時間", value: formatScoreReferenceTime(fullScoreMs) };
}

/** 評価項目ごとの点と満点。満点の並び順に並べる。 */
export function listScoreBreakdownMetrics<Item extends ScoreItem>(
  score: PlayScore<Item>,
  maximums: ScoreMaximums<Item>,
): GameResultDetailMetric[] {
  const items = Object.keys(maximums) as Item[];
  return items.map((item) => ({
    label: SCORE_ITEM_LABELS[item],
    value: `${score.breakdown[item]} / ${maximums[item]}`,
  }));
}
