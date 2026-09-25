import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { MinesweeperPlayView } from "@/views/MinesweeperPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/minesweeper/play/:difficulty"
          element={<MinesweeperPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MinesweeperPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("プレイ画面を表示すること", () => {
      const backButton = screen.getByRole("button", {
        name: "難易度選択へ戻る",
      });

      expect(backButton).toBeTruthy();
      expect(screen.queryByText("この難易度は選べません")).toBeNull();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/minesweeper");
    });
  });

  describe("内部診断を使えない環境の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("メニューに検証情報を出さないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );

      expect(screen.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
    });
  });
});
