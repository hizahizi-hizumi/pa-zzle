import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";
import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";
import { readPlayRecords } from "@/records/storage";
import { NanpurePlayView } from "@/views/NanpurePlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(() => "nanpure-play-view"),
}));

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
  vi.restoreAllMocks();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/nanpure/play/:difficulty"
          element={<NanpurePlayView />}
        />
        <Route path="/puzzles/nanpure" element={<p>難易度選択画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/nanpure/play/:difficulty",
        element: <NanpurePlayView />,
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

describe("NanpurePlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/nanpure/play/5");
    });

    test("9×9 の盤面を持つプレイ画面を表示すること", () => {
      const cells = screen.getAllByRole("button", { name: /^\d行\d列、/ });

      expect(cells).toHaveLength(81);
    });
  });

  describe("内部診断を使える環境の場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/nanpure/play/4");
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(dialog.textContent).toContain("レベル 4");
      expect(dialog.textContent).toMatch(/np-/);
    });
  });

  const invalidCases = ["9", "normal"] as const;

  describe.each(invalidCases)("未定義の難易度 %s の場合", (difficulty) => {
    beforeEach(() => {
      renderAt(`/puzzles/nanpure/play/${difficulty}`);
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/nanpure");
    });
  });

  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      selectNanpureProblemForDifficulty("1", "problem-id-query").identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/nanpure/play/1");
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
          `/puzzles/nanpure/play/1?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
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
            `/puzzles/nanpure/play/${difficulty}?problem=${requestedProblemId}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(requestedProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
          expect(screen.queryByText(/選べません|復元できません/)).toBeNull();
        });
      },
    );
  });
});

describe("解き終えた場合", () => {
  const { problem } = selectNanpureProblemForDifficulty(
    "1",
    "nanpure-play-view",
  );
  let router: PlayRouter;

  /** 空きマスを順に選び、解の数字を入れる。 */
  function solve(): void {
    problem.clues.forEach((clue, cellIndex) => {
      if (clue !== null) {
        return;
      }
      const cells = screen.getAllByRole("button", { name: /^\d行\d列、/ });
      fireEvent.click(cells[cellIndex] as HTMLElement);
      fireEvent.click(
        within(screen.getByRole("group", { name: "数字入力" })).getByText(
          String(problem.solution[cellIndex]),
        ),
      );
    });
  }

  beforeEach(() => {
    // クリア演出を待たずに結果へ進める。
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
  });

  describe("記録を保存できた場合", () => {
    beforeEach(() => {
      router = renderRouterAt("/puzzles/nanpure/play/1");
      solve();
    });

    test("保存した記録の結果画面へ履歴を置き換えて移ること", async () => {
      const resultScreen = await screen.findByRole("region", {
        name: "プレイ結果",
      });
      const [record] = readPlayRecords();

      expect(resultScreen).toBeTruthy();
      expect(router.state.location.pathname).toBe(
        `/puzzles/nanpure/result/${encodeURIComponent(record?.id ?? "")}`,
      );
      expect(router.state.historyAction).toBe("REPLACE");
      expect(router.state.location.state).toEqual({
        recordSaveOutcome: { status: "first-record" },
      });
    });
  });

  describe("記録を保存できなかった場合", () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });
      router = renderRouterAt("/puzzles/nanpure/play/1");
      solve();
    });

    test("プレイ画面のまま結果と保存できなかったことを示すこと", async () => {
      const resultScreen = await screen.findByRole("region", {
        name: "プレイ結果",
      });
      const failure = screen.getByText(
        "このプレイの記録を保存できませんでした",
      );

      expect(resultScreen).toBeTruthy();
      expect(failure).toBeTruthy();
      expect(router.state.location.pathname).toBe("/puzzles/nanpure/play/1");
    });
  });
});

describe("直前の問題を避ける location state", () => {
  const firstProblem = selectNanpureProblemForDifficulty("1", "avoided-first");
  const secondProblem = selectNanpureProblemForDifficulty(
    "1",
    "avoided-second",
  );
  const firstProblemId = createProblemId(firstProblem.identity);
  const secondProblemId = createProblemId(secondProblem.identity);
  const state = createPlayLocationState(firstProblemId);
  let router: PlayRouter;

  beforeEach(() => {
    vi.mocked(createProblemSeed)
      .mockReturnValueOnce("avoided-first")
      .mockReturnValueOnce("avoided-second");
  });

  afterEach(() => {
    vi.mocked(createProblemSeed).mockReset();
  });

  describe("問題IDの無いURLで開いた場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/nanpure/play/1",
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
        pathname: "/puzzles/nanpure/play/1",
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
