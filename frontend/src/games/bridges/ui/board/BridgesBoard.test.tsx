import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  type BridgesBoard as BridgesBoardState,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import { BOARD_MARGIN } from "@/games/bridges/ui/board/board-geometry";

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

/** 盤面の絵を、周りの海の余白も含めて1マス 100px で置く。 */
function placeBoard(board: BridgesBoardState): void {
  const size = (board.width + 2 * BOARD_MARGIN) * 100;
  vi.spyOn(readBoardSurface(), "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, size, size),
  );
}

/** 盤面の座標 `[x, y]` の所の、指の位置。 */
function toPointer([x, y]: readonly [number, number]) {
  return {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: (x + BOARD_MARGIN) * 100,
    clientY: (y + BOARD_MARGIN) * 100,
  };
}

/** 盤面の座標 `at` を押して、動かさずに離す。 */
function press(at: readonly [number, number]): void {
  fireEvent.pointerDown(readBoardSurface(), toPointer(at));
  fireEvent.pointerUp(readBoardSurface(), toPointer(at));
}

/** `from` から押してなぞり、`to` で離す。 */
function drag(
  from: readonly [number, number],
  to: readonly [number, number],
): void {
  fireEvent.pointerDown(readBoardSurface(), toPointer(from));
  fireEvent.pointerMove(readBoardSurface(), toPointer(to));
  fireEvent.pointerUp(readBoardSurface(), toPointer(to));
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

  describe("島を押す操作の場合", () => {
    // 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。辺: 0 = 島0-島1、1 = 島0-島2、2 = 島1-島4、3 = 島2-島3。
    const islandsBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;
    let onIneffectivePress: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      onCycleEdge = vi.fn<(edge: number) => void>();
      onIneffectivePress = vi.fn<() => void>();
      render(
        <BridgesBoard
          board={islandsBoard}
          bridges={getBridgesNetwork(islandsBoard).edges.map(() => 0)}
          islandStatuses={islandsBoard.islands.map(() => "short")}
          edgeNotice={null}
          clearing={false}
          interactionDisabled={false}
          onCycleEdge={onCycleEdge}
          onIneffectivePress={onIneffectivePress}
          onClearAnimationComplete={vi.fn()}
        />,
      );
      placeBoard(islandsBoard);
    });

    describe("島を押して離してから、相手の島を押した場合", () => {
      beforeEach(() => {
        press([0.5, 0.5]);
      });

      test("2島の間の橋を回すこと", () => {
        press([2.5, 0.5]);

        expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(0);
      });

      test("回した後は選びを解き、続けて別の島を押しても橋を回さないこと", () => {
        press([2.5, 0.5]);
        press([2.5, 4.5]);

        expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(0);
      });
    });

    describe("島を押して離し、もう一度同じ島を押して離した場合", () => {
      beforeEach(() => {
        press([0.5, 0.5]);
        press([0.5, 0.5]);
      });

      test("選びを解き、次に相手の島を押しても橋を回さないこと", () => {
        press([2.5, 0.5]);

        expect(onCycleEdge).not.toHaveBeenCalled();
      });
    });

    describe("島を押して離してから、辺の無い島を押して離した場合", () => {
      beforeEach(() => {
        press([0.5, 0.5]);
        press([2.5, 4.5]);
      });

      test("押した島を選び直し、その相手の島を押すとその間の橋を回すこと", () => {
        press([2.5, 0.5]);

        expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(2);
      });
    });

    test("島からなぞって相手の島の近くで離すと、その間の橋を回すこと", () => {
      drag([0.5, 0.5], [2.1, 0.6]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(0);
    });

    test("島からなぞって相手の島に届く前の海の上で離すと、橋を回さず回さなかったことを知らせること", () => {
      drag([0.5, 0.5], [1.4, 0.6]);

      expect(onCycleEdge).not.toHaveBeenCalled();
      expect(onIneffectivePress).toHaveBeenCalledOnce();
    });

    test("島から斜めになぞって相手の島の行の近くで離しても、橋を回さないこと", () => {
      drag([0.5, 0.5], [2.2, 1.4]);

      expect(onCycleEdge).not.toHaveBeenCalled();
    });

    test("島からなぞって相手の島を通り過ぎて離しても、なぞった向きの最初の島との間の橋を回すこと", () => {
      drag([0.5, 0.5], [4.6, 0.8]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(0);
    });

    test("島からなぞって辺の無い向きへ離すと、橋を回さず回さなかったことを知らせること", () => {
      drag([0.5, 0.5], [-0.4, 0.5]);

      expect(onCycleEdge).not.toHaveBeenCalled();
      expect(onIneffectivePress).toHaveBeenCalledOnce();
    });
  });

  describe("交わる2本の線から同じ距離の所を押した場合", () => {
    // 辺2（縦 x=2.5）と辺3（横 y=2.5）が (2.5, 2.5) で交わる。(3, 2) は2本の線から同じ距離で、真ん中からのずれも同じ。
    const crossingBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;

    beforeEach(() => {
      onCycleEdge = vi.fn<(edge: number) => void>();
      render(renderBoard(crossingBoard, onCycleEdge));
      placeBoard(crossingBoard);
    });

    test("空振りさせず、どちらか1つの辺の橋を回すこと", () => {
      press([3, 2]);

      expect(onCycleEdge).toHaveBeenCalledOnce();
    });

    test("直前に島を押していれば、その島から伸びる辺の橋を回すこと", () => {
      press([0.5, 2.5]);
      press([0.5, 2.5]);
      press([3, 2]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(3);
    });
  });

  describe("ロープを張る相手", () => {
    // 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。辺2（島1-島4、縦）は辺3（島2-島3、横）と交わる。
    const crossingBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);

    function listRopeEdges(): number[] {
      return [...document.querySelectorAll("[data-bridges-rope]")].map((rope) =>
        Number(rope.getAttribute("data-bridges-rope")),
      );
    }

    beforeEach(() => {
      render(
        <BridgesBoard
          board={crossingBoard}
          bridges={[0, 0, 0, 1]}
          islandStatuses={crossingBoard.islands.map(() => "short")}
          edgeNotice={null}
          clearing={false}
          interactionDisabled={false}
          onCycleEdge={vi.fn()}
          onClearAnimationComplete={vi.fn()}
        />,
      );
      placeBoard(crossingBoard);
    });

    test("島を選ぶと、交わる橋に阻まれて今は架けられない相手にはロープを張らないこと", () => {
      press([2.5, 0.5]);

      expect(listRopeEdges()).toEqual([0]);
    });

    test("マウスを島に乗せると、その島から架けられる相手へロープを張ること", () => {
      fireEvent.pointerMove(readBoardSurface(), {
        ...toPointer([0.5, 0.5]),
        pointerType: "mouse",
      });

      expect(listRopeEdges()).toEqual([0, 1]);
    });
  });

  describe("交わる2本の線の交点を押した場合", () => {
    // 辺2（縦 x=2.5）と辺3（横 y=2.5）の交点 (2.5, 2.5) を押す。
    const crossingBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);

    function renderWith(props: {
      guidedEdges?: readonly number[];
      onCycleEdge: (edge: number) => void;
    }) {
      render(
        <BridgesBoard
          board={crossingBoard}
          bridges={getBridgesNetwork(crossingBoard).edges.map(() => 0)}
          islandStatuses={crossingBoard.islands.map(() => "short")}
          edgeNotice={null}
          clearing={false}
          interactionDisabled={false}
          cues={[{ kind: "mark", edge: 2, recallId: null }]}
          guidedEdges={props.guidedEdges}
          onCycleEdge={props.onCycleEdge}
          onClearAnimationComplete={vi.fn()}
        />,
      );
      placeBoard(crossingBoard);
    }

    test("手を引いて押させる辺があれば、その帯の中の押しとして、その辺の橋を回すこと", () => {
      const onCycleEdge = vi.fn<(edge: number) => void>();
      renderWith({ guidedEdges: [3], onCycleEdge });
      press([2.5, 2.5]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(3);
    });

    test("印があっても押させる辺が無ければ、本番と同じく押した位置から1つの辺を選んで回すこと", () => {
      const onCycleEdge = vi.fn<(edge: number) => void>();
      renderWith({ onCycleEdge });
      press([2.5, 2.5]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(2);
    });
  });
});
