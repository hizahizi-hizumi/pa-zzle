import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { restoreReflectionPoolProblem } from "@/games/reflection/problem-selection";
import { writeReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { createSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { writeTakuzuHowToPlaySeen } from "@/games/takuzu/ui/how-to-play-seen";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import type { PlayRecord } from "@/records/play-record";
import { writePlayRecords } from "@/records/storage";
import { RecordedProblemReplayView } from "@/views/RecordedProblemReplayView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const startedAt = 1_000;
const completedAt = 121_000;

const waterSortProblem = selectWaterSortProblemForDifficulty("1", "replay");
const waterSortRecord = createWaterSortPlayRecord({
  difficulty: "1",
  problemIdentity: waterSortProblem.identity,
  startedAt,
  completedAt,
  result: {
    elapsedMs: 120_000,
    moveCount: waterSortProblem.optimalMoveCount,
    completionMoveCount: waterSortProblem.optimalMoveCount,
    undoCount: 0,
    restartCount: 0,
    optimalMoveCount: waterSortProblem.optimalMoveCount,
  },
});

const nanpurePerformance = {
  elapsedMs: 120_000,
  mistakeCount: 0,
  undoCount: 0,
  restartCount: 0,
};

const nanpureRecord = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity: createNanpureProblemIdentity("locked-candidates", 740),
  startedAt,
  completedAt,
  result: nanpurePerformance,
});

// 3段階（easy / normal / hard）の難易度とヒント数を指定した生成器（版 "1"）で遊んだ記録。
const legacyNanpureRecord: PlayRecord = {
  id: "nanpure-three-level",
  gameId: "nanpure",
  startedAt,
  completedAt,
  payloadVersion: 1,
  payload: {
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: "1",
      seed: "nanpure-seed",
      conditions: { clueCount: 32 },
      generationAttempt: 1,
    },
    performance: nanpurePerformance,
  },
};

const minesweeperRecord = createMinesweeperPlayRecord({
  difficulty: "1",
  problemIdentity: selectMinesweeperProblemForDifficulty("1", "replay")
    .identity,
  startedAt,
  completedAt,
  result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
});

const parkingJamProblem = selectParkingJamProblemForDifficulty("1", "replay");
const parkingJamVehicleCount =
  parkingJamProblem.identity.conditions.vehicleCount;
const parkingJamRecord = createParkingJamPlayRecord({
  difficulty: "1",
  problemIdentity: parkingJamProblem.identity,
  speedReference: {
    vehicleCount: parkingJamVehicleCount,
    initialBlockedVehicleCount: 0,
  },
  startedAt,
  completedAt,
  result: {
    elapsedMs: 120_000,
    moveAttemptCount: parkingJamVehicleCount,
    successfulMoveCount: parkingJamVehicleCount,
    failedMoveCount: 0,
    undoCount: 0,
    restartCount: 0,
  },
});

const slidePuzzleProblem = selectSlidePuzzleProblemForDifficulty("1", "replay");
const slidePuzzleRecord = createSlidePuzzlePlayRecord({
  difficulty: "1",
  problemIdentity: slidePuzzleProblem.identity,
  startedAt,
  completedAt,
  result: {
    elapsedMs: 120_000,
    moveCount: slidePuzzleProblem.optimalMoveCount,
    completionMoveCount: slidePuzzleProblem.optimalMoveCount,
    slideCount: slidePuzzleProblem.optimalMoveCount,
    restartCount: 0,
    optimalMoveCount: slidePuzzleProblem.optimalMoveCount,
  },
});

const takuzuWorkload = {
  emptyCellCount: 46,
  roundCount: 18,
  lineReadingRoundCount: 2,
};
const takuzuPerformance = {
  elapsedMs: 220_000,
  correctionCount: 1,
  restartCount: 0,
  undoCount: 0,
  inputCount: 70,
};

function createTakuzuRecordWithIdentity(problemIdentity: unknown): PlayRecord {
  const record = createTakuzuPlayRecord({
    difficulty: "4",
    problemIdentity: createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
    workload: takuzuWorkload,
    startedAt,
    completedAt,
    result: takuzuPerformance,
  });
  return { ...record, payload: { ...record.payload, problemIdentity } };
}

