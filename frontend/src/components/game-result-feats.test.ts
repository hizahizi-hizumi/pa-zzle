import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import { listGameResultFeats } from "@/components/game-result-feats";
import type { ScoreItem } from "@/games/score";

function scoreItem(
  item: ScoreItem,
  points: number,
  maximum: number,
): GameResultDetailMetric {
  return {
    label: item,
    value: `${points} / ${maximum}`,
    scoreItem: { item, points, maximum },
  };
}

describe("listGameResultFeats", () => {
  describe("最短手数で完成させ、正確さと安定性が満点の場合", () => {
    const metrics: GameResultMetric[] = [
      {
        label: "手数",
        value: "18手",
        comparison: { basis: "minimumMoves", difference: 0, display: "±0" },
      },
    ];
    const scoreBreakdown = [
      scoreItem("accuracy", 40, 40),
      scoreItem("speed", 14, 40),
      scoreItem("stability", 20, 20),
    ];

    test("3つの称号を出すこと", () => {
      const feats = listGameResultFeats({ metrics, scoreBreakdown });

      expect(feats).toEqual(["最短手！", "ノーミス！", "待ったなし！"]);
    });
  });

  describe("最短手数を超え、正確さが満点でなく、速さと効率だけが満点の場合", () => {
    const metrics: GameResultMetric[] = [
      {
        label: "手数",
        value: "22手",
        comparison: { basis: "minimumMoves", difference: 4, display: "+4" },
      },
      {
        label: "時間",
        value: "00:30",
        comparison: {
          basis: "referenceTime",
          difference: -10_000,
          display: "-00:10",
        },
      },
    ];
    const scoreBreakdown = [
      scoreItem("accuracy", 35, 40),
      scoreItem("speed", 40, 40),
      scoreItem("efficiency", 60, 60),
    ];

    test("称号を出さないこと", () => {
      const feats = listGameResultFeats({ metrics, scoreBreakdown });

      expect(feats).toEqual([]);
    });
  });

  describe("採点の観点を持たない内訳の行だけの場合", () => {
    const scoreBreakdown: GameResultDetailMetric[] = [
      { label: "基準時間", value: "00:41.0" },
    ];

    test("称号を出さないこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual([]);
    });
  });
});
