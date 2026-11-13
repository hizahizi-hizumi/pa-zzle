import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import { listGameResultFeats } from "@/components/game-result-feats";
import type { PlayOperation } from "@/games/play-vocabulary";
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

function operationCount(
  operation: PlayOperation,
  count: number,
): GameResultDetailMetric {
  return {
    label: operation,
    value: `${count}回`,
    operationCount: { operation, count },
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

  describe("安定性を採点せず、待ったも盤面を戻すも使わなかった場合", () => {
    const scoreBreakdown = [
      scoreItem("accuracy", 40, 40),
      operationCount("undo", 0),
      operationCount("restart", 0),
    ];

    test("ノーミスに続けて待ったなしの称号を出すこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual(["ノーミス！", "待ったなし！"]);
    });
  });

  describe("安定性を採点せず、待ったを使った場合", () => {
    const scoreBreakdown = [
      operationCount("undo", 2),
      operationCount("restart", 0),
    ];

    test("待ったなしの称号を出さないこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual([]);
    });
  });

  describe("安定性を採点せず、盤面を戻した場合", () => {
    const scoreBreakdown = [
      operationCount("undo", 0),
      operationCount("restart", 1),
    ];

    test("待ったなしの称号を出さないこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual([]);
    });
  });

  describe("待ったの無いゲームの場合", () => {
    const scoreBreakdown = [operationCount("restart", 0)];

    test("待ったなしの称号を出さないこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual([]);
    });
  });

  describe("安定性が満点で、待ったの数も0の場合", () => {
    const scoreBreakdown = [
      scoreItem("stability", 20, 20),
      operationCount("undo", 0),
    ];

    test("待ったなしの称号を1つだけ出すこと", () => {
      const feats = listGameResultFeats({ metrics: [], scoreBreakdown });

      expect(feats).toEqual(["待ったなし！"]);
    });
  });
});
