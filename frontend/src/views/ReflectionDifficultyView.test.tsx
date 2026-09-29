import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { reflectionDifficulties } from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { ReflectionDifficultyView } from "@/views/ReflectionDifficultyView";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ReflectionDifficultyView", () => {
  const difficultyCases = reflectionDifficulties.map(({ id }) => id);

  beforeEach(() => {
    render(
      <MemoryRouter>
        <ReflectionDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", {
      name: REFLECTION_DISPLAY_NAME,
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

      expect(href).toBe(`/puzzles/reflection/play/${difficulty}`);
    },
  );

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "← 戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });
});
