import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import type { ScoreItem } from "@/games/score";

const NO_UNDO_FEAT = "待ったなし！";

// 正確さと安定性は、減点される操作が1回でもあれば満点にならないので、満点ならその操作が無かったと言える。
// 速さは基準時間を少し超えても丸めで満点になりうるので、称号にしない。
const featsByFullScoreItem: Partial<Record<ScoreItem, string>> = {
  accuracy: "ノーミス！",
  stability: NO_UNDO_FEAT,
};

/** 安定性を採点しないゲームでも、待ったと盤面を戻すを1回も使わなかったことは数から言える。 */
function hasUsedNoUndo(
  scoreBreakdown: readonly GameResultDetailMetric[],
): boolean {
  const counts = new Map(
    scoreBreakdown.flatMap(({ operationCount }) =>
      operationCount
        ? [[operationCount.operation, operationCount.count] as const]
        : [],
    ),
  );
  return counts.get("undo") === 0 && (counts.get("restart") ?? 0) === 0;
}

const MINIMUM_MOVES_FEAT = "最短手！";

export function listGameResultFeats({
  metrics,
  scoreBreakdown,
}: {
  metrics: readonly GameResultMetric[];
  scoreBreakdown: readonly GameResultDetailMetric[];
}): string[] {
  const feats: string[] = [];
  if (
    metrics.some(
      ({ comparison }) =>
        comparison?.basis === "minimumMoves" && comparison.difference <= 0,
    )
  ) {
    feats.push(MINIMUM_MOVES_FEAT);
  }
  for (const { scoreItem } of scoreBreakdown) {
    const feat = scoreItem && featsByFullScoreItem[scoreItem.item];
    if (feat && scoreItem.points >= scoreItem.maximum) {
      feats.push(feat);
    }
  }
  if (!feats.includes(NO_UNDO_FEAT) && hasUsedNoUndo(scoreBreakdown)) {
    feats.push(NO_UNDO_FEAT);
  }
  return feats;
}
