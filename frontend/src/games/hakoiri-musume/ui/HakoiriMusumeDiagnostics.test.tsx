import { cleanup, render, screen } from "@testing-library/react";

import type { HakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import { HakoiriMusumeDiagnostics } from "@/games/hakoiri-musume/ui/HakoiriMusumeDiagnostics";

/** 横刀立馬の盤面と、その特徴。 */
const snapshot: HakoiriMusumeDiagnosticSnapshot = {
  formatVersion: 1,
  game: "hakoiri-musume",
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "1",
    seed: "vAAvwAAwvhivwssws..s",
    conditions: {},
  },
  difficultyAssessment: { status: "classified", difficulty: "5" },
  difficultyAnalysis: {
    status: "analyzed",
    features: {
      optimalMoveCount: 81,
      preparationLength: 40,
      daughterDetourCount: 2,
      emptyCellCount: 2,
      lureCount: 4,
      daughterMoveCount: 9,
      optimalFirstMoveCount: 4,
      firstMoveCount: 8,
    },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("HakoiriMusumeDiagnostics", () => {
  describe("分類された問題の場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
      );
    });

    test("難易度・seed・盤面の大きさを共通ダイアログへ表示すること", () => {
      const values = ["難易度", "seed", "生成条件"].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        snapshot.problemIdentity.seed,
        "盤面 4×5",
      ]);
    });

    test("分類と、分類に使う特徴・記録だけの特徴を表示すること", () => {
      const values = [
        "分類",
        "準備の長さ",
        "娘の遠回り",
        "空き",
        "最短手数",
        "誘いの局面",
        "娘の手",
        "初手",
      ].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        "40手",
        "2回",
        "2マス",
        "81手",
        "4",
        "9手",
        "8通り（最短 4）",
      ]);
    });
  });

  describe("娘を出口へ運べない問題の場合", () => {
    const invalidSnapshot: HakoiriMusumeDiagnosticSnapshot = {
      ...snapshot,
      difficultyAssessment: { status: "invalid", reason: "unreachable-exit" },
      difficultyAnalysis: { status: "invalid", reason: "unreachable-exit" },
    };

    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics
          snapshot={invalidSnapshot}
          onClose={vi.fn()}
        />,
      );
    });

    test("成立しないと示し、特徴の行を出さないこと", () => {
      const assessment = getRowValue("分類");
      const preparationRow = screen.queryByText("準備の長さ");

      expect(assessment).toBe("成立しない（娘が出口に着けない）");
      expect(preparationRow).toBeNull();
    });
  });

  describe("提供範囲外の問題の場合", () => {
    const outOfRangeSnapshot: HakoiriMusumeDiagnosticSnapshot = {
      ...snapshot,
      difficultyAssessment: {
        status: "out-of-range",
        reason: "unlisted-combination",
      },
    };

    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics
          snapshot={outOfRangeSnapshot}
          onClose={vi.fn()}
        />,
      );
    });

    test("理由を添えて提供範囲外と示すこと", () => {
      const assessment = getRowValue("分類");

      expect(assessment).toBe(
        "提供範囲外（どのレベルの組み合わせにも当たらない）",
      );
    });
  });
});
