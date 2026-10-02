import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createRecordResultLocationState } from "@/game-catalog/record-result-location-state";

import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import { createSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import type { PlayRecord } from "@/records/play-record";
import { writePlayRecords } from "@/records/storage";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

const nanpureProblem = selectNanpureProblemForDifficulty("3", "result-view");
const nanpureRecord = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity: nanpureProblem.identity,
  startedAt: 1_000,
  completedAt: 121_000,
  result: {
    elapsedMs: 120_000,
    mistakeCount: 1,
    undoCount: 2,
    restartCount: 0,
  },
});

// 今の生成器の問題だが、問題集に無いので遊び直せない記録。
const unreplayableNanpureRecord = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity: createNanpureProblemIdentity("x-wing", 999_999),
  startedAt: 2_000,
  completedAt: 122_000,
  result: {
    elapsedMs: 120_000,
    mistakeCount: 0,
    undoCount: 0,
    restartCount: 0,
  },
});

// 3段階（easy / normal / hard）の難易度とヒント数を指定した生成器（版 "1"）で遊んだ記録。
const legacyNanpureRecord: PlayRecord = {
  id: "nanpure-three-level",
  gameId: "nanpure",
  startedAt: 1_000,
  completedAt: 121_000,
  payloadVersion: 1,
  payload: {
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: "1",
      seed: "legacy",
      conditions: { clueCount: 30 },
    },
    performance: {
      elapsedMs: 120_000,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
    },
  },
};

const unknownGameRecord: PlayRecord = {
  ...nanpureRecord,
  id: "unknown-game-record",
  gameId: "unknown-game",
};

type ResultRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(entry: InitialEntry): ResultRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/puzzles/nanpure/play/:difficulty", element: <p>プレイ画面</p> },
      { path: "/puzzles/:game/play/:difficulty", element: <p>プレイ画面</p> },
      { path: "/puzzles/nanpure", element: <p>難易度選択画面</p> },
      { path: "/records", element: <p>記録画面</p> },
      { path: "/", element: <p>ホーム画面</p> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function createResultPath(record: PlayRecord): string {
  return `/puzzles/${record.gameId}/result/${encodeURIComponent(record.id)}`;
}

describe("今の版の記録の場合", () => {
  let router: ResultRouter;

  beforeEach(() => {
    writePlayRecords([nanpureRecord]);
    router = renderAt(createResultPath(nanpureRecord));
  });

  test("記録の難易度と成績で結果画面を出すこと", () => {
    const resultScreen = screen.getByRole("region", { name: "プレイ結果" });

    expect(resultScreen.textContent).toContain("レベル 3");
    expect(resultScreen.textContent).toContain("02:00");
  });

  test("保存結果の state が無いと自己ベスト更新を告知しないこと", () => {
    const bestUpdate = screen.queryByRole("region", { name: "自己ベスト更新" });

    expect(bestUpdate).toBeNull();
  });

  const navigationCases = [
    [
      "プレイ！",
      "/puzzles/nanpure/play/3",
      "",
      createPlayLocationState(createProblemId(nanpureProblem.identity)),
    ],
    [
      "同じ問題",
      "/puzzles/nanpure/play/3",
      `?problem=${createProblemId(nanpureProblem.identity)}`,
      null,
    ],
    ["記録を確認", "/records", "", null],
    ["難易度変更", "/puzzles/nanpure", "", null],
    ["ホーム", "/", "", null],
  ] as const;

  test.each(navigationCases)(
    "%sで遷移すること",
    (buttonName, pathname, search, state) => {
      fireEvent.click(screen.getByRole("button", { name: buttonName }));

      const { location } = router.state;

      expect(location.pathname).toBe(pathname);
      expect(location.search).toBe(search);
      expect(location.state).toEqual(state);
    },
  );
});

const startedAt = 1_000;
const completedAt = 121_000;

const waterSortProblem = selectWaterSortProblemForDifficulty("2", "result");
const minesweeperProblem = selectMinesweeperProblemForDifficulty("1", "result");
const parkingJamProblem = selectParkingJamProblemForDifficulty("1", "result");
const parkingJamVehicleCount =
  parkingJamProblem.identity.conditions.vehicleCount;
const slidePuzzleProblem = selectSlidePuzzleProblemForDifficulty("1", "result");
const takuzuProblem = selectTakuzuProblemForDifficulty("4", "result");
const reflectionProblem = selectReflectionProblemForDifficulty("3", "result");

const gameRecords = [
  [
    "ウォーターソート",
    createWaterSortPlayRecord({
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
    }),
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
    createMinesweeperPlayRecord({
      difficulty: "1",
      problemIdentity: minesweeperProblem.identity,
      startedAt,
      completedAt,
      result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
    }),
    "/puzzles/minesweeper/play/1",
    createProblemId(minesweeperProblem.identity),
  ],
  [
    "パーキングジャム",
    createParkingJamPlayRecord({
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
    }),
    "/puzzles/parking-jam/play/1",
    createProblemId(parkingJamProblem.identity),
  ],
  [
    "スライドパズル",
    createSlidePuzzlePlayRecord({
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
    }),
    "/puzzles/slide-puzzle/play/1",
    createProblemId(slidePuzzleProblem.identity),
  ],
  [
    "バイナリパズル",
    createTakuzuPlayRecord({
      difficulty: "4",
      problemIdentity: takuzuProblem.identity,
      workload: takuzuProblem.workload,
      startedAt,
      completedAt,
      result: {
        elapsedMs: 220_000,
        correctionCount: 1,
        restartCount: 0,
        undoCount: 0,
        inputCount: 70,
      },
    }),
    "/puzzles/takuzu/play/4",
    createProblemId(takuzuProblem.identity),
  ],
  [
    "リフレクション",
    createReflectionPlayRecord({
      difficulty: "3",
      problemIdentity: reflectionProblem.identity,
      workload: reflectionProblem.workload,
      startedAt,
      completedAt,
      result: {
        elapsedMs: 90_000,
        relocationCount: 1,
        restartCount: 0,
        laserCheckCount: 3,
        inputCount: 10,
      },
    }),
    "/puzzles/reflection/play/3",
    createProblemId(reflectionProblem.identity),
  ],
] as const;

describe.each(gameRecords)(
  "%sの今の版の記録の場合",
  (gameName, record, playPath, problemId) => {
    let router: ResultRouter;

    beforeEach(() => {
      writePlayRecords([record]);
      router = renderAt(createResultPath(record));
    });

    test("そのゲームの結果画面を出すこと", () => {
      const resultScreen = screen.getByRole("region", { name: "プレイ結果" });

      expect(resultScreen.textContent).toContain(gameName);
    });

    test("プレイ！で記録と同じ難易度のプレイ画面へ記録の問題を避けて移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));

      const { location } = router.state;

      expect(location.pathname).toBe(playPath);
      expect(location.state).toEqual(createPlayLocationState(problemId));
    });

    test("同じ問題で記録の問題 ID を付けたプレイ画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));

      const { location } = router.state;

      expect(location.pathname).toBe(playPath);
      expect(location.search).toBe(`?problem=${problemId}`);
    });
  },
);

