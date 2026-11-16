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
      shortestPreparationLength: 40,
      daughterDetourCount: 3,
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

    test("難易度・seed・駒の組を共通ダイアログへ表示すること", () => {
      const values = ["難易度", "seed", "生成条件"].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        snapshot.problemIdentity.seed,
        "横長 1個 縦長 4個 小駒 4個",
      ]);
    });

    test("分類と、分類に使う特徴・記録だけの特徴を表示すること", () => {
      const values = [
        "分類",
        "準備の長さ",
        "最短の解の準備",
        "娘の遠回り",
        "空きマス",
        "最短手数",
        "誘いの局面",
        "娘の手",
        "初手",
      ].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        "40手",
        "40手",
        "3回以上",
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

  describe("問題集の値で作った場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics
          snapshot={{
            ...snapshot,
            difficultyAnalysis: {
              status: "pooled",
              features: {
                optimalMoveCount: 42,
                preparationLength: 33,
                emptyCellCount: 2,
              },
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("問題集の値であることと、問題集にある特徴だけを表示すること", () => {
      const values = ["値の出どころ", "準備の長さ", "空きマス", "最短手数"].map(
        getRowValue,
      );
      const detour = screen.queryByText("娘の遠回り");

      expect(values).toEqual([
        "問題集（作るときに分析した値）",
        "33手",
        "2マス",
        "42手",
      ]);
      expect(detour).toBeNull();
    });
  });

  describe("娘の遠回りと最短の解の準備を持つ問題集の値で作った場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics
          snapshot={{
            ...snapshot,
            difficultyAnalysis: {
              status: "pooled",
              features: {
                optimalMoveCount: 42,
                preparationLength: 33,
                shortestPreparationLength: 35,
                daughterDetourCount: 2,
                emptyCellCount: 2,
              },
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("娘の遠回りと最短の解の準備も表示すること", () => {
      const values = ["最短の解の準備", "娘の遠回り"].map(getRowValue);

      expect(values).toEqual(["35手", "2回"]);
    });
  });

  describe("記録した値で作った場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeDiagnostics
          snapshot={{
            ...snapshot,
            difficultyAnalysis: {
              status: "recorded",
              features: {
                optimalMoveCount: 42,
                preparationLength: 33,
                emptyCellCount: 2,
              },
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("記録の値であることと、記録した特徴を表示すること", () => {
      const values = ["値の出どころ", "準備の長さ", "最短手数"].map(
        getRowValue,
      );

      expect(values).toEqual([
        "記録（問題集に無い問題。記録したときの値）",
        "33手",
        "42手",
      ]);
    });
  });
});
