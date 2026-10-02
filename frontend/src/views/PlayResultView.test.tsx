import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createRecordResultLocationState } from "@/game-catalog/record-result-location-state";

import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createProblemId } from "@/games/problem-id";
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