const takuzuRecord = createTakuzuRecordWithIdentity(
  createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
);

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
  writeReflectionHowToPlaySeen();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RecordedProblemReplayView", () => {
  const replayableRecords = [
    ["ウォーターソート", waterSortRecord],
    ["ナンプレ", nanpureRecord],
    ["マインスイーパー", minesweeperRecord],
    ["パーキングジャム", parkingJamRecord],
    ["スライドパズル", slidePuzzleRecord],
    ["バイナリパズル", takuzuRecord],
  ] as const;

  describe.each(replayableRecords)("%sの記録の場合", (gameName, record) => {
    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("そのゲームのプレイ画面で再プレイを始めること", () => {
      const heading = screen.getByRole("heading", { level: 1 });

      expect(heading.textContent).toBe(gameName);
    });
  });

  const unavailableRecords = [
    [
      "問題集に無いバイナリパズルの問題",
      createTakuzuRecordWithIdentity(
        createTakuzuProblemIdentity("adjacency", 0, 99_999),
      ),
      "この記録の問題は、現在の問題集にありません。",
    ],
    [
      "問題集に無いナンプレの問題",
      createNanpurePlayRecord({
        difficulty: "3",
        problemIdentity: createNanpureProblemIdentity(
          "locked-candidates",
          99_999,
        ),
        startedAt,
        completedAt,
        result: nanpurePerformance,
      }),
      "この記録の問題は、現在の問題集にありません。",
    ],
    [
      "3段階の難易度で遊んだナンプレ",
      legacyNanpureRecord,
      "この記録は以前の難易度区分で遊んだため、今の難易度では再プレイできません。",
    ],
    [
      "以前の難易度区分のウォーターソート",
      {
        ...waterSortRecord,
        payload: { ...waterSortRecord.payload, difficulty: "easy" },
      },
      "この記録は以前の難易度区分で遊んだため、今の難易度では再プレイできません。",
    ],
    [
      "現在のアプリに無いゲーム",
      { ...waterSortRecord, gameId: "unknown-game" },
      "現在のバージョンでは、この記録の再プレイに対応していません。",
    ],
  ] as const;

  describe.each(unavailableRecords)("%sの記録の場合", (_, record, reason) => {
    beforeEach(() => {
      writePlayRecords([record]);
      renderReplay(record.id);
    });

    test("再プレイできない理由を示し、記録へ戻る導線を出すこと", () => {
      const heading = screen.getByRole("heading", {
        name: "この記録は再プレイできません",
      });
      const reasonText = screen.getByText(reason);
      const backLink = screen.getByRole("link", { name: "記録へ戻る" });

      expect(heading).toBeTruthy();
      expect(reasonText).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/records");
    });
  });

  describe("問題集にあるナンプレの記録の場合", () => {
    const expectedClueLabels =
      restoreNanpureProblem(
        nanpureRecord.payload.problemIdentity,
      )?.problem.clues.flatMap((digit, cellIndex) =>
        digit === null
          ? []
          : [
              `${Math.floor(cellIndex / 9) + 1}行${(cellIndex % 9) + 1}列、${digit}、初期ヒント`,
            ],
      ) ?? [];

    beforeEach(() => {
      writePlayRecords([nanpureRecord]);
      renderReplay(nanpureRecord.id);
    });

    test("記録と同じ問題のヒントからプレイを始めること", () => {
      const clueLabels = screen
        .getAllByRole("button", { name: /初期ヒント$/ })
        .map((cell) => cell.getAttribute("aria-label"));

      expect(clueLabels).toEqual(expectedClueLabels);
    });
  });

  describe("記録が無い場合", () => {
    beforeEach(() => {
      renderReplay("missing-record");
    });

    test("記録が見つからないことを示すこと", () => {
      const heading = screen.getByRole("heading", {
        name: "記録が見つかりません",
      });

      expect(heading).toBeTruthy();
    });
  });

  describe("リフレクションの記録の場合", () => {
    const pooled = restoreReflectionPoolProblem({
      poolVersion: "1",
      problemId: "3-1",
    });
    const reflectionPerformance = {
      elapsedMs: 90_000,
      relocationCount: 1,
      restartCount: 0,
      undoCount: 0,
      laserCheckCount: 3,
      inputCount: 10,
    };

    function createRecord(
      problemIdentity: ReturnType<typeof createReflectionProblemIdentity>,
    ) {
      return createReflectionPlayRecord({
        difficulty: "3",
        problemIdentity,
        workload: {
          pieceCount: problemIdentity.conditions.pieceCount,
          clueCount: problemIdentity.conditions.size * 4,
          propagationRoundCount: 2,
          assumptionTestCount: 0,
        },
        startedAt: 1_000,
        completedAt: 91_000,
        result: reflectionPerformance,
      });
    }

    describe("問題集にある問題の場合", () => {
      beforeEach(() => {
        const record = createRecord(
          pooled?.identity ?? createReflectionProblemIdentity(5, 4, 0),
        );
        writePlayRecords([record]);
        renderReplay(record.id);
      });

      test("記録と同じ問題の盤面と外周ヒントでプレイを始めること", () => {
        const cells = within(
          screen.getByRole("group", { name: `${REFLECTION_DISPLAY_NAME}盤面` }),
        ).getAllByRole("button");
        const clueDistances = screen
          .getAllByRole("button", { name: /マス$/ })
          .map((button) =>
            Number(button.getAttribute("aria-label")?.match(/(\d+)マス$/)?.[1]),
          )
          .sort((a, b) => a - b);
        const expectedDistances = (pooled?.problem.clues ?? [])
          .map((clue) => clue.distance)
          .sort((a, b) => a - b);

        expect(cells).toHaveLength((pooled?.problem.size ?? 0) ** 2);
        expect(clueDistances).toEqual(expectedDistances);
      });
    });

    describe("問題集に無い問題の場合", () => {
      beforeEach(() => {
        const record = createRecord(createReflectionProblemIdentity(7, 3, 0));
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
});
