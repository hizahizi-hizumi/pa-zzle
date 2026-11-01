import { cleanup, render, screen } from "@testing-library/react";

import type { IceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type {
  IceFloorMazeElementFeatures,
  IceFloorMazeTacticFeatures,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { IceFloorMazeDiagnostics } from "@/games/ice-floor-maze/ui/IceFloorMazeDiagnostics";

const elementFeatures: IceFloorMazeElementFeatures = {
  optimalMoveCount: 15,
  optimalSolutionCount: 1,
  forcedMoveCount: 2,
  reachableStateCount: 552,
  deadStateCount: 400,
  elementCount: 8,
  brittleRockCount: 3,
  thinIceCount: 5,
  usedElementCount: 6,
  decoyCount: 2,
  weakDecoyCount: 0,
  irrelevantElementCount: 0,
  useCount: 5,
  orderDependencyCount: 9,
  orderChain: 4,
  orderTrapCount: 3,
  lureCount: 6,
  solutionRepeatCount: 0,
  nearRepeatCount: 0,
  brittleChainCount: 0,
  looksReading: "unsolvable",
  staticShortcut: false,
  stateReadingDepth: 7,
  hardness: 50.75,
};

const tacticFeatures: IceFloorMazeTacticFeatures = {
  optimalMoveCount: 8,
  optimalSolutionCount: 1,
  forcedMoveCount: 0,
  reachableStopCount: 30,
  deadStopCount: 0,
  tags: ["stopper", "detour"],
  readingDepth: null,
  nearPathCount: 11,
  passLureCount: 0,
  trapLureCount: 0,
  silentTrapLureCount: 0,
  reentryCount: 0,
  detourCount: 1,
  funnelDepth: 1,
  forkCount: 1,
};

const snapshot: IceFloorMazeDiagnosticSnapshot = {
  formatVersion: 1,
  game: "ice-floor-maze",
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "2",
    seed: "50000000000000000000000000000000000000000000000005-9-63",
    conditions: { width: 10, height: 10 },
  },
  difficultyAssessment: {
    status: "classified",
    difficulty: "5",
    composition: "mixed",
  },
  difficultyAnalysis: {
    status: "analyzed",
    shape: { width: 10, height: 10 },
    composition: "mixed",
    features: elementFeatures,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("IceFloorMazeDiagnostics", () => {
  describe("要素のある問題の場合", () => {
    beforeEach(() => {
      render(<IceFloorMazeDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    });

    test("難易度・seed・盤面の形を共通ダイアログへ表示すること", () => {
      const values = ["難易度", "seed", "生成条件"].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        snapshot.problemIdentity.seed,
        "10×10",
      ]);
    });

    test("分類と、要素の種類・難しさの点・要素の数と役割・見た目どおりの読み・読み深さ・順序の依存を表示すること", () => {
      const values = [
        "分類",
        "要素の種類",
        "難しさの点",
        "要素",
        "役割",
        "見た目どおり",
        "読み深さ",
        "順序の依存",
      ].map(getRowValue);

      expect(values).toEqual([
        "レベル 5",
        "もろい岩と薄い氷",
        "50.8",
        "8（もろい岩 3 / 薄い氷 5）",
        "使う 6 / おとり 2 / 弱いおとり 0",
        "解なし",
        "7",
        "組 9 / 連なり 4 / 罠 3",
      ]);
    });

    test("最少手数と解の数・到達できる状態・詰み・一本道を表示すること", () => {
      const values = ["最少手数", "到達状態", "詰み", "一本道"].map(
        getRowValue,
      );

      expect(values).toEqual(["15（解 1）", "552", "400", "2"]);
    });
  });

  describe("氷と岩だけで、採用条件を満たさない問題の場合", () => {
    const tacticSnapshot: IceFloorMazeDiagnosticSnapshot = {
      ...snapshot,
      difficulty: "1",
      difficultyAssessment: {
        status: "out-of-range",
        reason: "unmet-conditions",
        unmetConditions: ["unreadable"],
      },
      difficultyAnalysis: {
        status: "analyzed",
        shape: { width: 8, height: 8 },
        composition: "none",
        features: tacticFeatures,
      },
    };

    beforeEach(() => {
      render(
        <IceFloorMazeDiagnostics snapshot={tacticSnapshot} onClose={vi.fn()} />,
      );
    });

    test("満たさない条件・手筋のタグ・読めないこと・近い別解・到達できる停止点を表示すること", () => {
      const values = [
        "分類",
        "要素の種類",
        "手筋",
        "読み深さ",
        "近い別解",
        "到達停止点",
      ].map(getRowValue);

      expect(values).toEqual([
        "提供範囲外（読めない）",
        "氷と岩",
        "止め石・遠回り",
        "読めない",
        "11",
        "30",
      ]);
    });
  });

  describe("評価不能の問題の場合", () => {
    const unsupportedSnapshot: IceFloorMazeDiagnosticSnapshot = {
      ...snapshot,
      difficultyAssessment: {
        status: "unsupported",
        reason: "state-limit-exceeded",
      },
      difficultyAnalysis: {
        status: "unsupported",
        reason: "state-limit-exceeded",
        shape: { width: 10, height: 10 },
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

    test("評価不能と示し、特徴と盤面の構造の行を出さないこと", () => {
      const assessment = getRowValue("分類");
      const compositionRow = screen.queryByText("要素の種類");
      const moveCountRow = screen.queryByText("最少手数");

      expect(assessment).toBe("評価不能（状態の数の上限超え）");
      expect(compositionRow).toBeNull();
      expect(moveCountRow).toBeNull();
    });
  });
});
