import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";
import type { PlayRecord } from "@/records/play-record";
import { writePlayRecords } from "@/records/storage";
import { PlayRecordsView } from "@/views/PlayRecordsView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const minesweeperProblem = selectMinesweeperProblemForDifficulty(
  "1",
  "records",
);
const minesweeperRecord = createMinesweeperPlayRecord({
  difficulty: "1",
  problemIdentity: minesweeperProblem.identity,
  startedAt: 1_000,
  completedAt: 121_000,
  result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
});

type RecordsRouter = ReturnType<typeof createMemoryRouter>;

function renderRecords(records: readonly PlayRecord[]): RecordsRouter {
  writePlayRecords(records);
  const router = createMemoryRouter(
    [
      { path: "/records", element: <PlayRecordsView /> },
      { path: "*", element: null },
    ],
    { initialEntries: ["/records"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PlayRecordsView", () => {
  describe("問題集にある問題の記録の場合", () => {
    let router: RecordsRouter;

    beforeEach(() => {
      router = renderRecords([minesweeperRecord]);
    });

    test("同じ問題をプレイで記録の難易度のプレイ画面をその問題のIDで開くこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "同じ問題をプレイ" }));
      const { pathname, search } = router.state.location;

      expect(pathname).toBe("/puzzles/minesweeper/play/1");
      expect(search).toBe(
        `?problem=${createProblemId(minesweeperProblem.identity)}`,
      );
    });
  });

  describe("別の難易度の問題集にある問題の記録の場合", () => {
    const otherDifficultyRecord = {
      ...minesweeperRecord,
      payload: { ...minesweeperRecord.payload, difficulty: "2" },
    };
    let router: RecordsRouter;

    beforeEach(() => {
      router = renderRecords([otherDifficultyRecord]);
    });

    test("押せないボタンで今は遊べないことを示し、記録画面に留まること", () => {
      const unavailableButton = screen.getByRole("button", {
        name: "この記録の問題は今は遊べません",
      });
      fireEvent.click(unavailableButton);
      const { pathname } = router.state.location;

      expect(unavailableButton.hasAttribute("disabled")).toBe(true);
      expect(pathname).toBe("/records");
    });
  });
});
