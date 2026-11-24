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
import { magicSquareCatalogEntry } from "@/app/game-integration/magic-square/magic-square-catalog-entry";
import { readPlayRecords } from "@/features/records/storage";
import { listMagicSquarePoolProblemIds } from "@/games/magic-square/problem/problem-pool";
import { testPlayUrl } from "@/testing/play-url";
import { MagicSquarePlayView } from "@/views/MagicSquarePlayView";
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

const [levelOneProblemId] = listMagicSquarePoolProblemIds("1");

/** レベル1の問題の答え。空きマスの名前と、そこに入る数。 */
const solvingEntries = [
  ["1行1列 空き", 14],
  ["1行4列 空き", 11],
  ["2行1列 空き", 9],
  ["2行3列 空き", 7],
  ["2行4列 空き", 16],
  ["3行1列 空き", 8],
  ["3行2列 空き", 13],
  ["4行2列 空き", 15],
] as const;

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[testPlayUrl(magicSquareCatalogEntry, path)]}>
      <Routes>
        <Route
          path="/puzzles/magic-square/play/:problemId"
          element={<MagicSquarePlayView />}
        />
        <Route
          path="/puzzles/magic-square"
          element={<p>ゲームのホーム画面</p>}
        />
        <Route path="/records" element={<p>記録画面</p>} />
        <Route
          path="/puzzles/:game/result/:recordId"
          element={<PlayResultView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function place(cellName: string, value: number): void {
  fireEvent.click(screen.getByRole("button", { name: cellName }));
  fireEvent.click(
    within(screen.getByRole("group", { name: "盤面の下に並んだ数" })).getByText(
      String(value),
    ),
  );
}

describe("MagicSquarePlayView", () => {
  describe("問題集にある問題IDで開いた場合", () => {
    beforeEach(() => {
      renderAt(`/puzzles/magic-square/play/${levelOneProblemId}`);
    });

    test("4×4 の盤面と 1〜16 の数の欄を持つプレイ画面を表示すること", () => {
      const cells = within(
        screen.getByRole("group", { name: "魔方陣の盤面" }),
      ).getAllByRole("button");
      const values = within(
        screen.getByRole("group", { name: "盤面の下に並んだ数" }),
      )
        .getAllByRole("button")
        .filter((button) => /^\d+$/.test(button.textContent ?? ""));

      expect([cells.length, values.length]).toEqual([16, 16]);
    });

    test("戻るボタンでゲームのホーム画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));

      expect(screen.getByText("ゲームのホーム画面")).toBeTruthy();
    });

    describe("解き終えた場合", () => {
      beforeEach(() => {
        for (const [cellName, value] of solvingEntries) {
          place(cellName, value);
        }
      });

      test("完成演出の後に記録の結果画面へ移り、置き直しの回数を示すこと", async () => {
        const heading = await screen.findByRole(
          "heading",
          { name: "プレイ結果" },
          { timeout: 3_000 },
        );
        const correctionMetric = screen.getByText("置き直し", {
          selector: "dt",
        }).parentElement!;

        expect([
          heading,
          within(correctionMetric).queryByText("0回"),
        ]).not.toContain(null);
      });

      test("遊んだ問題とプレイの事実を記録へ保存すること", async () => {
        await screen.findByRole(
          "heading",
          { name: "プレイ結果" },
          { timeout: 3_000 },
        );

        const records = readPlayRecords();

        expect(records[0]).toMatchObject({
          gameId: "magic-square",
          payload: {
            difficulty: "1",
            workload: { emptyCellCount: 8 },
            performance: { correctionCount: 0, undoCount: 0, restartCount: 0 },
          },
        });
      });
    });
  });

  describe("内部診断を使える環境の場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(`/puzzles/magic-square/play/${levelOneProblemId}`);
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(within(dialog).getByText("4×4")).toBeTruthy();
    });
  });

  describe("問題集に無い問題IDで開いた場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/magic-square/play/unknown");
    });

    test("遊べないことを示しゲームのホームへ戻る導線を出すこと", () => {
      const backLink = screen.getByRole("link", { name: "問題選択へ戻る" });

      expect([
        screen.getByText("この問題は現在遊べません"),
        backLink.getAttribute("href"),
      ]).toEqual([expect.anything(), "/puzzles/magic-square"]);
    });
  });

  describe("問題IDで開いてメニューからゲームのホームを選んだ場合", () => {
    let router: ReturnType<typeof createMemoryRouter>;

    beforeEach(() => {
      router = createMemoryRouter(
        [
          {
            path: "/puzzles/magic-square/play/:problemId",
            element: <MagicSquarePlayView />,
          },
          { path: "/puzzles/magic-square", element: <p>ゲームのホーム画面</p> },
        ],
        {
          initialEntries: [`/puzzles/magic-square/play/${levelOneProblemId}`],
        },
      );
      render(<RouterProvider router={router} />);
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "問題選択" }));

      const { historyAction, location } = router.state;
      expect([location.pathname, location.search, historyAction]).toEqual([
        "/puzzles/magic-square",
        `?problem=${levelOneProblemId}`,
        "REPLACE",
      ]);
    });
  });
});
