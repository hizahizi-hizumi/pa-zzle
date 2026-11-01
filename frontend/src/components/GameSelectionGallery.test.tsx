import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { playSound } from "@/lib/sound-effects";
import {
  isSoundEffectsEnabled,
  setSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

vi.mock("@/lib/sound-effects", () => ({
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
  setSoundEffectsEnabled(true);
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

describe("効果音の切り替え", () => {
  beforeEach(() => {
    renderGallery();
  });

  test("はじめは効果音を鳴らす設定として示すこと", () => {
    const toggle = screen.getByRole("button", { name: "効果音" });

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  test("押すと鳴らさない設定に切り替えて保存し、切り替えでは音を鳴らさないこと", () => {
    const toggle = screen.getByRole("button", { name: "効果音" });

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(isSoundEffectsEnabled()).toBe(false);
    expect(window.localStorage.getItem("pa-zzle.sound-effects.v1")).toBe(
      JSON.stringify({ enabled: false }),
    );
    expect(playSound).not.toHaveBeenCalled();
  });
});
