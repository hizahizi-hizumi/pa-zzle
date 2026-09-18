import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { GameSelectionGallery } from "@/components/GameSelectionGallery";

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="water-sort" />',
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="sudoku" />',
    to: "/games/sudoku",
  },
] as const;

afterEach(cleanup);

function renderGallery() {
  return render(
    <MemoryRouter>
      <GameSelectionGallery games={games} />
    </MemoryRouter>,
  );
}

test("最初のパズルをヒーローとして表示すること", () => {
  renderGallery();

  const heroLink = screen.getByRole("link", {
    name: "ウォーターソートを遊ぶ",
  });

  expect(heroLink.getAttribute("href")).toBe("/games/water-sort");
  expect(heroLink.querySelector('svg[data-game="water-sort"]')).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "ウォーターソートを選択" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

test("候補を選ぶとヒーローを切り替えること", () => {
  renderGallery();
  const sudokuButton = screen.getByRole("button", { name: "ナンプレを選択" });

  fireEvent.click(sudokuButton);

  const heroLink = screen.getByRole("link", { name: "ナンプレを遊ぶ" });
  expect(heroLink.getAttribute("href")).toBe("/games/sudoku");
  expect(heroLink.querySelector('svg[data-game="sudoku"]')).toBeTruthy();
  expect(sudokuButton.getAttribute("aria-pressed")).toBe("true");
});
