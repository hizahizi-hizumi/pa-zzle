import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  selectHamiltonianPathProblemById,
  selectHamiltonianPathProblemForDifficulty,
} from "@/games/hamiltonian-path/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { HamiltonianPathPlayView } from "@/views/HamiltonianPathPlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "hamiltonian-path-play-view";

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
          path="/puzzles/hamiltonian-path/play/:difficulty"
          element={
            <>
              <HamiltonianPathPlayView />
              <LocationSearch />
            </>
          }
        />
        <Route
          path="/puzzles/hamiltonian-path"
          element={<p>難易度選択画面</p>}
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

function listCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: `${HAMILTONIAN_PATH_DISPLAY_NAME}盤面` }),
  ).getAllByRole("button");
}

function tapCell(cell: number): void {
  fireEvent.click(listCells()[cell] as HTMLElement);
}

/** 盤面を一辺 `boardWidth` px の正方形として置き、マスの中心の座標を返す。 */
const boardWidth = 300;

function getCellCenter(size: number, cell: number) {
  const cellWidth = boardWidth / size;
  return {
    clientX: ((cell % size) + 0.5) * cellWidth,
    clientY: (Math.floor(cell / size) + 0.5) * cellWidth,
  };
}

/** `cells` の先頭のマスを指で押し、残りのマスを順になぞって離す。 */
function dragThrough(size: number, [pressed, ...cells]: readonly number[]) {
  const surface = screen.getByRole("group", {
    name: `${HAMILTONIAN_PATH_DISPLAY_NAME}盤面`,
  });
  const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };
  fireEvent.pointerDown(surface, {
    ...touch,
    ...getCellCenter(size, pressed!),
  });
  for (const cell of cells) {
    fireEvent.pointerMove(surface, { ...touch, ...getCellCenter(size, cell) });
  }
  fireEvent.pointerUp(surface, touch);
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getHeadCell(): number {
  return listCells().findIndex((cell) =>
    cell.getAttribute("aria-label")?.includes("先端"),
  );
}

describe("HamiltonianPathPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    const { problem, identity, workload } =
      selectHamiltonianPathProblemForDifficulty("1", problemSeed);
    const { solution } = generateHamiltonianPathProblem(identity);

    beforeEach(() => {
      renderAt("/puzzles/hamiltonian-path/play/1");
    });

    test("選んだ問題の盤面と、その問題 ID の URL を示すこと", () => {
      const cells = listCells();
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(cells).toHaveLength(problem.size * problem.size);
      expect(cells[problem.start]?.getAttribute("aria-label")).toContain(
        "始点",
      );
      expect(search.textContent).toBe(`?problem=${createProblemId(identity)}`);
    });

    describe("先端に隣り合うマスを押した場合", () => {
      beforeEach(() => {
        tapCell(solution[1]!);
      });

      test("そのマスへ道を延ばして先端にすること", () => {
        const label = listCells()[solution[1]!]?.getAttribute("aria-label");

        expect(label).toContain("先端");
      });

      test("始点を押すと道を始点だけに戻すこと", () => {
        tapCell(problem.start);

        expect(listCells()[solution[1]!]?.getAttribute("aria-label")).toContain(
          "未通過",
        );
      });

      test("待ったで延ばした道を取り消すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "待った" }));

        expect(
          listCells()[problem.start]?.getAttribute("aria-label"),
        ).toContain("先端");
      });
    });

    describe("盤面を指でなぞった場合", () => {
      beforeEach(() => {
        vi.spyOn(
          screen.getByRole("group", {
            name: `${HAMILTONIAN_PATH_DISPLAY_NAME}盤面`,
          }),
          "getBoundingClientRect",
        ).mockReturnValue(new DOMRect(0, 0, boardWidth, boardWidth));
        dragThrough(problem.size, solution.slice(0, 5));
      });

      test("指の通ったマスへ道を延ばすこと", () => {
        const head = getHeadCell();

        expect(head).toBe(solution[4]);
      });

      test("待った1回で、なぞる前の道へ戻すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "待った" }));
        const head = getHeadCell();

        expect(head).toBe(problem.start);
      });
    });

    describe("解の道どおりに全マスを通った場合", () => {
      beforeEach(() => {
        for (const cell of solution.slice(1)) {
          tapCell(cell);
        }
      });

      test("結果画面で難易度とスコアを示すこと", () => {
        const resultScreen = within(
          screen.getByRole("region", { name: "プレイ結果" }),
        );

        expect(resultScreen.getByText("レベル 1")).toBeTruthy();
        expect(
          resultScreen.getByRole("region", { name: "スコア" }),
        ).toBeTruthy();
      });

      test("遊んだ問題と作業の量とプレイの事実を記録へ保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          gameId: "hamiltonian-path",
          payload: {
            difficulty: "1",
            problemIdentity: identity,
            workload,
            performance: { backtrackCount: 0, undoCount: 0, restartCount: 0 },
          },
        });
      });

      test("記録を確認で記録画面へ移ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

        expect(screen.getByText("記録画面")).toBeTruthy();
      });

      describe("同じ問題をもう一度解いた場合", () => {
        beforeEach(() => {
          fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
          for (const cell of solution.slice(1)) {
            tapCell(cell);
          }
        });

        test("もう1件の記録として保存すること", () => {
          const records = readPlayRecords();

          expect(records).toHaveLength(2);
        });
      });
    });

    describe("途中で別の問題へ移った場合", () => {
      beforeEach(() => {
        tapCell(solution[1]!);
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
      });

      test("離れたプレイの進み具合を道の長さとともに記録すること", () => {
        const abandoned = readPlayAttempts().find(
          (attempt) => attempt.abandonment !== null,
        );

        expect(abandoned?.abandonment?.progress).toMatchObject({
          visitedCellCount: 2,
          openCellCount: workload.openCellCount,
          backtrackCount: 0,
        });
      });
    });
  });

  describe("URL の問題 ID で問題を指定した場合", () => {
    const { identity } = selectHamiltonianPathProblemForDifficulty(
      "5",
      "requested-problem",
    );
    const problemId = createProblemId(identity);
    const requested = selectHamiltonianPathProblemById("5", problemId)!;

    beforeEach(() => {
      renderAt(`/puzzles/hamiltonian-path/play/5?problem=${problemId}`);
    });

    test("その問題で始めること", () => {
      const cells = listCells();
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(cells).toHaveLength(requested.problem.size ** 2);
      expect(
        cells[requested.problem.start]?.getAttribute("aria-label"),
      ).toContain("始点");
      expect(search.textContent).toBe(`?problem=${problemId}`);
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/hamiltonian-path/play/3");
      openMenu();
    });

    test("メニューの検証情報から、出題中の問題を分析し直した検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      // 出題した難易度と、分析し直した判定。
      expect(dialog.getAllByText("レベル 3")).toHaveLength(2);
      expect(dialog.getByText(/^一意（探索 \d+節点）$/)).toBeTruthy();
    });
  });

  describe("定義されていない難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/hamiltonian-path/play/9");
    });

    test("選べないことを示して難易度選択へ戻れること", () => {
      fireEvent.click(screen.getByRole("link", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });
  });
});
