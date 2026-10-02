import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
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

function renderAt(path: string): void {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

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
