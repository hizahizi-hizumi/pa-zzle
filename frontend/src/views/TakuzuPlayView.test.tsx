import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";

import { createProblemId } from "@/games/problem-id";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import { readPlayRecords } from "@/records/storage";
import { PlayResultView } from "@/views/PlayResultView";
import { TakuzuPlayView } from "@/views/TakuzuPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "takuzu-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
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
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/takuzu/play/:difficulty"
          element={<TakuzuPlayView />}
        />
        <Route path="/puzzles/takuzu" element={<p>ゲームのホーム画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
        <Route
          path="/puzzles/:game/result/:recordId"
          element={<PlayResultView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/takuzu/play/:difficulty",
        element: <TakuzuPlayView />,
      },
      { path: "/puzzles/takuzu", element: <p>ゲームのホーム画面</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("TakuzuPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/1");
    });

    test("8×8 の盤面を持つプレイ画面を表示すること", () => {
      const cells = within(
        screen.getByRole("group", { name: "バイナリパズル盤面" }),
      ).getAllByRole("button");

      expect(cells).toHaveLength(64);
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
      });

      test("別の問題を選べること", () => {
        const result = screen.queryByRole("menuitem", { name: "別の問題" });

        expect(result).not.toBeNull();
      });

      test("ゲームのホームでゲームのホーム画面へ移ること", () => {
        fireEvent.click(
          screen.getByRole("menuitem", { name: "ゲームのホーム" }),
        );

        expect(screen.getByText("ゲームのホーム画面")).toBeTruthy();
      });

      describe("内部診断を使えない環境の場合", () => {
        test("検証情報を出さないこと", () => {
          const result = screen.queryByRole("menuitem", { name: "検証情報" });

          expect(result).toBeNull();
        });
      });
    });

    test("戻るボタンでゲームのホーム画面へ移ること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "ゲームのホームへ戻る" }),
      );

      expect(screen.getByText("ゲームのホーム画面")).toBeTruthy();
    });
  });

  describe("解き終えた場合", () => {
    const { problem } = selectTakuzuProblemForDifficulty("1", problemSeed);
    const emptyCellIndices = problem.givens.cells.flatMap((cell, cellIndex) =>
      cell === null ? [cellIndex] : [],
    );
    const correctedCellIndex = emptyCellIndices.find(
      (cellIndex) => problem.solution.cells[cellIndex] === "a",
    );

    function pressCell(cellIndex: number, times: number): void {
      for (let press = 0; press < times; press += 1) {
        const cells = within(
          screen.getByRole("group", { name: "バイナリパズル盤面" }),
        ).getAllByRole("button");
        fireEvent.click(cells[cellIndex] as HTMLElement);
      }
    }

    /** 空きマスを順に、解のタイルになるまで押す（A は1回、B は2回）。 */
    function solve(): void {
      for (const cellIndex of emptyCellIndices) {
        pressCell(cellIndex, problem.solution.cells[cellIndex] === "a" ? 1 : 2);
      }
    }

    /** A が入る最初の空きマスに B を置いて先へ進み、最後に A へ直して解き終える。 */
    function solveWithOneCorrection(): void {
      for (const cellIndex of emptyCellIndices) {
        pressCell(
          cellIndex,
          cellIndex === correctedCellIndex ||
            problem.solution.cells[cellIndex] === "b"
            ? 2
            : 1,
        );
      }
      // B → 空き → A と、別のマスへ移った後で置いたタイルを直す。
      pressCell(correctedCellIndex as number, 2);
    }

    describe("置いたタイルを待ったで取り消してから解いた場合", () => {
      beforeEach(() => {
        renderAt("/puzzles/takuzu/play/1");
        pressCell(emptyCellIndices[0] as number, 1);
        fireEvent.click(screen.getByRole("button", { name: "待った" }));
        solve();
      });

      test("待った回数を結果と記録に残し、取り消した操作を置き直しに数えないこと", () => {
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);
        const records = readPlayRecords();

        expect(definitions.slice(2)).toEqual(["0回", "1回"]);
        expect(records[0]).toMatchObject({
          payload: { performance: { correctionCount: 0, undoCount: 1 } },
        });
      });
    });

    describe("A の空きマスを一度 B にしてから直した場合", () => {
      beforeEach(() => {
        renderAt("/puzzles/takuzu/play/1");
        solveWithOneCorrection();
      });

      test("結果画面で置き直しの回数を示すこと", () => {
        const heading = screen.getByRole("heading", { name: "プレイ結果" });
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(heading).toBeTruthy();
        // 時間・基準時間との差に続く、置き直しと待ったの回数。
        expect(definitions).toEqual([
          expect.any(String),
          expect.any(String),
          "1回",
          "0回",
        ]);
      });

      test("遊んだ問題とプレイの事実を記録へ保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          gameId: "takuzu",
          payload: {
            difficulty: "1",
            performance: { correctionCount: 1, restartCount: 0, undoCount: 0 },
          },
        });
      });

      describe("同じ問題を置き直しなしで解き直した場合", () => {
        beforeEach(() => {
          fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
          solve();
        });

        test("置き直しの自己ベスト更新を知らせること", () => {
          const bestUpdate = screen.getByRole("region", {
            name: "自己ベスト更新",
          });

          expect(bestUpdate.textContent).toContain("置き直し");
          expect(bestUpdate.textContent).toContain("1回減");
        });
      });
    });
  });

  describe("内部診断を使える環境の場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/takuzu/play/2");
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(within(dialog).getByText("レベル 2")).toBeTruthy();
      expect(within(dialog).getByText(/^tk-/)).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/takuzu/play/9");
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", {
        name: "ゲームのホームへ戻る",
      });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/takuzu");
    });
  });

  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectTakuzuProblemForDifficulty("1", "game-home-navigation").identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/takuzu/play/1?problem=${poolProblemId}`,
      );
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "ゲームのホームへ戻る" }),
      );
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/takuzu");
      expect(location.search).toBe(`?problem=${poolProblemId}`);
      expect(historyAction).toBe("REPLACE");
    });

    describe("メニューからゲームのホームを選んだ場合", () => {
      beforeEach(() => {
        openMenu();
      });

      test("遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
        fireEvent.click(
          screen.getByRole("menuitem", { name: "ゲームのホーム" }),
        );
        const { historyAction, location } = router.state;

        expect(location.pathname).toBe("/puzzles/takuzu");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });
});
