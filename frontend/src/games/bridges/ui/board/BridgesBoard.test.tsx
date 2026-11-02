import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  type BridgesBoard as BridgesBoardState,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";

afterEach(cleanup);

function renderBoard(
  board: BridgesBoardState,
  onCycleEdge: (edge: number) => void = vi.fn(),
) {
  return (
    <BridgesBoard
      board={board}
      bridges={getBridgesNetwork(board).edges.map(() => 0)}
      islandStatuses={board.islands.map(() => "short")}
      edgeNotice={null}
      clearing={false}
      interactionDisabled={false}
      onCycleEdge={onCycleEdge}
      onClearAnimationComplete={vi.fn()}
    />
  );
}

function listTabbableIslands(): HTMLElement[] {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("tabindex") === "0");
}

describe("BridgesBoard", () => {
  describe("島の多い盤面の最後の島を選んでから、島の少ない盤面へ移った場合", () => {
    const manyIslands = parseBridgesBoard([
      "2.2.2.",
      "......",
      "2.2.2.",
      "......",
      "......",
      "......",
    ]);
    const fewIslands = parseBridgesBoard([
      "1.1...",
      "......",
      "......",
      "......",
      "......",
      "......",
    ]);

    beforeEach(() => {
      const { rerender } = render(renderBoard(manyIslands));
      screen.getAllByRole("button").at(-1)?.focus();
      rerender(renderBoard(fewIslands));
    });

    test("今の盤面の島のボタンが1つだけ Tab で選べること", () => {
      const tabbable = listTabbableIslands();

      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.textContent).toMatch(/^1行3列の島/);
    });
  });
});

describe("BridgesBoard の交点", () => {
  // 辺2（縦 x=2.5）と辺3（横 y=2.5）が (2.5, 2.5) で交わる。1マスを 100px で置く。
  const crossingBoard = parseBridgesBoard([
    "1.1..",
    ".....",
    "1...1",
    ".....",
    "..1..",
  ]);
  const onCycleEdge = vi.fn();
  let container: HTMLElement;

  beforeEach(() => {
    container = render(renderBoard(crossingBoard, onCycleEdge)).container;
    const surface = screen.getByRole("group");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 500, 500),
    );
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 300,
      clientY: 200,
    });
  });

  test("2本の線から同じ距離の所を押すと、橋を回さずに候補の2本の線を描くこと", () => {
    const candidates = container.querySelectorAll(
      "[data-bridges-ambiguous] line",
    );

    expect(onCycleEdge).not.toHaveBeenCalled();
    expect(candidates).toHaveLength(2);
  });
});
