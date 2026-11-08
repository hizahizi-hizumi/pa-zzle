import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";
import type { PlayAttempt } from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import type { PlayRecord } from "@/records/play-record";
import {
  createPlayRecordsLocationState,
  readPlayRecordsLocationState,
} from "@/records/play-records-location-state";
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
const minesweeperAttempt: PlayAttempt = {
  gameId: "minesweeper",
  startedAt: 200_000,
  start: { difficulty: "1", problemIdentity: minesweeperProblem.identity },
  abandonment: null,
};
const abandonment = {
  abandonedAt: 230_000,
  progress: { elapsedMs: 30_000, mistakeCount: 1 },
};

type RecordsRouter = ReturnType<typeof createMemoryRouter>;

function renderRecords(
  records: readonly PlayRecord[],
  initialState: unknown = null,
): RecordsRouter {
  writePlayRecords(records);
  const router = createMemoryRouter(
    [
      { path: "/records", element: <PlayRecordsView /> },
      { path: "*", element: null },
    ],
    { initialEntries: [{ pathname: "/records", state: initialState }] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function getRow(name: RegExp): HTMLElement {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "プレイ履歴" }), {
    button: 0,
    ctrlKey: false,
  });
  return within(screen.getByRole("list", { name: "遊んだ日" })).getByRole(
    "button",
    { name },
  );
}

describe("PlayRecordsView", () => {
  test("初回はコレクションを主表示とし、履歴も切り替えられること", () => {
    renderRecords([]);
    expect(
      screen.getByRole("heading", { name: "自分のパズルの風景" }),
    ).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "プレイ履歴" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("まだ記録がありません")).toBeTruthy();
  });

  describe("結果画面を描ける記録の場合", () => {
    let router: RecordsRouter;

    beforeEach(() => {
      router = renderRecords([minesweeperRecord]);
    });

    test("行を押すと、その記録の結果画面を開くこと", () => {
      fireEvent.click(getRow(/マインスイーパー/));
      const { pathname } = router.state.location;

      expect(pathname).toBe(
        `/puzzles/minesweeper/result/${encodeURIComponent(minesweeperRecord.id)}`,
      );
    });

    test("行を押すと、戻ったときのために記録画面の履歴へ一覧の位置を残すこと", async () => {
      fireEvent.click(getRow(/マインスイーパー/));
      await act(() => router.navigate(-1));
      const { pathname, state } = router.state.location;

      expect(pathname).toBe("/records");
      expect(readPlayRecordsLocationState(state)).toEqual({
        shownEntryCount: 40,
        scrollY: 0,
      });
    });

    test("行に、レベルと図鑑の番号を示すこと", () => {
      const row = getRow(/マインスイーパー/);

      expect(row.textContent).toContain("レベル 1");
      expect(row.textContent).toMatch(/No\.\d{4}/);
    });
  });

  describe("一覧から開いたプレイから戻った場合", () => {
    let scrollTo: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      renderRecords(
        [minesweeperRecord],
        createPlayRecordsLocationState(80, 1200),
      );
    });

    afterEach(() => {
      scrollTo.mockRestore();
    });

    test("開いたときと同じ位置へスクロールを戻すこと", () => {
      expect(scrollTo).toHaveBeenCalledWith(0, 1200);
    });
  });

  describe("今の規則で結果を作れない記録の場合", () => {
    const oldGeneratorRecord = {
      ...minesweeperRecord,
      payload: {
        ...minesweeperRecord.payload,
        problemIdentity: {
          ...minesweeperProblem.identity,
          generatorVersion: "0",
        },
      },
    };
    let router: RecordsRouter;

    beforeEach(() => {
      router = renderRecords([oldGeneratorRecord]);
    });

    test("行を押すと、問題を選ばずにゲームのホームを開くこと", () => {
      fireEvent.click(getRow(/マインスイーパー/));
      const { pathname, search } = router.state.location;

      expect(pathname).toBe("/puzzles/minesweeper");
      expect(search).toBe("");
    });
  });

  describe("問題集にある問題で離脱したプレイの場合", () => {
    let router: RecordsRouter;

    beforeEach(() => {
      startPlayAttempt(minesweeperAttempt);
      abandonPlayAttempt(minesweeperAttempt, abandonment);
      router = renderRecords([]);
    });

    test("行を押すと、その問題を選んだゲームのホームを開くこと", () => {
      fireEvent.click(getRow(/離脱/));
      const { pathname, search } = router.state.location;

      expect(pathname).toBe("/puzzles/minesweeper");
      expect(search).toBe(
        `?problem=${createProblemId(minesweeperProblem.identity)}`,
      );
    });
  });

  describe("今のアプリに無いゲームの記録だけの場合", () => {
    beforeEach(() => {
      renderRecords([{ ...minesweeperRecord, gameId: "unknown-game" }]);
    });

    test("記録が無いものとして示すこと", () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "プレイ履歴" }), {
        button: 0,
        ctrlKey: false,
      });
      const message = screen.getByText("まだ記録がありません");

      expect(message).toBeTruthy();
    });
  });

  describe("直前のプレイの離脱を画面を開いたあとに保存する場合", () => {
    beforeEach(() => {
      startPlayAttempt(minesweeperAttempt);
      renderRecords([]);
    });

    test("保存した離脱を一覧に表示すること", () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "プレイ履歴" }), {
        button: 0,
        ctrlKey: false,
      });
      act(() => {
        abandonPlayAttempt(minesweeperAttempt, abandonment);
      });
      const abandonedLabel = screen.getByText("離脱");

      expect(abandonedLabel).toBeTruthy();
    });
  });
});
