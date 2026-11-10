import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import { createCountMetric } from "@/components/game-result-metrics";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import { formatCountDelta } from "@/lib/format-performance-delta";

/**
 * 架けた・外した操作の回数を、解に要る橋の本数（1回の操作で1本ずつ架けるので、最短で解き切る操作の回数）と比べて示す。
 * 差は架け直しの分なので、回数だけを出すより、どれだけ迷わず架けたかが読める。点には使わない。
 */
export function createBridgesOperationMetric({
  inputCount,
  workload,
}: Pick<BridgesResult, "inputCount" | "workload">): GameResultMetric {
  const difference = inputCount - workload.bridgeCount;
  return {
    ...createCountMetric("橋の操作", inputCount, "回"),
    comparison: {
      basis: "minimumMoves",
      difference,
      display: formatCountDelta(difference),
    },
  };
}
