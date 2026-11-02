import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  bridgesDirections,
  findBridgesEdgeToward,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { createProblemId } from "@/games/problem-id";
import { BridgesPlayView } from "@/views/BridgesPlayView";

const problemSeed = "bridges-play-view";

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
          path="/puzzles/bridges/play/:difficulty"
          element={
            <>
              <BridgesPlayView />
              <LocationSearch />
            </>
          }
        />
        <Route path="/puzzles/bridges" element={<p>難易度選択画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const { problem, identity } = selectBridgesProblemForDifficulty(
  "5",
  problemSeed,
);
const network = getBridgesNetwork(problem);
const solution = countBridgesSolutions(problem, {
  limit: 1,
  nodeLimit: 200_000,
}).firstSolution!;
/** 盤面を1マス 100px で置く。 */
const cellPixels = 100;
const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

type CellPosition = readonly [row: number, column: number];
type EdgeEnds = readonly [CellPosition, CellPosition];

function getEdgeEnds(edge: number): EdgeEnds {
  const { from, to } = network.edges[edge]!;
  const a = problem.islands[from]!;
  const b = problem.islands[to]!;
  return [
    [a.row, a.column],
    [b.row, b.column],
  ];
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", {
    name: `${BRIDGES_DISPLAY_NAME}盤面 ${problem.height}行${problem.width}列`,
  });
}

/** `from` の島の中心から `to` の島へ向かって `reach` マス進んだ所の画面座標。 */
function pointToward(from: CellPosition, to: CellPosition, reach: number) {
  const [fromRow, fromColumn] = from;
  const [toRow, toColumn] = to;
  return {
    clientX:
      (fromColumn + 0.5 + Math.sign(toColumn - fromColumn) * reach) *
      cellPixels,
    clientY: (fromRow + 0.5 + Math.sign(toRow - fromRow) * reach) * cellPixels,
  };
}

/** 2島の間の、島の丸のすぐ外の線の上を押す。 */
function tapBetween([from, to]: EdgeEnds): void {
  fireEvent.pointerDown(getBoard(), {
    ...touch,
    ...pointToward(from, to, 0.75),
  });
  fireEvent.pointerUp(getBoard(), { ...touch, ...pointToward(from, to, 0.75) });
}

/** `from` の島の丸の中から押し、`to` の島の向きへ丸の外までなぞって離す。 */
function dragBetween([from, to]: EdgeEnds): void {
  fireEvent.pointerDown(getBoard(), { ...touch, ...pointToward(from, to, 0) });
  fireEvent.pointerUp(getBoard(), { ...touch, ...pointToward(from, to, 0.9) });
}