describe("自己ベスト更新の保存結果を state に持つ場合", () => {
  beforeEach(() => {
    writePlayRecords([nanpureRecord]);
    renderAt({
      pathname: createResultPath(nanpureRecord),
      state: createRecordResultLocationState({
        status: "updated",
        updates: [
          { metricId: "play-score", previousValue: 80, currentValue: 90 },
        ],
      }),
    });
  });

  test("自己ベスト更新を告知すること", () => {
    const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

    expect(bestUpdate.textContent).toContain("+10点");
  });
});

describe("遊び直せない記録の場合", () => {
  beforeEach(() => {
    writePlayRecords([unreplayableNanpureRecord]);
    renderAt(createResultPath(unreplayableNanpureRecord));
  });

  test("同じ問題の操作を押せない状態で出すこと", () => {
    const replayButton = screen.getByRole("button", { name: "同じ問題" });

    expect(replayButton.hasAttribute("disabled")).toBe(true);
  });
});

describe("内部診断を使える環境の場合", () => {
  beforeEach(() => {
    internalDiagnostics.available = true;
    writePlayRecords([nanpureRecord]);
    renderAt(createResultPath(nanpureRecord));
  });

  test("記録の問題の検証情報を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    const dialog = screen.getByRole("dialog", { name: "検証情報" });

    expect(dialog.textContent).toContain("レベル 3");
    expect(dialog.textContent).toContain(nanpureProblem.identity.seed);
  });
});

const unrenderableCases = [
  ["存在しない記録 ID", "/puzzles/nanpure/result/missing"],
  ["別のゲームの記録", `/puzzles/takuzu/result/${nanpureRecord.id}`],
  ["古い版の記録", `/puzzles/nanpure/result/${legacyNanpureRecord.id}`],
  [
    "未知のゲームの記録",
    `/puzzles/unknown-game/result/${unknownGameRecord.id}`,
  ],
] as const;

describe.each(unrenderableCases)("%sの場合", (_, path) => {
  beforeEach(() => {
    writePlayRecords([nanpureRecord, legacyNanpureRecord, unknownGameRecord]);
    renderAt(path);
  });

  test("記録が見つからないことを示し記録画面への導線を出すこと", () => {
    const heading = screen.getByRole("heading", {
      name: "記録が見つかりません",
    });
    const backLink = screen.getByRole("link", { name: "記録へ戻る" });

    expect(heading).toBeTruthy();
    expect(backLink.getAttribute("href")).toBe("/records");
  });
});
