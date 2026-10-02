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

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const performance = {
  elapsedMs: 120_000,
  mistakeCount: 1,
  undoCount: 2,
  restartCount: 0,
};
const nanpureProblem = selectNanpureProblemForDifficulty("3", "result-view");
const nanpureProblemId = createProblemId(nanpureProblem.identity);
const nanpureRecord = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity: nanpureProblem.identity,
  startedAt: 1_000,
  completedAt: 121_000,
  result: performance,
});

type ResultRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(entry: InitialEntry): ResultRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/puzzles/nanpure/play/:difficulty", element: <p>プレイ画面</p> },
      { path: "/records", element: <p>記録画面</p> },
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

  test("プレイ！で記録と同じ難易度のプレイ画面へ記録の問題を避けて移ること", () => {
    fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));

    const { location } = router.state;

    expect(location.pathname).toBe("/puzzles/nanpure/play/3");
    expect(location.search).toBe("");
    expect(location.state).toEqual(createPlayLocationState(nanpureProblemId));
  });

  test("同じ問題で記録の問題 ID を付けたプレイ画面へ移ること", () => {
    fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));

    const { location } = router.state;

    expect(location.pathname).toBe("/puzzles/nanpure/play/3");
    expect(location.search).toBe(`?problem=${nanpureProblemId}`);
  });
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

describe("問題集に無い問題の記録の場合", () => {
  const unreplayableRecord = createNanpurePlayRecord({
    difficulty: "3",
    problemIdentity: createNanpureProblemIdentity("x-wing", 999_999),
    startedAt: 2_000,
    completedAt: 122_000,
    result: performance,
  });

  beforeEach(() => {
    writePlayRecords([unreplayableRecord]);
    renderAt(createResultPath(unreplayableRecord));
  });

  test("同じ問題を押せない状態で出すこと", () => {
    const replayButton = screen.getByRole("button", { name: "同じ問題" });

    expect(replayButton.hasAttribute("disabled")).toBe(true);
  });
});

const unrenderableRecord: PlayRecord = {
  ...nanpureRecord,
  id: "unknown-version",
  payloadVersion: 99,
};
const unrenderableCases = [
  ["存在しない記録 ID", "/puzzles/nanpure/result/missing"],
  ["結果を作れない版の記録", createResultPath(unrenderableRecord)],
] as const;

describe.each(unrenderableCases)("%sの場合", (_, path) => {
  beforeEach(() => {
    writePlayRecords([unrenderableRecord]);
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
