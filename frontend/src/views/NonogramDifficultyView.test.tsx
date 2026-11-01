import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { difficultyLevels } from "@/games/difficulty";
import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import { NonogramDifficultyView } from "@/views/NonogramDifficultyView";

afterEach(() => {
  cleanup();
});

describe("NonogramDifficultyView", () => {
  const difficultyCases = difficultyLevels.map(({ id }) => id);

  beforeEach(() => {
    render(
      <MemoryRouter>
        <NonogramDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", {
      name: NONOGRAM_DISPLAY_NAME,
    });

    expect(heading).toBeTruthy();
  });

  test.each(difficultyCases)(
    "レベル %s を選ぶとその難易度のプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", {
        name: `レベル ${difficulty}`,
      });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/nonogram/play/${difficulty}`);
    },
  );

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });
});
