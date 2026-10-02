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
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";
import {
  formatReflectionPoolProblemQuery,
  formatReflectionProblemQuery,
} from "@/games/reflection/diagnostics";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import {
  restoreReflectionPoolProblem,
  selectReflectionProblemForDifficulty,
} from "@/games/reflection/problem-selection";
import type { ReflectionBoard } from "@/games/reflection/puzzle/board";
import { writeReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { readPlayRecords } from "@/records/storage";
import { ReflectionPlayView } from "@/views/ReflectionPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "reflection-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(() => problemSeed),
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

beforeEach(() => {
  writeReflectionHowToPlaySeen();
});

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/reflection/play/:difficulty"
          element={<ReflectionPlayView />}
        />
        <Route path="/puzzles/reflection" element={<p>難易度選択画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getBoardCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: `${REFLECTION_DISPLAY_NAME}盤面` }),
  ).getAllByRole("button");
}

// 問題集に無い（7×7・3ピースは提供範囲外の）問題。
const specifiedProblemIdentity = createReflectionProblemIdentity(7, 3, 0);
const specifiedProblemPath = `/puzzles/reflection/play/1?${formatReflectionProblemQuery(specifiedProblemIdentity)}`;
const poolProblemReference = { poolVersion: "3", problemId: "2-1" };
const poolProblemPath = `/puzzles/reflection/play/1?${formatReflectionPoolProblemQuery(poolProblemReference)}`;

/** 解どおりに、ストックの種類を選んでからマスを押して置く。 */
function solve(solution: ReflectionBoard): void {
  const stock = screen.getByRole("group", { name: "ストック" });
  const cells = getBoardCells();
  solution.cells.forEach((piece, cellIndex) => {
    if (piece === null) return;
    const stockButton = within(stock).getByRole("button", {
      name: new RegExp(`^${reflectionPieceLabels[piece]} `),
    });
    // 置いた後も同じ種類が残っていれば選択が続くので、選ばれていない時だけ押す。
    if (stockButton.getAttribute("aria-pressed") !== "true") {
      fireEvent.click(stockButton);
    }
    fireEvent.click(cells[cellIndex] as HTMLElement);
  });
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/reflection/play/:difficulty",
        element: <ReflectionPlayView />,
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

describe("ReflectionPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/1");
    });

    test("空の盤面とストックを持つプレイ画面を表示すること", () => {
      const cells = getBoardCells();
      const stock = within(
        screen.getByRole("group", { name: "ストック" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(25);
      expect(cells.every((cell) => cell.textContent === "")).toBe(true);
      expect(stock.length).toBeGreaterThan(0);
    });

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューの難易度変更で難易度選択画面へ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("内部診断を使えないビルドではメニューに検証情報を出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("通常の出題を解き終えた場合", () => {
    const selected = selectReflectionProblemForDifficulty("1", problemSeed);

    beforeEach(() => {
      renderAt("/puzzles/reflection/play/1");
      solve(selected.problem.solution);
    });

    test("結果画面で難易度とスコアを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("遊んだ問題と作業の量とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "reflection",
        payload: {
          difficulty: "1",
          problemIdentity: selected.identity,
          workload: selected.workload,
          performance: { relocationCount: 0, restartCount: 0 },
        },
      });
    });

    test("記録を確認で記録画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

      expect(screen.getByText("記録画面")).toBeTruthy();
    });

    test("難易度変更で難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    describe("同じ問題をもう一度解いた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
        solve(selected.problem.solution);
      });

      test("もう1件の記録として保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(2);
      });
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/3");
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      // 出題した難易度と、分析し直した分類。
      expect(within(dialog).getAllByText("レベル 3")).toHaveLength(2);
      expect(within(dialog).getByText(/^rf-/)).toBeTruthy();
      expect(within(dialog).getByText(/^v3 \/ 3-\d+$/)).toBeTruthy();
      expect(within(dialog).getByText("L3")).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/reflection/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/reflection");
    });
  });

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      renderAt(specifiedProblemPath);
    });

    test("指定を無視して難易度の問題を出すこと", () => {
      const cells = getBoardCells();

      expect(cells).toHaveLength(25);
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(specifiedProblemPath);
    });

    test("指定した問題を出すこと", () => {
      const cells = getBoardCells();

      expect(cells).toHaveLength(49);
    });

    describe("解き終えた場合", () => {
      beforeEach(() => {
        solve(
          generateReflectionProblem(specifiedProblemIdentity).problem.solution,
        );
      });

      test("結果で難易度を伏せること", () => {
        const resultScreen = within(
          screen.getByRole("region", { name: "プレイ結果" }),
        );

        expect(resultScreen.getByText("問題指定")).toBeTruthy();
        expect(resultScreen.queryByText("レベル 1")).toBeNull();
      });

      test("問題集に無い問題なのでスコアを出さないこと", () => {
        const reason = screen.getByText(
          "問題集に無い問題のため、スコアは出しません。",
        );

        expect(reason).toBeTruthy();
      });

      test("記録を保存しないこと", () => {
        const records = readPlayRecords();

        expect(records).toEqual([]);
      });
    });
  });

  describe("内部診断を使えるビルドで問題集の問題を指定して解いた場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(poolProblemPath);
      solve(
        restoreReflectionPoolProblem(poolProblemReference)?.problem
          .solution as ReflectionBoard,
      );
    });

    test("難易度を伏せてスコアを出すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(resultScreen.getByText("問題指定")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("記録を保存しないこと", () => {
      const records = readPlayRecords();

      expect(records).toEqual([]);
    });

    describe("結果画面から別の問題を解いた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));
        solve(
          selectReflectionProblemForDifficulty("1", problemSeed).problem
            .solution,
        );
      });

      test("URL の難易度として結果を出し、記録を保存すること", () => {
        const resultScreen = within(
          screen.getByRole("region", { name: "プレイ結果" }),
        );
        const records = readPlayRecords();

        expect(resultScreen.getByText("レベル 1")).toBeTruthy();
        expect(records).toHaveLength(1);
      });
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/reflection/play/1?seed=abc&size=12&pieces=3");
    });

    test("指定を復元できないことを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/reflection");
    });
  });

  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      selectReflectionProblemForDifficulty("1", "problem-id-query").identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/reflection/play/1");
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
          `/puzzles/reflection/play/1?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
      });
    });

    describe("内部診断を使えるビルドで遊び比べの問題を指定した場合", () => {
      beforeEach(() => {
        internalDiagnostics.available = true;
        router = renderRouterAt(specifiedProblemPath);
      });

      test("URLに問題IDを加えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBeNull();
        expect(router.state.historyAction).toBe("POP");
      });
    });

    describe("内部診断を使えるビルドで問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        internalDiagnostics.available = true;
        router = renderRouterAt(
          `/puzzles/reflection/play/1?problem=${poolProblemId}`,
        );
      });

      test("遊び比べの問題指定とみなさず、その問題で始めること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
        expect(screen.queryByText("指定された問題を復元できません")).toBeNull();
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
            `/puzzles/reflection/play/${difficulty}?problem=${requestedProblemId}`,
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

describe("直前の問題を避ける location state", () => {
  const firstProblem = selectReflectionProblemForDifficulty(
    "1",
    "avoided-first",
  );
  const secondProblem = selectReflectionProblemForDifficulty(
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
        pathname: "/puzzles/reflection/play/1",
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
        pathname: "/puzzles/reflection/play/1",
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
