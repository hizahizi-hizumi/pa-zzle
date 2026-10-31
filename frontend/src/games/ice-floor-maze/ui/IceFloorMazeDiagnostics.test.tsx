import { cleanup, render, screen } from "@testing-library/react";

import type { IceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import { IceFloorMazeDiagnostics } from "@/games/ice-floor-maze/ui/IceFloorMazeDiagnostics";

const features = {
  optimalMoveCount: 7,
  optimalSolutionCount: 2,
  reachableStopCount: 42,
  approachPlanningDepth: 5,
  alignPlanningDepth: null,
  trialMoveCount: 26,
  detourMoveCount: 1,
  goalPassingStopCount: 3,
  deadStopCount: 4,
};

const snapshot: IceFloorMazeDiagnosticSnapshot = {
  formatVersion: 1,
  game: "ice-floor-maze",
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "1",
    seed: "8000000000000000000000000000000000000000002-9-63",
    conditions: { width: 12, height: 14 },
  },
  difficultyAssessment: {
    status: "classified",
    difficulty: "5",
    planningDepth: 5,
  },
  difficultyAnalysis: {
    status: "analyzed",
    shape: { width: 12, height: 14 },
    planningDepth: 5,
    strategies: ["approach"],
    features,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("IceFloorMazeDiagnostics", () => {
  describe("分類できた問題の場合", () => {
    beforeEach(() => {
      render(<IceFloorMazeDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    });

    test("難易度・seed・盤面の形を共通ダイアログへ表示すること", () => {
      const values = ["難易度", "seed", "生成条件"].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        snapshot.problemIdentity.seed,
        "12×14",
      ]);
    });

    test("分類と、計画深さとそれを与えた方針・方針別の計画深さ・試行手数を表示すること", () => {
      const values = ["分類", "計画深さ", "方針別", "試行手数"].map(
        getRowValue,
      );

      expect(values).toEqual([
        "レベル 5",
        "5（近づく）",
        "近づく 5 / 揃える 解けない",
        "26",
      ]);
    });

    test("最少手数と道筋の数・到達できる停止点・詰み・ゴールの通過・遠回りを表示すること", () => {
      const values = [
        "最少手数",
        "到達停止点",
        "詰みの停止点",
        "ゴール通過",
        "遠回り",
      ].map(getRowValue);

      expect(values).toEqual(["7（道筋 2）", "42", "4", "3", "1"]);
    });
  });

  describe("評価不能の問題の場合", () => {
    const unsupportedSnapshot: IceFloorMazeDiagnosticSnapshot = {
      ...snapshot,
      difficultyAssessment: {
        status: "unsupported",
        reason: "planning-depth-limit-exceeded",
      },
      difficultyAnalysis: {
        status: "unsupported",
        reason: "planning-depth-limit-exceeded",
        shape: { width: 12, height: 14 },
        features: {
          ...features,
          approachPlanningDepth: null,
        },
      },
    };

    beforeEach(() => {
      render(
        <IceFloorMazeDiagnostics
          snapshot={unsupportedSnapshot}
          onClose={vi.fn()}
        />,
      );
    });

    test("評価不能と示し、計画深さの行を出さずに方針別の結果を表示すること", () => {
      const assessment = getRowValue("分類");
      const planningDepthRow = screen.queryByText("計画深さ");
      const strategies = getRowValue("方針別");

      expect(assessment).toBe("評価不能（読み手数の上限超え）");
      expect(planningDepthRow).toBeNull();
      expect(strategies).toBe("近づく 解けない / 揃える 解けない");
    });
  });
});
