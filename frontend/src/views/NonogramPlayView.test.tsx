import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { readPlayRecords } from "@/records/storage";
import { NonogramPlayView } from "@/views/NonogramPlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "nonogram-play-view";

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

function LocationSearch() {
  return <output aria-label="URL のクエリ">{useLocation().search}</output>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/nonogram/play/:difficulty"
          element={
            <>
              <NonogramPlayView />
              <LocationSearch />
            </>
          }
        />
        <Route path="/puzzles/nonogram" element={<p>難易度選択画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
        <Route
          path="/puzzles/:game/result/:recordId"
          element={<PlayResultView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function listCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: "ノノグラム盤面" }),
  ).getAllByRole("button");
}

/** キーボードでマスを押す。 */
function pressCell(cellIndex: number): void {
  fireEvent.click(listCells()[cellIndex] as HTMLElement, { detail: 0 });
}

describe("NonogramPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    const { problem, identity } = selectNonogramProblemForDifficulty(
      "1",
      problemSeed,
    );

    beforeEach(() => {
      renderAt("/puzzles/nonogram/play/1");
    });

    test("選んだ問題の盤面と、その問題 ID の URL を示すこと", () => {
      const cells = listCells();
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(cells).toHaveLength(problem.width * problem.height);
      expect(search.textContent).toBe(`?problem=${createProblemId(identity)}`);
    });
  });

  describe("解き終えた場合", () => {
    const { problem } = selectNonogramProblemForDifficulty("1", problemSeed);
    const firstBlackCellIndex = problem.solution.black.indexOf(true);

    function solve(): void {
      for (const [cellIndex, isBlack] of problem.solution.black.entries()) {
        if (isBlack) {
          pressCell(cellIndex);
        }
      }
    }

    describe("塗りを待ったで取り消してから解いた場合", () => {
      beforeEach(() => {
        renderAt("/puzzles/nonogram/play/1");
        pressCell(firstBlackCellIndex);
        fireEvent.click(screen.getByRole("button", { name: "待った" }));
        solve();
      });

      test("記録の結果画面で、待ったで消えた塗りを塗り直しとして示すこと", () => {
        const heading = screen.getByRole("heading", { name: "プレイ結果" });
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(heading).toBeTruthy();
        // 時間・基準時間との差に続く、塗り直したマスの数。
        expect(definitions).toEqual([
          expect.any(String),
          expect.any(String),
          "1マス",
        ]);
      });

      test("遊んだ問題の作業の量とプレイの事実を記録へ保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          gameId: "nonogram",
          payload: {
            difficulty: "1",
            workload: {
              width: problem.width,
              height: problem.height,
              filledCellCount: problem.solution.black.filter(Boolean).length,
            },
            performance: { repaintCount: 1, undoCount: 1, restartCount: 0 },
          },
        });
      });

      test("記録を確認で記録画面へ移ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

        expect(screen.getByText("記録画面")).toBeTruthy();
      });

      describe("同じ問題を塗り直しなしで解き直した場合", () => {
        beforeEach(() => {
          fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
          solve();
        });

        test("塗り直しの自己ベスト更新を知らせること", () => {
          const bestUpdate = screen.getByRole("region", {
            name: "自己ベスト更新",
          });

          expect(bestUpdate.textContent).toContain("塗り直し");
          expect(bestUpdate.textContent).toContain("1マス減");
        });
      });
    });
  });

  describe("URL の問題 ID で問題を指定した場合", () => {
    const requested = selectNonogramProblemForDifficulty(
      "5",
      "nonogram-requested",
    );
    const problemId = createProblemId(requested.identity);

    beforeEach(() => {
      renderAt(`/puzzles/nonogram/play/5?problem=${problemId}`);
    });

    test("指定した問題で始めること", () => {
      const cells = listCells();
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(cells).toHaveLength(
        requested.problem.width * requested.problem.height,
      );
      expect(search.textContent).toBe(`?problem=${problemId}`);
    });
  });

  describe("内部診断を使える環境の場合", () => {
    const { identity } = selectNonogramProblemForDifficulty("2", problemSeed);

    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/nonogram/play/2");
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      expect(within(dialog).getByText("レベル 2")).toBeTruthy();
      expect(within(dialog).getByText(identity.seed)).toBeTruthy();
    });
  });

  describe("定義されていない難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/nonogram/play/6");
    });

    test("この難易度は選べないことを示すこと", () => {
      const notice = screen.getByText("この難易度は選べません");

      expect(notice).toBeDefined();
    });
  });
});
