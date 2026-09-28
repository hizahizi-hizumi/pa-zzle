import { cleanup, render, screen } from "@testing-library/react";

import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";

const snapshot: ReflectionDiagnosticSnapshot = {
  formatVersion: 1,
  game: "reflection",
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "2",
    seed: "rf-7-8-0",
    conditions: { size: 7, pieceCount: 8 },
  },
  problemPool: { poolVersion: "1", problemId: "4-17" },
  difficultyAssessment: {
    status: "classified",
    difficulty: "4",
    reasoningLevel: 4,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("ReflectionDiagnostics", () => {
  describe("問題集から出した問題の場合", () => {
    beforeEach(() => {
      render(<ReflectionDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    });

    test("リフレクション固有の診断値を共通ダイアログへ表示すること", () => {
      expect(getRowValue("難易度")).toBe("レベル 4");
      expect(screen.getByText("rf-7-8-0")).toBeTruthy();
      expect(screen.getByText("7×7 / 8ピース")).toBeTruthy();
    });

    test("問題集の版と番号・分類・最高推論レベルを表示すること", () => {
      const values = ["問題集", "分類", "最高推論"].map(getRowValue);

      expect(values).toEqual(["v1 / 4-17", "レベル 4", "L4"]);
    });
  });

  describe("5段階の出題に無い大きさのサンプルを指定した場合", () => {
    beforeEach(() => {
      render(
        <ReflectionDiagnostics
          snapshot={{
            ...snapshot,
            problemIdentity: {
              generatorVersion: "2",
              seed: "rf-9-12-3",
              conditions: { size: 9, pieceCount: 12 },
            },
            problemPool: null,
            difficultyAssessment: {
              status: "not-analyzed",
              reason: "sample-board-size",
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("分析しないことを表示すること", () => {
      const values = ["問題集", "分類", "最高推論"].map(getRowValue);

      expect(values).toEqual([
        "問題集に無い",
        "分析しない（通常の出題に無い大きさのサンプル）",
        "取得なし",
      ]);
    });
  });

  describe("問題集に無く、提供範囲外の問題を指定した場合", () => {
    beforeEach(() => {
      render(
        <ReflectionDiagnostics
          snapshot={{
            ...snapshot,
            problemPool: null,
            difficultyAssessment: {
              status: "out-of-range",
              reason: "unlisted-combination",
              reasoningLevel: 2,
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("問題集に無いことと範囲外の分類を表示すること", () => {
      const values = ["問題集", "分類", "最高推論"].map(getRowValue);

      expect(values).toEqual([
        "問題集に無い",
        "提供範囲外（組み合わせ外）",
        "L2",
      ]);
    });
  });
});
