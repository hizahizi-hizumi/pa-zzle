import { cleanup, render, screen } from "@testing-library/react";

import type { HakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import { HakoiriMusumeDiagnostics } from "@/games/hakoiri-musume/ui/HakoiriMusumeDiagnostics";

/** 横刀立馬の盤面と、その問題集の値。 */
const snapshot: HakoiriMusumeDiagnosticSnapshot = {
  formatVersion: 1,
  game: "hakoiri-musume",
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "1",
    seed: "vAAvwAAwvhivwssws..s",
    conditions: {},
  },
  difficultyAnalysis: {
    status: "pooled",
    features: {
      optimalMoveCount: 81,
      preparationLength: 40,
      shortestPreparationLength: 40,
      daughterDetourCount: 3,
      emptyCellCount: 2,
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

    test("分類と、問題集の値であることと、問題集にある特徴を表示すること", () => {
      const values = [
        "分類",
        "値の出どころ",
        "準備の長さ",
        "空きマス",
        "最短手数",
        "最短の解の準備",
        "娘の遠回り",
      ].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        "問題集（作るときに分析した値）",
        "40手",
        "2マス",
        "81手",
        "40手",
        "3回以上",
      ]);
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
