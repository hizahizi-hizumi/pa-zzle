import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { NanpureDifficultyView } from "@/views/NanpureDifficultyView";

afterEach(cleanup);

describe("NanpureDifficultyView", () => {
  const difficultyCases = ["1", "2", "3", "4", "5"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <NanpureDifficultyView />
      </MemoryRouter>,
    );
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { name: "ナンプレ" });

    expect(heading).toBeTruthy();
  });

  test.each(difficultyCases)(
    "レベル %s を選ぶとその難易度のプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", {
        name: new RegExp(`^レベル ${difficulty}\\D`),
      });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/nanpure/play/${difficulty}`);
    },
  );

  test("3段階の難易度を選択肢に出さないこと", () => {
    const legacyOption = screen.queryByRole("link", { name: /ふつう/ });

    expect(legacyOption).toBeNull();
  });
});
