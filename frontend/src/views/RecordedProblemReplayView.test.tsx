import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";
import { writePlayRecords } from "@/records/storage";
import { RecordedProblemReplayView } from "@/views/RecordedProblemReplayView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const workload = {
  emptyCellCount: 46,
  roundCount: 18,
  lineReadingRoundCount: 2,
};
const performance = {
  elapsedMs: 220_000,
  correctionCount: 1,
  restartCount: 0,
  inputCount: 70,
};

function renderReplay(recordId: string): void {
  render(
    <MemoryRouter initialEntries={[`/records/replay/${recordId}`]}>
      <Routes>
        <Route
          path="/records/replay/:recordId"
          element={<RecordedProblemReplayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RecordedProblemReplayView", () => {
  describe("問題集にあるバイナリパズルの記録の場合", () => {
    const problemIdentity = createTakuzuProblemIdentity(
      "duplicate-avoidance",
      2,
      160,
    );
    const record = createTakuzuPlayRecord({
      difficulty: "4",
      problemIdentity,
      workload,
      startedAt: 1_000,
      completedAt: 221_000,
      result: performance,
    });

    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("記録の難易度で同じ問題の初期配置からプレイを始めること", () => {
      const givens = restoreTakuzuProblem(problemIdentity)?.problem.givens;
      const cells = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");
      const filledCellIndices = cells.flatMap((cell, cellIndex) =>
        cell.getAttribute("aria-disabled") === "true" ? [cellIndex] : [],
      );

      expect(screen.getByText("難易度 4")).toBeTruthy();
      expect(filledCellIndices).toEqual(
        givens?.cells.flatMap((cell, cellIndex) =>
          cell === null ? [] : [cellIndex],
        ),
      );
    });
  });

  describe("問題集から引けないバイナリパズルの記録の場合", () => {
    const record = createTakuzuPlayRecord({
      difficulty: "1",
      problemIdentity: createTakuzuProblemIdentity("adjacency", 0, 99_999),
      workload,
      startedAt: 1_000,
      completedAt: 221_000,
      result: performance,
    });

    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("再プレイできないことを示して記録へ戻る導線を出すこと", () => {
      const message = screen.getByText("この記録は再プレイできません");
      const backLink = screen.getByRole("link", { name: "記録へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/records");
    });
  });
});
