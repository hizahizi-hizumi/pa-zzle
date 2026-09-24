import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { MinesweeperPlayView } from "./MinesweeperPlayView";

afterEach(cleanup);

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
});
