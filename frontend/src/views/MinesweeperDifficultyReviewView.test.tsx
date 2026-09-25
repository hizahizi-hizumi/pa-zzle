import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { MinesweeperDifficultyReviewView } from "@/views/MinesweeperDifficultyReviewView";

afterEach(cleanup);

describe("MinesweeperDifficultyReviewView", () => {
  const difficultyNames = [
    "難易度 1",
    "難易度 2",
    "難易度 3",
    "難易度 4",
    "難易度 5",
  ] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <MinesweeperDifficultyReviewView />
      </MemoryRouter>,
    );
  });

  test.each(difficultyNames)("%sの問題を3問並べること", (difficultyName) => {
    const group = screen.getByRole("region", { name: difficultyName });

    const rows = within(group).getAllByRole("link");

    expect(rows).toHaveLength(3);
  });

  test("問題ごとに盤面・必要な推論とプレイへの導線を表示すること", () => {
    const difficulty1 = screen.getByRole("region", { name: "難易度 1" });

    const firstRow = within(difficulty1).getAllByRole("link")[0]!;

    expect(within(firstRow).getByText("9×9・地雷10")).toBeTruthy();
    expect(
      within(firstRow).getByText("数字1つを読むだけで最後まで進める"),
    ).toBeTruthy();
    expect(firstRow.getAttribute("href")).toBe(
      "/puzzles/minesweeper/difficulty-review/play?seed=ms-review-1-9x9-1&rows=9&columns=9&mines=10&start=random&attempt=1",
    );
  });
});
