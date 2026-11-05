import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

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

function readBoardSurface(): HTMLElement {
  return screen.getByRole("group");
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
    let rerender: (ui: ReactNode) => void;

    beforeEach(() => {
      rerender = render(renderBoard(manyIslands)).rerender;
      screen.getAllByRole("button").at(-1)?.focus();
    });

    test("今の盤面の島のボタンが1つだけ Tab で選べること", () => {
      rerender(renderBoard(fewIslands));
      const tabbable = listTabbableIslands();

      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.textContent).toMatch(/^1行3列の島/);
    });
  });

  describe("交わる2本の線から同じ距離の所を押した場合", () => {
    // 辺2（縦 x=2.5）と辺3（横 y=2.5）が (2.5, 2.5) で交わる。1マスを 100px で置き、(3, 2) を押す。
    const crossingBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);
    const fewEdges = parseBridgesBoard([
      "1.1..",
      ".....",
      ".....",
      ".....",
      ".....",
    ]);
    const equidistantPoint = {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 300,
      clientY: 200,
    };
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;
    let container: HTMLElement;
    let rerender: (ui: ReactNode) => void;

    beforeEach(() => {
      onCycleEdge = vi.fn<(edge: number) => void>();
      ({ container, rerender } = render(
        renderBoard(crossingBoard, onCycleEdge),
      ));
      vi.spyOn(readBoardSurface(), "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 500, 500),
      );
    });

    test("橋を回さずに候補の2本の線を描くこと", () => {
      fireEvent.pointerDown(readBoardSurface(), equidistantPoint);
      const candidates = container.querySelectorAll(
        "[data-bridges-ambiguous] line",
      );

      expect(onCycleEdge).not.toHaveBeenCalled();
      expect(candidates).toHaveLength(2);
    });

    describe("押した後に辺の少ない盤面へ移った場合", () => {
      test("描画でき、前の盤面の候補の線を残さないこと", () => {
        fireEvent.pointerDown(readBoardSurface(), equidistantPoint);
        rerender(renderBoard(fewEdges, onCycleEdge));
        const candidates = container.querySelectorAll(
          "[data-bridges-ambiguous] line",
        );

        expect(candidates).toHaveLength(0);
      });
    });
  });
});
