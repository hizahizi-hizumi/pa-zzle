import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { MinesweeperDifficultyReviewPlayView } from "./MinesweeperDifficultyReviewPlayView";

afterEach(cleanup);

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/minesweeper/difficulty-review/play"
          element={<MinesweeperDifficultyReviewPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MinesweeperDifficultyReviewPlayView", () => {
  describe("復元できる問題の場合", () => {
    beforeEach(() => {
      renderAt(
        "/puzzles/minesweeper/difficulty-review/play?seed=ms-10x10-15-125&rows=10&columns=10&mines=15&start=random&attempt=1",
      );
    });

    test("指定した盤面の大きさでプレイ画面を表示すること", () => {
      const board = screen.getByRole("group", { name: "マインスイーパー盤面" });

      const cells = within(board).getAllByRole("button");

      expect(cells).toHaveLength(100);
      expect(screen.queryByText("この問題は復元できません")).toBeNull();
    });
  });

  describe("復元できない問題の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/difficulty-review/play?seed=a");
    });

    test("復元できないことを示し確認一覧へ戻る導線を出すこと", () => {
      const message = screen.getByText("この問題は復元できません");
      const backLink = screen.getByRole("link", {
        name: "難易度の確認へ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe(
        "/puzzles/minesweeper/difficulty-review",
      );
    });
  });
});
