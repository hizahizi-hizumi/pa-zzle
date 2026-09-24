import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { FifteenPuzzleDifficultyView } from "@/views/FifteenPuzzleDifficultyView";

afterEach(cleanup);

describe("FifteenPuzzleDifficultyView", () => {
  const difficultyCases = ["1", "2", "3", "4", "5"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <FifteenPuzzleDifficultyView />
      </MemoryRouter>,
    );
  });

  test.each(difficultyCases)(
    "レベル %s を選ぶとそのレベルのプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", { name: `レベル ${difficulty}` });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/fifteen-puzzle/play/${difficulty}`);
    },
  );

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "← 戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });
});
