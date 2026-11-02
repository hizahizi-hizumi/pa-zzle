import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  selectHamiltonianPathProblemById,
  selectHamiltonianPathProblemForDifficulty,
} from "@/games/hamiltonian-path/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { HamiltonianPathPlayView } from "@/views/HamiltonianPathPlayView";

const problemSeed = "hamiltonian-path-play-view";

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
      </Routes>
    </MemoryRouter>,
  );
}

function listCells(): HTMLElement[] {
  return within(
    screen.getByRole("group", { name: "ハミルトン路盤面" }),
  ).getAllByRole("button");
}

function tapCell(cell: number): void {
  fireEvent.click(listCells()[cell] as HTMLElement);
}

describe("HamiltonianPathPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    const { problem, identity } = selectHamiltonianPathProblemForDifficulty(
      "1",
      problemSeed,
    );
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

    describe("解の道どおりに全マスを通った場合", () => {
      beforeEach(() => {
        for (const cell of solution.slice(1)) {
          tapCell(cell);
        }
      });

      test("盤面の操作を受け付けなくなること", () => {
        const enabledCells = listCells().filter(
          (cell) => !(cell as HTMLButtonElement).disabled,
        );

        expect(enabledCells).toHaveLength(0);
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
