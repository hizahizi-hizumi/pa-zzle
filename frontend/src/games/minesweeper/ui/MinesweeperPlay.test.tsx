import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";

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
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={0}
          elapsedMs={0}
          visibleCells={visibleCells}
          status="playing"
          onRevealCell={onRevealCell}
          onToggleFlag={onToggleFlag}
          onChordCell={vi.fn()}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
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
          onRevealCell={vi.fn()}
          onToggleFlag={vi.fn()}
          onChordCell={vi.fn()}
          onReplay={vi.fn()}
          onStartNewProblem={vi.fn()}
          onChangeDifficulty={vi.fn()}
          onBackToHome={vi.fn()}
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
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={1}
          elapsedMs={65_000}
          visibleCells={visibleCells}
          status="playing"
          onRevealCell={onRevealCell}
          onToggleFlag={onToggleFlag}
          onChordCell={vi.fn()}
          onReplay={vi.fn()}
          onStartNewProblem={vi.fn()}
          onChangeDifficulty={vi.fn()}
          onBackToHome={vi.fn()}
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

  describe("クリア後の場合", () => {
    const visibleCells: readonly MinesweeperVisibleCell[] = [
      { state: "mine" },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
      { state: "revealed", adjacentMineCount: 1 },
    ];

    beforeEach(() => {
      render(
        <MinesweeperPlay
          rows={2}
          columns={2}
          mineCount={1}
          flagCount={0}
          mistakeCount={0}
          elapsedMs={0}
          visibleCells={visibleCells}
          status="cleared"
          onRevealCell={vi.fn()}
          onToggleFlag={vi.fn()}
          onChordCell={vi.fn()}
          onReplay={vi.fn()}
          onStartNewProblem={vi.fn()}
          onChangeDifficulty={vi.fn()}
          onBackToHome={vi.fn()}
        />,
      );
    });

    test("旗モード切替を表示しないこと", () => {
      const toggle = screen.queryByRole("button", { name: "旗モード" });

      expect(toggle).toBeNull();
    });

    test("クリアを表示すること", () => {
      const status = screen.queryByText("クリア");

      expect(status).not.toBeNull();
    });
  });
});
