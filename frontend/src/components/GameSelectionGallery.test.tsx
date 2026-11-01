import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
}));

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="water-sort" />',
    to: "/puzzles/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: '<svg viewBox="0 0 120 120" data-game="nanpure" />',
    to: "/puzzles/nanpure",
  },
] as const;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

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

  expect(heroLink.getAttribute("href")).toBe("/puzzles/water-sort");
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
  expect(heroLink.getAttribute("href")).toBe("/puzzles/nanpure");
  expect(heroLink.querySelector('svg[data-game="nanpure"]')).toBeTruthy();
  expect(nanpureButton.getAttribute("aria-pressed")).toBe("true");
});

test("記録画面への導線を表示すること", () => {
  renderGallery();

  const recordsLink = screen.getByRole("link", { name: "記録" });

  expect(recordsLink.getAttribute("href")).toBe("/records");
});

describe("遊ぶゲームの選択", () => {
  beforeEach(() => {
    renderGallery();
  });

  test("ヒーローのパズルを選ぶとゲームを選ぶ音を鳴らすこと", () => {
    fireEvent.click(
      screen.getByRole("link", { name: "ウォーターソートを遊ぶ" }),
    );

    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.gameSelectSound,
    );
  });

  test("別のパズルの候補を選ぶとゲームを選ぶ音を鳴らすこと", () => {
    fireEvent.click(screen.getByRole("button", { name: "ナンプレを選択" }));

    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.gameSelectSound,
    );
  });

  test("選んでいる候補をもう一度押しても音を鳴らさないこと", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "ウォーターソートを選択" }),
    );

    expect(playSound).not.toHaveBeenCalled();
  });

  test("記録への移動では音を鳴らさないこと", () => {
    fireEvent.click(screen.getByRole("link", { name: "記録" }));

    expect(playSound).not.toHaveBeenCalled();
  });
});

describe("設定", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    renderGallery();
  });

  test("見出しの設定ボタンで、効果音と BGM の音量を選ぶダイアログを開き、開く操作では音を鳴らさないこと", () => {
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    const dialog = screen.getByRole("dialog", { name: "設定" });
    const volumeNames = within(dialog)
      .getAllByRole("group")
      .map((group) => group.textContent);
    expect(volumeNames).toEqual(["効果音6", "BGM6"]);
    expect(playSound).not.toHaveBeenCalled();
  });
});
