import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { PuzzleSelectionView } from "@/views/PuzzleSelectionView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(cleanup);

describe("PuzzleSelectionView", () => {
  const games = [
    ["ウォーターソート", "/puzzles/water-sort"],
    ["ナンプレ", "/puzzles/nanpure"],
    ["マインスイーパー", "/puzzles/minesweeper"],
    ["パーキングジャム", "/puzzles/parking-jam"],
    ["スライドパズル", "/puzzles/slide-puzzle"],
    ["バイナリパズル", "/puzzles/takuzu"],
    [REFLECTION_DISPLAY_NAME, "/puzzles/reflection"],
    [TSUME_SHOGI_DISPLAY_NAME, "/puzzles/tsume-shogi"],
  ] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <PuzzleSelectionView />
      </MemoryRouter>,
    );
  });

  test("パズルを決まった順に並べること", () => {
    const selectButtons = screen.getAllByRole("button", { name: /を選択$/ });

    expect(
      selectButtons.map((button) => button.getAttribute("aria-label")),
    ).toEqual(games.map(([name]) => `${name}を選択`));
  });

  test.each(games)("%sを選択してその入口へ進めること", (name, entryPath) => {
    const selectButton = screen.getByRole("button", { name: `${name}を選択` });

    fireEvent.click(selectButton);

    const heroLink = screen.getByRole("link", { name: `${name}を遊ぶ` });
    expect(heroLink.getAttribute("href")).toBe(entryPath);
    expect(selectButton.getAttribute("aria-pressed")).toBe("true");
  });
});
