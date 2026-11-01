import { cleanup, render, screen } from "@testing-library/react";

import type { TsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";

const snapshot: TsumeShogiDiagnosticSnapshot = {
  formatVersion: 1,
  game: "tsume-shogi",
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "1",
    seed: "ts-5-c6-99-4",
    conditions: { plies: 5, rootChecks: { minimum: 6, maximum: 99 } },
  },
  problemPool: { poolVersion: "1", problemId: "4-2" },
  problem: {
    sfen: "3+R2s2/8k/6SR1/9/9/9/9/9/9 b 2b4g2s4n4l18p 1",
    mainLine: ["2c2a+", "1b2a", "6a3a", "2a3a", "S*3b"],
  },
  difficultyFeatures: {
    rootChecks: 10,
    plausibleWrong: 6,
    deepDecoyCount: 4,
    defenseBranching: 2,
    tesujiKindCount: 3,
    decisions: [
      {
        remainingPlies: 5,
        checkCount: 10,
        plausibleWrongCount: 5,
        deepDecoyCount: 4,
      },
      {
        remainingPlies: 3,
        checkCount: 4,
        plausibleWrongCount: 1,
        deepDecoyCount: 0,
      },
      {
        remainingPlies: 1,
        checkCount: 2,
        plausibleWrongCount: 0,
        deepDecoyCount: 0,
      },
    ],
    motifs: {
      drop: 1,
      promotion: 1,
      nonPromotion: 0,
      capture: 1,
      sacrifice: 1,
      discoveredCheck: 0,
      distantCheck: 1,
    },
  },
  difficultyAssessment: {
    status: "classified",
    difficulty: "4",
    deepDecoyCount: 4,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("TsumeShogiDiagnostics", () => {
  describe("問題集から出した問題の場合", () => {
    beforeEach(() => {
      render(<TsumeShogiDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    });

    test("詰将棋固有の再現情報を共通ダイアログへ表示すること", () => {
      const values = ["難易度", "生成条件"].map(getRowValue);

      expect(values).toEqual(["レベル 4", "5手 / 初手の王手 6〜99"]);
      expect(screen.getByText("ts-5-c6-99-4")).toBeTruthy();
    });

    test("問題集の版と番号・分類・特徴・判断地点ごとの内訳を表示すること", () => {
      const values = [
        "問題集",
        "分類",
        "王手/紛れ/深",
        "変化/手筋",
        "判断地点",
      ].map(getRowValue);

      expect(values).toEqual([
        "v1 / 4-2",
        "レベル 4",
        "10 / 6 / 4",
        "2 / 3",
        "残5: 10/5/4, 残3: 4/1/0, 残1: 2/0/0",
      ]);
    });

    test("初期局面と作意を表示すること", () => {
      const values = ["SFEN", "作意"].map(getRowValue);

      expect(values).toEqual([
        "3+R2s2/8k/6SR1/9/9/9/9/9/9 b 2b4g2s4n4l18p 1",
        "2c2a+ 1b2a 6a3a 2a3a S*3b",
      ]);
    });
  });

  describe("起点を絞った生成条件の問題の場合", () => {
    beforeEach(() => {
      render(
        <TsumeShogiDiagnostics
          snapshot={{
            ...snapshot,
            problemIdentity: {
              generatorVersion: "1",
              seed: "ts-3-c1-4-move-mid-7",
              conditions: {
                plies: 3,
                rootChecks: { minimum: 1, maximum: 4 },
                baseMate: "board-move",
                baseKingArea: "middle",
              },
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("起点の詰め手の種類と玉の範囲を生成条件に表示すること", () => {
      const value = getRowValue("生成条件");

      expect(value).toBe(
        "3手 / 初手の王手 1〜4 / 盤上の駒を動かす1手詰から / 盤の中ほどの玉から",
      );
    });
  });

  describe("分析できない問題の場合", () => {
    beforeEach(() => {
      render(
        <TsumeShogiDiagnostics
          snapshot={{
            ...snapshot,
            difficultyFeatures: null,
            difficultyAssessment: { status: "unsupported" },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    test("評価不能と分析できないことを表示すること", () => {
      const values = ["分類", "特徴"].map(getRowValue);

      expect(values).toEqual(["評価不能", "分析できない"]);
    });
  });
});
