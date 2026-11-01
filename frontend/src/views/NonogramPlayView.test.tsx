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
import { NonogramPlayView } from "@/views/NonogramPlayView";

const problemSeed = "nonogram-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
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

    describe("図柄の黒マスをすべて塗った場合", () => {
      beforeEach(() => {
        for (const [cellIndex, isBlack] of problem.solution.black.entries()) {
          if (isBlack) {
            pressCell(cellIndex);
          }
        }
      });

      test("盤面を押せなくし、完成した図柄を見せたままにすること", () => {
        const cells = listCells();

        expect(cells.every((cell) => cell.hasAttribute("disabled"))).toBe(true);
        expect(
          cells.filter((cell) =>
            cell.getAttribute("aria-label")?.endsWith("塗り"),
          ),
        ).toHaveLength(problem.solution.black.filter(Boolean).length);
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
