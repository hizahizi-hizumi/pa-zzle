import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { TsumeShogiDifficultyView } from "@/views/TsumeShogiDifficultyView";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("TsumeShogiDifficultyView", () => {
  const difficultyCases = tsumeShogiDifficulties.map(({ id }) => id);

  beforeEach(() => {
    render(
      <MemoryRouter>
        <TsumeShogiDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", {
      name: TSUME_SHOGI_DISPLAY_NAME,
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

      expect(href).toBe(`/puzzles/tsume-shogi/play/${difficulty}`);
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
