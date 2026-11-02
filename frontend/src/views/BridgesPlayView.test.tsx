import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { BridgesPlayView } from "@/views/BridgesPlayView";

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

const { problem, identity } = selectBridgesProblemForDifficulty("1", "seed");
/** 盤面を1マス 100px で置く。 */
const cellPixels = 100;
const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

type CellPosition = readonly [row: number, column: number];

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
function tapBetween(from: CellPosition, to: CellPosition): void {
  fireEvent.pointerDown(getBoard(), {
    ...touch,
    ...pointToward(from, to, 0.75),
  });
  fireEvent.pointerUp(getBoard(), { ...touch, ...pointToward(from, to, 0.75) });
}

/** `from` の島の丸の中から押し、`to` の島の向きへ丸の外までなぞって離す。 */
function dragBetween(from: CellPosition, to: CellPosition): void {
  fireEvent.pointerDown(getBoard(), { ...touch, ...pointToward(from, to, 0) });
  fireEvent.pointerUp(getBoard(), { ...touch, ...pointToward(from, to, 0.9) });
}

function countBridgeLines(): number {
  return getBoard().querySelectorAll("line").length;
}

/** 固定問題の解。2本の橋の1つはタップで、もう1つはなぞりで架ける。 */
const singleBridges: readonly [CellPosition, CellPosition][] = [
  [
    [0, 0],
    [0, 3],
  ],
  [
    [0, 0],
    [2, 0],
  ],
  [
    [0, 3],
    [0, 6],
  ],
  [
    [0, 6],
    [2, 6],
  ],
  [
    [1, 4],
    [3, 4],
  ],
  [
    [2, 0],
    [2, 2],
  ],
  [
    [2, 0],
    [6, 0],
  ],
  [
    [2, 6],
    [6, 6],
  ],
  [
    [3, 1],
    [3, 4],
  ],
  [
    [3, 1],
    [5, 1],
  ],
  [
    [3, 4],
    [6, 4],
  ],
  [
    [5, 1],
    [5, 3],
  ],
];
const tappedDouble: [CellPosition, CellPosition] = [
  [1, 1],
  [1, 4],
];
const draggedDouble: [CellPosition, CellPosition] = [
  [6, 4],
  [6, 0],
];
const lastBridge: [CellPosition, CellPosition] = [
  [6, 4],
  [6, 6],
];

function solveAllButLast(): void {
  for (const [from, to] of singleBridges) {
    tapBetween(from, to);
  }
  tapBetween(...tappedDouble);
  tapBetween(...tappedDouble);
  dragBetween(...draggedDouble);
  dragBetween(...draggedDouble);
}

describe("BridgesPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/1");
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

      expect(countBridgeLines()).toBe(0);
      expect(search.textContent).toBe(`?problem=${createProblemId(identity)}`);
    });

    test("島と島の間を押すたびに橋が1本 → 2本 → なしと変わること", () => {
      const counts = [1, 2, 3].map(() => {
        tapBetween(...tappedDouble);
        return countBridgeLines();
      });

      expect(counts).toEqual([1, 2, 0]);
    });

    test("島から隣の島の向きへなぞると橋を架けること", () => {
      dragBetween(...draggedDouble);

      expect(countBridgeLines()).toBe(1);
    });

    test("島の丸の中で離すと橋を架けないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        ...pointToward([6, 4], [6, 0], 0),
      });
      fireEvent.pointerUp(getBoard(), {
        ...touch,
        ...pointToward([6, 4], [6, 0], 0.3),
      });

      expect(countBridgeLines()).toBe(0);
    });

    describe("交わる所に橋がある場合", () => {
      beforeEach(() => {
        tapBetween([2, 0], [2, 2]);
      });

      test("交わる辺には架けないこと", () => {
        dragBetween([1, 1], [3, 1]);

        expect(countBridgeLines()).toBe(1);
      });
    });

    test("待ったで直前の橋を取り消すこと", () => {
      tapBetween(...tappedDouble);
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(countBridgeLines()).toBe(0);
    });

    describe("最後の1本を除いて解いた場合", () => {
      beforeEach(() => {
        solveAllButLast();
      });

      test("最後の1本を架けると盤面を見せたまま操作を受け付けなくなること", () => {
        tapBetween(...lastBridge);
        const linesAfterClear = countBridgeLines();
        tapBetween(...lastBridge);

        expect(countBridgeLines()).toBe(linesAfterClear);
        expect(linesAfterClear).toBe(17);
        expect(
          screen
            .getByRole("button", { name: "待った" })
            .hasAttribute("disabled"),
        ).toBe(true);
      });
    });
  });

  describe("URL の問題 ID が引けない場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/3?problem=unknown");
    });

    test("難易度の問題を選び、その問題 ID に URL を置き換えること", () => {
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(search.textContent).toBe(`?problem=${createProblemId(identity)}`);
    });
  });

  describe("定義されていない難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/9");
    });

    test("遊べないことを示し、難易度選択へ戻れること", () => {
      fireEvent.click(screen.getByRole("link", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });
  });
});
