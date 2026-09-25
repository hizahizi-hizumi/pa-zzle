import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { SlidePuzzleDifficultyView } from "@/views/SlidePuzzleDifficultyView";

afterEach(cleanup);

describe("SlidePuzzleDifficultyView", () => {
  const difficultyCases = ["1", "2", "3", "4", "5"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <SlidePuzzleDifficultyView />
      </MemoryRouter>,
    );
  });

  test.each(difficultyCases)(
    "レベル %s を選ぶとそのレベルのプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", { name: `レベル ${difficulty}` });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/slide-puzzle/play/${difficulty}`);
    },
  );

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "← 戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });
});
