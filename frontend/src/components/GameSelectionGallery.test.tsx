import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { GameSelectionGallery } from "@/components/GameSelectionGallery";

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="water-sort" />',
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="nanpure" />',
    to: "/games/nanpure",
  },
] as const;

afterEach(cleanup);

function renderGallery() {
  return render(
    <MemoryRouter>
      <GameSelectionGallery games={games} recordsTo="/records" />
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
  const nanpureButton = screen.getByRole("button", { name: "ナンプレを選択" });

  fireEvent.click(nanpureButton);

  const heroLink = screen.getByRole("link", { name: "ナンプレを遊ぶ" });
  expect(heroLink.getAttribute("href")).toBe("/games/nanpure");
  expect(heroLink.querySelector('svg[data-game="nanpure"]')).toBeTruthy();
  expect(nanpureButton.getAttribute("aria-pressed")).toBe("true");
});

test("記録画面への導線を表示すること", () => {
  renderGallery();

  const recordsLink = screen.getByRole("link", { name: "記録" });

  expect(recordsLink.getAttribute("href")).toBe("/records");
});
