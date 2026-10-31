import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { ParkingJamPlayView } from "@/views/ParkingJamPlayView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/parking-jam/play/:difficulty"
          element={<ParkingJamPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function countRenderedCars(): number {
  return document.querySelectorAll(".parking-jam-car__body").length;
}

describe("ParkingJamPlayView", () => {
  describe("定義済みのレベルの場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/parking-jam/play/5");
    });

    test("プレイ画面を表示すること", () => {
      const message = screen.queryByText("この難易度は選べません");

      expect(message).toBeNull();
      expect(countRenderedCars()).toBeGreaterThan(0);
    });
  });

  const invalidDifficultyCases = ["hard", "6"] as const;

  describe.each(invalidDifficultyCases)("レベルでない %s の場合", (value) => {
    beforeEach(() => {
      renderAt(`/puzzles/parking-jam/play/${value}`);
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/parking-jam");
    });
  });
});
