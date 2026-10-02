import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { WaterSortDifficultyView } from "@/views/WaterSortDifficultyView";

afterEach(() => {
  cleanup();
});

describe("WaterSortDifficultyView", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <WaterSortDifficultyView />
      </MemoryRouter>,
    );
  });

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });
});
