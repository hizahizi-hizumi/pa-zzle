import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import type { ScoreItem } from "@/games/score";

// 正確さと安定性は、減点される操作が1回でもあれば満点にならないので、満点ならその操作が無かったと言える。
// 速さは基準時間を少し超えても丸めで満点になりうるので、称号にしない。
const featsByFullScoreItem: Partial<Record<ScoreItem, string>> = {
  accuracy: "ノーミス！",
  stability: "待ったなし！",
};

export const MINIMUM_MOVES_FEAT = "最短手！";

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
  return feats;
}
