import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import type { MinesweeperVisibleCell } from "../session/session";
import { MinesweeperPlay } from "./MinesweeperPlay";
import { minesweeperPlayRecordDisplay } from "./play-record-display";

afterEach(cleanup);

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("MinesweeperPlay", () => {
  describe("プレイ中の場合", () => {
    const visibleCells: readonly MinesweeperVisibleCell[] = [
      { state: "hidden" },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "hidden" },
      { state: "hidden" },
    ];
    let onToggleFlag: (cellIndex: number) => void;
    let onRevealCell: (cellIndex: number) => void;
    let onReplay: () => void;
    let onStartNewProblem: () => void;
    let onChangeDifficulty: () => void;
    let onBackToHome: () => void;

    beforeEach(() => {
      onToggleFlag = vi.fn();
      onRevealCell = vi.fn();
      onReplay = vi.fn();
      onStartNewProblem = vi.fn();
      onChangeDifficulty = vi.fn();
      onBackToHome = vi.fn();
      render(
        <MinesweeperPlay
          difficulty="1"
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={0}
          elapsedMs={0}
          visibleCells={visibleCells}
          status="playing"
          progress="playing"
          result={null}
          recordOutcomeNotice={null}
          onRevealCell={onRevealCell}
          onToggleFlag={onToggleFlag}
          onChordCell={vi.fn()}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={vi.fn()}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    });

    test("左上の戻る操作で難易度選択への移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(onChangeDifficulty).toHaveBeenCalledOnce();
      expect(onBackToHome).not.toHaveBeenCalled();
    });

    test("メニューの難易度変更で難易度選択への移動を通知すること", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(onChangeDifficulty).toHaveBeenCalledOnce();
      expect(onBackToHome).not.toHaveBeenCalled();
    });

    test("メニューのリセットで同じ問題のやり直しを通知すること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "リセット" }));

      expect(onReplay).toHaveBeenCalledOnce();
      expect(onStartNewProblem).not.toHaveBeenCalled();
    });

    test("メニューの別の問題で新しい問題の開始を通知すること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));

      expect(onStartNewProblem).toHaveBeenCalledOnce();
      expect(onReplay).not.toHaveBeenCalled();
    });

    describe("検証情報を開く操作を渡さない場合", () => {
      test("メニューに検証情報を出さないこと", () => {
        openPlayMenu();

        const item = screen.queryByRole("menuitem", { name: "検証情報" });
        expect(item).toBeNull();
      });
    });

    test("ヘッダーの旗モード切替が初期状態で押されていないこと", () => {
      const toggle = screen.getByRole("button", { name: "旗モード" });

      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });

    test("旗モード切替を押すと旗モードが押された状態になること", () => {
      const toggle = screen.getByRole("button", { name: "旗モード" });

      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-pressed")).toBe("true");
    });

    describe("旗モードの場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "旗モード" }));
      });

      test("未開示マスを押すと旗操作を通知すること", () => {
        fireEvent.click(screen.getByLabelText("マス 1 未開示"));

        expect(onToggleFlag).toHaveBeenCalledWith(0);
        expect(onRevealCell).not.toHaveBeenCalled();
      });

      test("旗モード切替をもう一度押すと開示モードへ戻ること", () => {
        const toggle = screen.getByRole("button", { name: "旗モード" });

        fireEvent.click(toggle);
        fireEvent.click(screen.getByLabelText("マス 1 未開示"));

        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(onRevealCell).toHaveBeenCalledWith(0);
      });

      test("リセットすると開示モードへ戻ること", () => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
        fireEvent.click(screen.getByRole("menuitem", { name: "リセット" }));

        expect(
          screen
            .getByRole("button", { name: "旗モード" })
            .getAttribute("aria-pressed"),
        ).toBe("false");
      });
    });
  });

  describe("検証情報を開く操作を渡した場合", () => {
    let onOpenDiagnostics: () => void;

    beforeEach(() => {
      onOpenDiagnostics = vi.fn();
      render(
        <MinesweeperPlay
          difficulty="1"
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={0}
          elapsedMs={0}
          visibleCells={[
            { state: "hidden" },
            { state: "revealed", adjacentMineCount: 1 },
            { state: "hidden" },
            { state: "hidden" },
          ]}
          status="playing"
          progress="playing"
          result={null}
          recordOutcomeNotice={null}
          onRevealCell={vi.fn()}
          onToggleFlag={vi.fn()}
          onChordCell={vi.fn()}
          onReplay={vi.fn()}
          onStartNewProblem={vi.fn()}
          onOpenRecords={vi.fn()}
          onChangeDifficulty={vi.fn()}
          onBackToHome={vi.fn()}
          onClearAnimationComplete={vi.fn()}
          onOpenDiagnostics={onOpenDiagnostics}
        />,
      );
    });

    test("メニューの検証情報で検証情報を開く操作を通知すること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("地雷を踏んだ後の場合", () => {
    const visibleCells: readonly MinesweeperVisibleCell[] = [
      { state: "steppedMine" },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "hidden" },
      { state: "hidden" },
    ];
    let onRevealCell: (cellIndex: number) => void;
    let onToggleFlag: (cellIndex: number) => void;

    beforeEach(() => {
      onRevealCell = vi.fn();
      onToggleFlag = vi.fn();
      render(
        <MinesweeperPlay
          difficulty="1"
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={1}
          elapsedMs={65_000}
          visibleCells={visibleCells}
          status="playing"
          progress="playing"
          result={null}
          recordOutcomeNotice={null}
          onRevealCell={onRevealCell}
          onToggleFlag={onToggleFlag}
          onChordCell={vi.fn()}
          onReplay={vi.fn()}
          onStartNewProblem={vi.fn()}
          onOpenRecords={vi.fn()}
          onChangeDifficulty={vi.fn()}
          onBackToHome={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
    });

    test("ヘッダーにミス数と経過時間を表示すること", () => {
      const mistakeMetric = screen.getByText("ミス").parentElement;
      const timeMetric = screen.getByText("時間").parentElement;

      expect(mistakeMetric?.textContent).toBe("ミス1");
      expect(timeMetric?.textContent).toBe("時間01:05");
    });

    test("踏んだ地雷を押しても開示も旗操作も通知しないこと", () => {
      const steppedMine = screen.getByRole("button", {
        name: "マス 1 踏んだ地雷",
      });
      fireEvent.click(steppedMine);
      fireEvent.contextMenu(steppedMine);

      expect(onRevealCell).not.toHaveBeenCalled();
      expect(onToggleFlag).not.toHaveBeenCalled();
    });

    test("プレイを続けられること", () => {
      fireEvent.click(screen.getByRole("button", { name: "マス 3 未開示" }));

      expect(onRevealCell).toHaveBeenCalledWith(2);
    });
  });

  describe("クリア演出中の場合", () => {
    const visibleCells: readonly MinesweeperVisibleCell[] = [
      { state: "mine" },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
    ];
    let onRevealCell: (cellIndex: number) => void;

    beforeEach(() => {
      onRevealCell = vi.fn();
      render(
        <MinesweeperPlay
          {...createResultProps()}
          visibleCells={visibleCells}
          progress="clearing"
          onRevealCell={onRevealCell}
        />,
      );
    });

    test("最終盤面を見せて結果画面への遷移を待つこと", () => {
      const resultHeading = screen.queryByRole("heading", {
        name: "プレイ結果",
      });
      const mine = screen.getByRole("button", { name: "マス 1 地雷" });

      expect(resultHeading).toBeNull();
      expect(mine).toBeTruthy();
    });

    test("旗モード切替を表示しないこと", () => {
      const toggle = screen.queryByRole("button", { name: "旗モード" });

      expect(toggle).toBeNull();
    });

    test("盤面の操作を通知しないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: /マス 2/ }));

      expect(onRevealCell).not.toHaveBeenCalled();
    });
  });

  describe("採点結果を表示している場合", () => {
    let onReplay: () => void;
    let onStartNewProblem: () => void;
    let onOpenRecords: () => void;
    let onChangeDifficulty: () => void;
    let onBackToHome: () => void;

    beforeEach(() => {
      onReplay = vi.fn();
      onStartNewProblem = vi.fn();
      onOpenRecords = vi.fn();
      onChangeDifficulty = vi.fn();
      onBackToHome = vi.fn();
      render(
        <MinesweeperPlay
          {...createResultProps()}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
        />,
      );
    });

    test("共通の結果階層で採点結果と主要成績を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "プレイ結果" });
      const pictogram = document.querySelector(
        'svg[aria-label="マインスイーパー"]',
      );
      const difficulty = screen.getByText("難易度 1");
      const score = screen.getByText("77");
      const timeMetric = screen.getByText("時間").parentElement;
      const mistakeMetric = screen.getByText("ミス").parentElement;

      expect(heading).toBeTruthy();
      expect(pictogram).toBeTruthy();
      expect(difficulty).toBeTruthy();
      expect(score).toBeTruthy();
      expect(timeMetric?.textContent).toBe("時間00:25基準 +00:04");
      expect(mistakeMetric?.textContent).toBe("ミス1");
    });

    test("スコアの内訳と採点基準を開けること", () => {
      fireEvent.click(screen.getByText("スコアの内訳・採点基準"));

      expect(screen.getByText("45 / 60")).toBeTruthy();
      expect(screen.getByText("32 / 40")).toBeTruthy();
      expect(screen.getByText(/踏んだ地雷1つにつき15点減点/)).toBeTruthy();
      expect(
        screen.getByText(/5秒 \+ 開く操作の最小2回 × 2秒 \+ 地雷3個 × 4秒/),
      ).toBeTruthy();
    });

    test.each([
      ["プレイ！", "onStartNewProblem"],
      ["同じ問題", "onReplay"],
      ["記録を確認", "onOpenRecords"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const)("%sで対応する次の行動を通知すること", (name, handler) => {
      const handlers = {
        onStartNewProblem,
        onReplay,
        onOpenRecords,
        onChangeDifficulty,
        onBackToHome,
      };

      fireEvent.click(screen.getByRole("button", { name }));

      expect(handlers[handler]).toHaveBeenCalledOnce();
    });

    test("検証情報を開く操作を渡さなければ結果画面に検証情報を出さないこと", () => {
      const diagnostics = screen.queryByRole("button", { name: "検証情報" });

      expect(diagnostics).toBeNull();
    });
  });

  describe("自己ベスト更新がある結果表示の場合", () => {
    beforeEach(() => {
      render(
        <MinesweeperPlay
          {...createResultProps()}
          recordOutcomeNotice={
            <PlayRecordOutcomeNotice
              outcome={{
                status: "updated",
                updates: [
                  {
                    metricId: "time-delta-ms",
                    previousValue: 9_000,
                    currentValue: 4_000,
                  },
                ],
              }}
              display={minesweeperPlayRecordDisplay}
            />
          }
        />,
      );
    });

    test("採点結果に続けて更新した指標と前後の値を表示すること", () => {
      const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

      expect(bestUpdate.textContent).toContain("基準時間との差");
      expect(bestUpdate.textContent).toContain("+00:09");
      expect(bestUpdate.textContent).toContain("+00:04");
      expect(bestUpdate.textContent).toContain("5秒短縮");
    });
  });

  describe("検証情報を開く操作を渡した結果表示の場合", () => {
    let onOpenDiagnostics: () => void;

    beforeEach(() => {
      onOpenDiagnostics = vi.fn();
      render(
        <MinesweeperPlay
          {...createResultProps()}
          onOpenDiagnostics={onOpenDiagnostics}
        />,
      );
    });

    test("結果画面から検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });
});

function createResultProps(): ComponentProps<typeof MinesweeperPlay> {
  return {
    difficulty: "1",
    rows: 2,
    columns: 2,
    mineCount: 1,
    flagCount: 0,
    mistakeCount: 1,
    elapsedMs: 25_000,
    visibleCells: [
      { state: "steppedMine" },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
    ],
    status: "cleared",
    progress: "result",
    result: {
      elapsedMs: 25_000,
      mistakeCount: 1,
      minimumOpenCount: 2,
      mineCount: 3,
      speedFullScoreMs: 21_000,
      timeDeltaMs: 4_000,
      score: { total: 77, breakdown: { accuracy: 45, speed: 32 } },
    },
    recordOutcomeNotice: null,
    onRevealCell: vi.fn(),
    onToggleFlag: vi.fn(),
    onChordCell: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onClearAnimationComplete: vi.fn(),
  };
}
