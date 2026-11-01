import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { difficultyLevels } from "@/games/difficulty";

import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import { HitofudePuzzleDifficultyView } from "@/views/HitofudePuzzleDifficultyView";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("HitofudePuzzleDifficultyView", () => {
  const difficultyCases = difficultyLevels.map(({ id }) => id);

  beforeEach(() => {
    render(
      <MemoryRouter>
        <HitofudePuzzleDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", {
      name: HITOFUDE_PUZZLE_DISPLAY_NAME,
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

      expect(href).toBe(`/puzzles/hitofude-puzzle/play/${difficulty}`);
    },
  );

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });
});
