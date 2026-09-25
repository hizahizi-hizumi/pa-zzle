import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { TakuzuDifficultyView } from "@/views/TakuzuDifficultyView";

afterEach(cleanup);

describe("TakuzuDifficultyView", () => {
  const difficultyCases = ["1", "2", "3", "4", "5"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <TakuzuDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { name: "バイナリパズル" });

    expect(heading).toBeTruthy();
  });

  test.each(difficultyCases)(
    "難易度 %s を選ぶとその難易度のプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", {
        name: `難易度 ${difficulty}`,
      });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/takuzu/play/${difficulty}`);
    },
  );

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "← 戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });
});
