import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";
import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { readPlayRecords } from "@/records/storage";
import { MinesweeperPlayView } from "@/views/MinesweeperPlayView";
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
  vi.unstubAllGlobals();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/minesweeper/play/:difficulty"
          element={<MinesweeperPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/minesweeper/play/:difficulty",
        element: <MinesweeperPlayView />,
      },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function readProblemId(router: PlayRouter): string | null {
  return new URLSearchParams(router.state.location.search).get("problem");
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("MinesweeperPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("プレイ画面を表示すること", () => {
      const backButton = screen.getByRole("button", {
        name: "難易度選択へ戻る",
      });

      expect(backButton).toBeTruthy();
      expect(screen.queryByText("この難易度は選べません")).toBeNull();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/minesweeper");
    });
  });

  describe("内部診断を使えない環境の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/minesweeper/play/1");
    });

    test("メニューに検証情報を出さないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );

      expect(screen.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
    });
  });

  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      selectMinesweeperProblemForDifficulty("1", "problem-id-query").identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/minesweeper/play/1");
      });

      test("出題した問題のIDを履歴を増やさずにURLへ反映すること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toMatch(/^[0-9a-v]{10}$/);
        expect(router.state.historyAction).toBe("REPLACE");
      });
    });

    describe("問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt(
          `/puzzles/minesweeper/play/1?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
      });

      describe("メニューからリセットした場合", () => {
        beforeEach(() => {
          openMenu();
        });

        test("URLの問題IDを変えないこと", () => {
          fireEvent.click(screen.getByRole("menuitem", { name: "リセット" }));
          const problemId = readProblemId(router);

          expect(problemId).toBe(poolProblemId);
        });
      });

      describe("メニューから別の問題を選んだ場合", () => {
        beforeEach(() => {
          openMenu();
        });

        test("URLの問題IDを履歴を増やさずに新しい問題のIDへ置き換えること", () => {
          fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(poolProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
        });
      });
    });

    const unresolvedCases = [
      ["形式の違う問題ID", "1", "invalid"],
      ["別の難易度の問題ID", "2", poolProblemId],
    ] as const;

    describe.each(unresolvedCases)(
      "%sで開いた場合",
      (_, difficulty, requestedProblemId) => {
        beforeEach(() => {
          router = renderRouterAt(
            `/puzzles/minesweeper/play/${difficulty}?problem=${requestedProblemId}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(requestedProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
          expect(
            screen.getByRole("button", { name: "その他の操作" }),
          ).toBeTruthy();
        });
      },
    );
  });
});

describe("解き終えた場合", () => {
  const { problem, identity } = selectMinesweeperProblemForDifficulty(
    "1",
    "solve",
  );
  const mineCellIndices = new Set(problem.board.mineCellIndices);
  const cellCount = problem.board.rows * problem.board.columns;
  let router: PlayRouter;

  /** 地雷の無いマスのうち、まだ開いていないマスを順に開く。 */
  function solve(): void {
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const hiddenCell = mineCellIndices.has(cellIndex)
        ? null
        : screen.queryByLabelText(`マス ${cellIndex + 1} 未開示`);
      if (hiddenCell) {
        fireEvent.click(hiddenCell);
      }
    }
  }

  beforeEach(() => {
    // クリア演出を待たずに結果へ進める。
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
    router = renderRouterAt(
      `/puzzles/minesweeper/play/1?problem=${createProblemId(identity)}`,
    );
    solve();
  });

  test("保存した記録の結果画面へ履歴を置き換えて移ること", async () => {
    const resultScreen = await screen.findByRole("region", {
      name: "プレイ結果",
    });
    const [record] = readPlayRecords();

    expect(resultScreen).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      `/puzzles/minesweeper/result/${encodeURIComponent(record?.id ?? "")}`,
    );
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual({
      recordSaveOutcome: { status: "first-record" },
    });
  });
});

describe("直前の問題を避ける location state", () => {
  const firstProblem = selectMinesweeperProblemForDifficulty(
    "1",
    "avoided-first",
  );
  const secondProblem = selectMinesweeperProblemForDifficulty(
    "1",
    "avoided-second",
  );
  const firstProblemId = createProblemId(firstProblem.identity);
  const secondProblemId = createProblemId(secondProblem.identity);
  const state = createPlayLocationState(firstProblemId);
  let router: PlayRouter;

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("avoided-first")
      .mockReturnValueOnce("avoided-second");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("問題IDの無いURLで開いた場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/minesweeper/play/1",
        state,
      });
    });

    test("避ける問題を選ばずに別の問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(secondProblemId).not.toBe(firstProblemId);
      expect(problemId).toBe(secondProblemId);
    });
  });

  describe("避ける問題をURLの問題IDでも指定した場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/minesweeper/play/1",
        search: `?problem=${firstProblemId}`,
        state,
      });
    });

    test("URLで指定した問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(problemId).toBe(firstProblemId);
      expect(router.state.historyAction).toBe("POP");
    });
  });
});