/** 盤面の読み上げの、島ごとの行（「1行3列の島 数字2 橋1本 ちょうど」）。 */
function readIslands(): string[] {
  return within(getBoard())
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

/** 盤面の読み上げから、全島の橋の本数の合計を求める。橋1本を両端の島で2回数える。 */
function countPlacedBridges(): number {
  const total = readIslands().reduce(
    (sum, text) => sum + Number(/橋(\d+)本/.exec(text)?.[1]),
    0,
  );
  return total / 2;
}

/** 盤面の読み上げの、その島の行。 */
function readIsland([row, column]: CellPosition): string {
  return readIslands().find((text) =>
    text.startsWith(`${row + 1}行${column + 1}列の島`),
  )!;
}

const solutionEdges = solution.flatMap((count, edge) =>
  count === 0 ? [] : [edge],
);
const doubleEdge = getEdgeEnds(solution.indexOf(2));
const crossingEdge = network.crossingEdges.findIndex(
  (crossings) => crossings.length > 0,
);
const crossedEdge = network.crossingEdges[crossingEdge]![0]!;
const lastEdge = solutionEdges.at(-1)!;
const solutionLineCount = solution.reduce((total, count) => total + count, 0);

/** 解の橋を、最後の辺の最後の1本を除いて架ける。2本の辺の2本目は、なぞりで架ける。 */
function solveAllButLast(): void {
  for (const edge of solutionEdges) {
    const ends = getEdgeEnds(edge);
    const count = edge === lastEdge ? solution[edge]! - 1 : solution[edge]!;
    for (let bridge = 0; bridge < count; bridge += 1) {
      if (bridge === 0) {
        tapBetween(ends);
      } else {
        dragBetween(ends);
      }
    }
  }
}

describe("BridgesPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/5");
      vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(
        new DOMRect(
          0,
          0,
          problem.width * cellPixels,
          problem.height * cellPixels,
        ),
      );
    });

    test("橋の無い盤面と、その問題 ID の URL を示すこと", () => {
      const search = screen.getByRole("status", { name: "URL のクエリ" });
      const bridgeCount = countPlacedBridges();

      expect({ bridgeCount, query: search.textContent }).toEqual({
        bridgeCount: 0,
        query: `?problem=${createProblemId(identity)}`,
      });
    });

    test("島と島の間を押すたびに橋が1本 → 2本 → なしと変わること", () => {
      const counts = [1, 2, 3].map(() => {
        tapBetween(doubleEdge);
        return countPlacedBridges();
      });

      expect(counts).toEqual([1, 2, 0]);
    });

    test("島から隣の島の向きへなぞると橋を架けること", () => {
      dragBetween(doubleEdge);
      const island = readIsland(doubleEdge[0]);

      expect(island).toContain("橋1本");
    });

    test("島の丸の中で離すと橋を架けないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        ...pointToward(...doubleEdge, 0),
      });
      fireEvent.pointerUp(getBoard(), {
        ...touch,
        ...pointToward(...doubleEdge, 0.3),
      });
      const bridgeCount = countPlacedBridges();

      expect(bridgeCount).toBe(0);
    });

    describe("交わる所に橋がある場合", () => {
      beforeEach(() => {
        tapBetween(getEdgeEnds(crossingEdge));
      });

      test("交わる辺には架けないこと", () => {
        dragBetween(getEdgeEnds(crossedEdge));
        const bridgeCount = countPlacedBridges();

        expect(bridgeCount).toBe(1);
      });
    });

    test("待ったで直前の橋を取り消すこと", () => {
      tapBetween(doubleEdge);
      fireEvent.click(screen.getByRole("button", { name: "待った" }));
      const bridgeCount = countPlacedBridges();

      expect(bridgeCount).toBe(0);
    });

    describe("キーボードで島を選んだ場合", () => {
      const direction = bridgesDirections.find(
        (candidate) => findBridgesEdgeToward(problem, 0, candidate) !== null,
      )!;
      const arrowKey = {
        up: "ArrowUp",
        right: "ArrowRight",
        down: "ArrowDown",
        left: "ArrowLeft",
      }[direction];
      const first = problem.islands[0]!;
      const firstLabel = `${first.row + 1}行${first.column + 1}列の島`;

      beforeEach(() => {
        within(getBoard())
          .getByRole("button", { name: new RegExp(`^${firstLabel}`) })
          .focus();
      });

      test("Shift と矢印キーで、その向きの辺の橋を架けること", () => {
        fireEvent.keyDown(document.activeElement!, {
          key: arrowKey,
          shiftKey: true,
        });
        const island = readIsland([first.row, first.column]);

        expect(island).toContain("橋1本");
      });

      test("矢印キーで、その向きの隣の島へ移ること", () => {
        fireEvent.keyDown(document.activeElement!, { key: arrowKey });
        const focused = document.activeElement?.textContent ?? "";

        expect(focused.startsWith(firstLabel)).toBe(false);
      });
    });

    describe("最後の1本を除いて解いた場合", () => {
      beforeEach(() => {
        solveAllButLast();
      });

      test("最後の1本を架けると盤面を見せたまま操作を受け付けなくなること", () => {
        tapBetween(getEdgeEnds(lastEdge));
        const islandsAfterClear = readIslands();
        tapBetween(getEdgeEnds(lastEdge));
        const islandsAfterTap = readIslands();
        const bridgeCount = countPlacedBridges();
        const undoDisabled = screen
          .getByRole("button", { name: "待った" })
          .hasAttribute("disabled");

        expect({
          allExact: islandsAfterClear.every((text) =>
            text.endsWith("ちょうど"),
          ),
          bridgeCount,
          unchanged: islandsAfterTap.join("/") === islandsAfterClear.join("/"),
          undoDisabled,
        }).toEqual({
          allExact: true,
          bridgeCount: solutionLineCount,
          unchanged: true,
          undoDisabled: true,
        });
      });
    });
  });

  describe("URL の問題 ID が引けない場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/3?problem=unknown");
    });

    const expected = selectBridgesProblemForDifficulty("3", problemSeed);

    test("難易度の問題を選び、その問題 ID に URL を置き換えること", () => {
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(search.textContent).toBe(
        `?problem=${createProblemId(expected.identity)}`,
      );
    });
  });

  describe("定義されていない難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/9");
    });

    test("遊べないことを示し、難易度選択へ戻れること", () => {
      fireEvent.click(screen.getByRole("link", { name: "難易度選択へ戻る" }));
      const destination = screen.queryByText("難易度選択画面");

      expect(destination).not.toBeNull();
    });
  });
});
