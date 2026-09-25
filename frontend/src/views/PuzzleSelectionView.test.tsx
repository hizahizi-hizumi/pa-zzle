import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { PuzzleSelectionView } from "@/views/PuzzleSelectionView";

afterEach(cleanup);

describe("PuzzleSelectionView", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <PuzzleSelectionView />
      </MemoryRouter>,
    );
  });

  test("マインスイーパーを選択して難易度選択へ進めること", () => {
    const minesweeperButton = screen.getByRole("button", {
      name: "マインスイーパーを選択",
    });

    fireEvent.click(minesweeperButton);

    const heroLink = screen.getByRole("link", {
      name: "マインスイーパーを遊ぶ",
    });
    expect(heroLink.getAttribute("href")).toBe("/puzzles/minesweeper");
    expect(minesweeperButton.getAttribute("aria-pressed")).toBe("true");
  });
});
