import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";
import { writeTakuzuHowToPlaySeen } from "@/games/takuzu/ui/how-to-play-seen";
import type { PlayRecord } from "@/records/play-record";
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
const playPerformance = {
  elapsedMs: 220_000,
  correctionCount: 1,
  restartCount: 0,
  undoCount: 0,
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

beforeEach(() => {
  writeTakuzuHowToPlaySeen();
});

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
      result: playPerformance,
    });
    const expectedGivenCellIndices =
      restoreTakuzuProblem(problemIdentity)?.problem.givens.cells.flatMap(
        (cell, cellIndex) => (cell === null ? [] : [cellIndex]),
      ) ?? [];

    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("記録と同じ問題の初期配置からプレイを始めること", () => {
      const cells = within(
        screen.getByRole("group", { name: "バイナリパズル盤面" }),
      ).getAllByRole("button");
      const givenCellIndices = cells.flatMap((cell, cellIndex) =>
        cell.getAttribute("aria-disabled") === "true" ? [cellIndex] : [],
      );

      expect(givenCellIndices).toEqual(expectedGivenCellIndices);
    });
  });

  const unavailableCases = [
    [
      "問題集に無い identity",
      createTakuzuProblemIdentity("adjacency", 0, 99_999),
    ],
    [
      "生成器の版が今と違う identity",
      { generatorVersion: "0", seed: "tk-old", conditions: { size: 8 } },
    ],
  ] as const;

  describe.each(unavailableCases)(
    "%s のバイナリパズルの記録の場合",
    (_, problemIdentity) => {
      const playedRecord = createTakuzuPlayRecord({
        difficulty: "1",
        problemIdentity: createTakuzuProblemIdentity("adjacency", 0, 1),
        workload,
        startedAt: 1_000,
        completedAt: 221_000,
        result: playPerformance,
      });
      const record = {
        ...playedRecord,
        payload: { ...playedRecord.payload, problemIdentity },
      };

      beforeEach(() => {
        writePlayRecords([record]);
        renderReplay(record.id);
      });

      test("問題集に問題が無いため再プレイできないことを示し、記録へ戻る導線を出すこと", () => {
        const heading = screen.getByRole("heading", {
          name: "この記録は再プレイできません",
        });
        const reason = screen.getByText(
          "この記録の問題は、現在の問題集にありません。",
        );
        const backLink = screen.getByRole("link", { name: "記録へ戻る" });

        expect(heading).toBeTruthy();
        expect(reason).toBeTruthy();
        expect(backLink.getAttribute("href")).toBe("/records");
      });
    },
  );

  describe("問題集にあるナンプレの記録の場合", () => {
    const record = createNanpurePlayRecord({
      difficulty: "3",
      problemIdentity: createNanpureProblemIdentity("locked-candidates", 740),
      startedAt: 1_000,
      completedAt: 601_000,
      result: {
        elapsedMs: 600_000,
        mistakeCount: 0,
        undoCount: 0,
        restartCount: 0,
      },
    });
    const expectedClueLabels =
      restoreNanpureProblem(
        record.payload.problemIdentity,
      )?.problem.clues.flatMap((digit, cellIndex) =>
        digit === null
          ? []
          : [
              `${Math.floor(cellIndex / 9) + 1}行${(cellIndex % 9) + 1}列、${digit}、初期ヒント`,
            ],
      ) ?? [];

    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("記録と同じ問題のヒントからプレイを始めること", () => {
      const clueLabels = screen
        .getAllByRole("button", { name: /初期ヒント$/ })
        .map((cell) => cell.getAttribute("aria-label"));

      expect(clueLabels).toEqual(expectedClueLabels);
    });
  });

  describe("3段階の難易度で遊んだナンプレの記録の場合", () => {
    const record: PlayRecord = {
      id: "nanpure-three-level",
      gameId: "nanpure",
      startedAt: 1_000,
      completedAt: 121_000,
      payloadVersion: 1,
      payload: {
        difficulty: "normal",
        problemIdentity: {
          generatorVersion: "1",
          seed: "nanpure-seed",
          conditions: { clueCount: 32 },
          generationAttempt: 1,
        },
        performance: {
          elapsedMs: 120_000,
          mistakeCount: 0,
          undoCount: 0,
          restartCount: 0,
        },
      },
    };

    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("問題集に問題が無いため再プレイできないことを示すこと", () => {
      const heading = screen.getByRole("heading", {
        name: "この記録は再プレイできません",
      });
      const reason = screen.getByText(
        "この記録の問題は、現在の問題集にありません。",
      );

      expect(heading).toBeTruthy();
      expect(reason).toBeTruthy();
    });
  });
});
