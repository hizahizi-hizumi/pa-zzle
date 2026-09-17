import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { GameSelectionGallery } from "@/components/GameSelectionGallery";

const games = [
  {
    name: "ウォーターソート",
    pictogramSrc: "/water-sort.svg",
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSrc: "/sudoku.svg",
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
  expect(sudokuButton.getAttribute("aria-pressed")).toBe("true");
});
