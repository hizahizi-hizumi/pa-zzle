import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { IceFloorMazePlayView } from "@/views/IceFloorMazePlayView";

afterEach(() => {
  cleanup();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/ice-floor-maze/play/:difficulty"
          element={<IceFloorMazePlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IceFloorMazePlayView", () => {
  const boardShapeCases = [
    ["1", ["8×8", "8×10"]],
    ["3", ["9×12", "10×13"]],
    ["5", ["12×14"]],
  ] as const;

  describe.each(boardShapeCases)(
    "レベル %s の場合",
    (difficulty, levelShapes) => {
      beforeEach(() => {
        renderAt(`/puzzles/ice-floor-maze/play/${difficulty}`);
      });

      test("問題集からそのレベルの盤面の形（外壁の枠を除いた列数・行数）の問題を選んでプレイ画面を表示すること", () => {
        const board = screen.getByRole("img", { name: "盤面" });
        const [, , viewWidth, viewHeight] = (
          board.getAttribute("viewBox") ?? ""
        )
          .split(" ")
          .map(Number);

        expect(
          screen.getByRole("heading", { name: "氷の床迷路" }),
        ).toBeTruthy();
        expect(levelShapes).toContain(
          `${Math.round(viewWidth!)}×${Math.round(viewHeight!)}`,
        );
      });
    },
  );

  const invalidDifficultyCases = ["hard", "6"] as const;

  describe.each(invalidDifficultyCases)("レベルでない %s の場合", (value) => {
    beforeEach(() => {
      renderAt(`/puzzles/ice-floor-maze/play/${value}`);
    });

    test("選べない難易度であることを示しホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "ホームへ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/");
    });
  });
});
