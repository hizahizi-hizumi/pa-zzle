import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import { createSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import type { PlayRecord } from "@/records/play-record";
import { writePlayRecords } from "@/records/storage";
import { PlayRecordsView } from "@/views/PlayRecordsView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const startedAt = 1_000;
const completedAt = 121_000;

const waterSortProblem = selectWaterSortProblemForDifficulty("2", "records");
const waterSortRecord = createWaterSortPlayRecord({
  difficulty: "2",
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

function createNanpureRecord(
  problemIdentity: ReturnType<typeof createNanpureProblemIdentity>,
): PlayRecord {
  return createNanpurePlayRecord({
    difficulty: "3",
    problemIdentity,
    startedAt,
    completedAt,
    result: nanpurePerformance,
  });
}

const nanpureProblem = selectNanpureProblemForDifficulty("3", "records");
const nanpureRecord = createNanpureRecord(nanpureProblem.identity);

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

const minesweeperProblem = selectMinesweeperProblemForDifficulty(
  "1",
  "records",
);
const minesweeperRecord = createMinesweeperPlayRecord({
  difficulty: "1",
  problemIdentity: minesweeperProblem.identity,
  startedAt,
  completedAt,
  result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
});

const parkingJamProblem = selectParkingJamProblemForDifficulty("1", "records");
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

const slidePuzzleProblem = selectSlidePuzzleProblemForDifficulty(
  "1",
  "records",
);
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

function createTakuzuRecord(
  problemIdentity: ReturnType<typeof createTakuzuProblemIdentity>,
): PlayRecord {
  return createTakuzuPlayRecord({
    difficulty: "4",
    problemIdentity,
    workload: { emptyCellCount: 46, roundCount: 18, lineReadingRoundCount: 2 },
    startedAt,
    completedAt,
    result: {
      elapsedMs: 220_000,
      correctionCount: 1,
      restartCount: 0,
      undoCount: 0,
      inputCount: 70,
    },
  });
}

const takuzuProblem = selectTakuzuProblemForDifficulty("4", "records");
const takuzuRecord = createTakuzuRecord(takuzuProblem.identity);

function createReflectionRecord(
  problemIdentity: ReturnType<typeof createReflectionProblemIdentity>,
): PlayRecord {
  return createReflectionPlayRecord({
    difficulty: "3",
    problemIdentity,
    workload: {
      pieceCount: problemIdentity.conditions.pieceCount,
      clueCount: problemIdentity.conditions.size * 4,
      propagationRoundCount: 2,
      assumptionTestCount: 0,
      trialMoveCount: null,
    },
    startedAt,
    completedAt: 91_000,
    result: {
      elapsedMs: 90_000,
      relocationCount: 1,
      restartCount: 0,
      laserCheckCount: 3,
      inputCount: 10,
    },
  });
}

const reflectionProblem = selectReflectionProblemForDifficulty("3", "records");
const reflectionRecord = createReflectionRecord(reflectionProblem.identity);

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
  const replayableRecords = [
    [
      "ウォーターソート",
      waterSortRecord,
      "/puzzles/water-sort/play/2",
      createProblemId(waterSortProblem.identity),
    ],
    [
      "ナンプレ",
      nanpureRecord,
      "/puzzles/nanpure/play/3",
      createProblemId(nanpureProblem.identity),
    ],
    [
      "マインスイーパー",
      minesweeperRecord,
      "/puzzles/minesweeper/play/1",
      createProblemId(minesweeperProblem.identity),
    ],
    [
      "パーキングジャム",
      parkingJamRecord,
      "/puzzles/parking-jam/play/1",
      createProblemId(parkingJamProblem.identity),
    ],
    [
      "スライドパズル",
      slidePuzzleRecord,
      "/puzzles/slide-puzzle/play/1",
      createProblemId(slidePuzzleProblem.identity),
    ],
    [
      "バイナリパズル",
      takuzuRecord,
      "/puzzles/takuzu/play/4",
      createProblemId(takuzuProblem.identity),
    ],
    [
      "リフレクション",
      reflectionRecord,
      "/puzzles/reflection/play/3",
      createProblemId(reflectionProblem.identity),
    ],
  ] as const;

  describe.each(replayableRecords)(
    "問題集にある%sの記録の場合",
    (_, record, expectedPathname, expectedProblemId) => {
      let router: RecordsRouter;

      beforeEach(() => {
        router = renderRecords([record]);
      });

      test("同じ問題をプレイで記録の難易度のプレイ画面をその問題のIDで開くこと", () => {
        fireEvent.click(
          screen.getByRole("button", { name: "同じ問題をプレイ" }),
        );
        const { pathname, search } = router.state.location;

        expect(pathname).toBe(expectedPathname);
        expect(search).toBe(`?problem=${expectedProblemId}`);
      });
    },
  );

  const unavailableRecords = [
    [
      "問題集に無いナンプレの問題",
      createNanpureRecord(
        createNanpureProblemIdentity("locked-candidates", 99_999),
      ),
    ],
    ["3段階の難易度で遊んだナンプレ", legacyNanpureRecord],
    [
      "以前の難易度区分のウォーターソート",
      {
        ...waterSortRecord,
        payload: { ...waterSortRecord.payload, difficulty: "easy" },
      },
    ],
    [
      "問題集に無いバイナリパズルの問題",
      createTakuzuRecord(createTakuzuProblemIdentity("adjacency", 0, 99_999)),
    ],
    [
      "問題集に無いリフレクションの問題",
      createReflectionRecord(createReflectionProblemIdentity(7, 3, 0)),
    ],
    [
      "別の難易度の問題集にあるマインスイーパーの問題",
      {
        ...minesweeperRecord,
        payload: { ...minesweeperRecord.payload, difficulty: "2" },
      },
    ],
  ] as const;

  describe.each(unavailableRecords)("%sの記録の場合", (_, record) => {
    let router: RecordsRouter;

    beforeEach(() => {
      router = renderRecords([record]);
    });

    test("押せないボタンで今は遊べないことを示し、記録画面に留まること", () => {
      const unavailableButton = screen.getByRole("button", {
        name: "この記録の問題は今は遊べません",
      });
      fireEvent.click(unavailableButton);
      const { pathname } = router.state.location;

      expect(unavailableButton.hasAttribute("disabled")).toBe(true);
      expect(
        screen.queryByRole("button", { name: "同じ問題をプレイ" }),
      ).toBeNull();
      expect(pathname).toBe("/records");
    });
  });
});
