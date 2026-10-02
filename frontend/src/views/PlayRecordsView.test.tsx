import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { createWaterSortPlayAttempt } from "@/games/water-sort/play-attempt";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import { PlayRecordsView } from "@/views/PlayRecordsView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const attempt = createWaterSortPlayAttempt({
  difficulty: "3",
  problemIdentity: {
    generatorVersion: "1",
    seed: "water-sort-seed",
    conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
    generationAttempt: 1,
  },
  startedAt: 1_000,
});

const abandonment = {
  abandonedAt: 31_000,
  progress: { elapsedMs: 30_000, moveCount: 5, undoCount: 0, restartCount: 0 },
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("直前のプレイの離脱を画面を開いたあとに保存する場合", () => {
  beforeEach(() => {
    startPlayAttempt(attempt);
    render(
      <MemoryRouter>
        <PlayRecordsView />
      </MemoryRouter>,
    );
  });

  test("保存した離脱を一覧に表示すること", () => {
    act(() => {
      abandonPlayAttempt(attempt.id, abandonment);
    });
    const abandonedLabel = screen.getByText("離脱");

    expect(abandonedLabel).toBeTruthy();
  });
});
