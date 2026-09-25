import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import { readPlayRecords } from "@/records/storage";
import { TakuzuPlayView } from "@/views/TakuzuPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "takuzu-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/takuzu/play/:difficulty"
          element={<TakuzuPlayView />}
        />
        <Route path="/puzzles/takuzu" element={<p>難易度選択画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TakuzuPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/1");
    });

    test("8×8 の盤面を持つプレイ画面を表示すること", () => {
      const cells = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(64);
      expect(screen.queryByText("この難易度は選べません")).toBeNull();
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
      });

      test("別の問題を選べること", () => {
        const result = screen.queryByRole("menuitem", { name: "別の問題" });

        expect(result).not.toBeNull();
      });

      test("難易度変更で難易度選択画面へ移ること", () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

        expect(screen.getByText("難易度選択画面")).toBeTruthy();
      });

      test("内部診断を使えない環境ではメニューに検証情報を出さないこと", () => {
        const result = screen.queryByRole("menuitem", { name: "検証情報" });

        expect(result).toBeNull();
      });
    });

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });
  });

  describe("盤面を解き終えた場合", () => {
    const { problem } = selectTakuzuProblemForDifficulty("1", problemSeed);

    function listBoardCells(): HTMLElement[] {
      return within(screen.getByRole("group", { name: "盤面" })).getAllByRole(
        "button",
      );
    }

    /** 各空きマスを解のタイルになるまで押す。`correct` なら、A が入る最初の空きマスだけ先に B を置き、最後に直す。 */
    function solve({ givens, solution }: TakuzuProblem, correct = false) {
      const emptyCellIndices = givens.cells.flatMap((cell, cellIndex) =>
        cell === null ? [cellIndex] : [],
      );
      const correctedCellIndex = emptyCellIndices.find(
        (cellIndex) => solution.cells[cellIndex] === "a",
      );
      for (const cellIndex of emptyCellIndices) {
        const pressCount =
          correct && cellIndex === correctedCellIndex
            ? 2
            : solution.cells[cellIndex] === "a"
              ? 1
              : 2;
        for (let press = 0; press < pressCount; press += 1) {
          fireEvent.click(listBoardCells()[cellIndex] as HTMLElement);
        }
      }
      if (correct && correctedCellIndex !== undefined) {
        // B → 空き → A と、置いたタイルを後から直す。
        fireEvent.click(listBoardCells()[correctedCellIndex] as HTMLElement);
        fireEvent.click(listBoardCells()[correctedCellIndex] as HTMLElement);
      }
    }

    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/1");
      solve(problem, true);
    });

    test("結果画面で置き直しの回数を示すこと", () => {
      const metrics = screen.getByText("置き直し").closest("dl");

      expect(screen.getByRole("heading", { name: "プレイ結果" })).toBeTruthy();
      expect(metrics?.textContent).toContain("置き直し1回");
    });

    test("遊んだ問題とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "takuzu",
        payload: {
          difficulty: "1",
          performance: { correctionCount: 1, restartCount: 0 },
        },
      });
    });

    test("記録を確認で記録画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

      expect(screen.getByText("記録画面")).toBeTruthy();
    });

    describe("同じ問題を置き直しなしで解き直した場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
        solve(problem);
      });

      test("置き直しの自己ベスト更新を知らせること", () => {
        const bestUpdate = screen.getByRole("region", {
          name: "自己ベスト更新",
        });

        expect(bestUpdate.textContent).toContain("置き直し");
        expect(bestUpdate.textContent).toContain("1回減");
      });
    });
  });

  describe("内部診断を使える環境の場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/takuzu/play/2");
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(within(dialog).getByText("難易度 2")).toBeTruthy();
      expect(within(dialog).getByText(/^tk-/)).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/takuzu");
    });
  });
});
