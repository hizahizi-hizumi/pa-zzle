import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { formatParkingJamProblemQuery } from "@/games/parking-jam/diagnostics";
import * as problemSelection from "@/games/parking-jam/problem-selection";
import { ParkingJamPlayView } from "@/views/ParkingJamPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  internalDiagnostics.available = false;
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

const specifiedProblem = problemSelection.selectParkingJamProblemForDifficulty(
  "5",
  "parking-jam-play-view-specified",
);
const specifiedProblemPath = `/puzzles/parking-jam/play/1?${formatParkingJamProblemQuery(specifiedProblem.identity)}`;

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

    test("選べない難易度であることを示すこと", () => {
      const message = screen.getByText("この難易度は選べません");

      expect(message).toBeTruthy();
    });
  });

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSelection, "selectParkingJamProblemForDifficulty");
      renderAt(specifiedProblemPath);
    });

    test("指定を無視してレベルの問題集から出題すること", () => {
      const selectProblem =
        problemSelection.selectParkingJamProblemForDifficulty;

      expect(selectProblem).toHaveBeenCalledWith("1", expect.any(String));
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      vi.spyOn(problemSelection, "selectParkingJamProblemForDifficulty");
      renderAt(specifiedProblemPath);
    });

    test("指定した問題を問題集を使わずに出題すること", () => {
      const selectProblem =
        problemSelection.selectParkingJamProblemForDifficulty;

      expect(selectProblem).not.toHaveBeenCalled();
      expect(countRenderedCars()).toBe(
        specifiedProblem.problem.board.vehicles.length,
      );
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/parking-jam/play/1?seed=abc&board=8x8");
    });

    test("指定を復元できないことを示すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");

      expect(message).toBeTruthy();
    });
  });
});
