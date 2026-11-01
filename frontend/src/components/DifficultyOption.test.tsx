import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { DifficultyOption } from "@/components/DifficultyOption";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
});

describe("DifficultyOption", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <DifficultyOption
          playPath="/puzzles/water-sort/play/:difficulty"
          difficulty="3"
          label="レベル 3"
        >
          <span>見本</span>
        </DifficultyOption>
      </MemoryRouter>,
    );
  });

  test("選ぶとその難易度のプレイ画面へ進み、プレイを始める音を鳴らすこと", () => {
    const option = screen.getByRole("link", { name: /レベル 3/ });

    fireEvent.click(option);

    expect(option.getAttribute("href")).toBe("/puzzles/water-sort/play/3");
    expect(playSound).toHaveBeenCalledExactlyOnceWith(
      appDecisionSound.playStartSound,
    );
  });
});
