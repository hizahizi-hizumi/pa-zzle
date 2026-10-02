import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { ParkingJamDifficultyView } from "@/views/ParkingJamDifficultyView";

afterEach(cleanup);

describe("ParkingJamDifficultyView", () => {
  const difficultyCases = ["1", "2", "3", "4", "5"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <ParkingJamDifficultyView />
      </MemoryRouter>,
    );
  });

  test.each(difficultyCases)(
    "レベル %s を選ぶとそのレベルのプレイ画面へ進めること",
    (difficulty) => {
      const option = screen.getByRole("link", {
        name: `レベル ${difficulty}`,
      });

      const href = option.getAttribute("href");

      expect(href).toBe(`/puzzles/parking-jam/play/${difficulty}`);
    },
  );

  test("3段階の難易度を選択肢に出さないこと", () => {
    const legacyOption = screen.queryByRole("link", { name: "ふつう" });

    expect(legacyOption).toBeNull();
  });

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });
});
