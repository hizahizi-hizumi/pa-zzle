import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  type BridgesBoard as BridgesBoardState,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import { createBoardView } from "@/games/bridges/ui/board/board-geometry";

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

/** 置いた盤面の、周りの海の余白の幅。 */
let boardMargin = 0;

/** 盤面の絵を、周りの海の余白も含めて1マス 100px で置く。 */
function placeBoard(board: BridgesBoardState): void {
  boardMargin = createBoardView(board).margin;
  const size = (board.width + 2 * boardMargin) * 100;
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
    clientX: (x + boardMargin) * 100,
    clientY: (y + boardMargin) * 100,
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

    describe("島を押して離してから、線から離れた海を押した場合", () => {
      beforeEach(() => {
        press([0.5, 0.5]);
        press([1.5, 1.5]);
      });

      test("近くの辺の橋を回さず、回さなかったことを知らせること", () => {
        expect(onCycleEdge).not.toHaveBeenCalled();
        expect(onIneffectivePress).toHaveBeenCalledOnce();
      });

      test("選びを解き、次に相手の島を押しても橋を回さないこと", () => {
        press([2.5, 0.5]);

        expect(onCycleEdge).not.toHaveBeenCalled();
      });
    });

    test("線の当たり範囲の外の海から縦になぞっても、近くの辺の橋を回さないこと", () => {
      drag([1.9, 1.5], [1.9, 3.5]);

      expect(onCycleEdge).not.toHaveBeenCalled();
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

  describe("交わる2本の線のどちらからもほとんど同じだけ離れた所を押した場合", () => {
    // 8×8 の盤面。縦の 1–4（(1,1)-(5,1)）と横の 2–2（(3,0)-(3,2)）が、横の2島の真ん中 (1.5, 3.5) で交わる。
    const crossBoard = parseBridgesBoard([
      "3.3....2",
      ".1..1...",
      ".....4.5",
      "2.2.3...",
      ".....2..",
      ".4..4..4",
      "........",
      ".4..3.1.",
    ]);
    const network = getBridgesNetwork(crossBoard);
    const vertical = network.edges.findIndex(
      ({ from, to }) =>
        crossBoard.islands[from]!.column === 1 &&
        crossBoard.islands[from]!.row === 1 &&
        crossBoard.islands[to]!.row === 5,
    );
    const horizontal = network.edges.findIndex(
      ({ from, to }) =>
        crossBoard.islands[from]!.row === 3 &&
        crossBoard.islands[from]!.column === 0 &&
        crossBoard.islands[to]!.column === 2,
    );
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;
    let onIneffectivePress: ReturnType<typeof vi.fn<() => void>>;

    function renderWithBridges(counts: Readonly<Record<number, 0 | 1 | 2>>) {
      onCycleEdge = vi.fn<(edge: number) => void>();
      onIneffectivePress = vi.fn<() => void>();
      render(
        <BridgesBoard
          board={crossBoard}
          bridges={network.edges.map((_, edge) => counts[edge] ?? 0)}
          islandStatuses={crossBoard.islands.map(() => "short")}
          edgeNotice={null}
          clearing={false}
          interactionDisabled={false}
          onCycleEdge={onCycleEdge}
          onIneffectivePress={onIneffectivePress}
          onClearAnimationComplete={vi.fn()}
        />,
      );
      placeBoard(crossBoard);
    }

    function listHintEdges(): number[] {
      return [
        ...document.querySelectorAll(
          "[data-bridges-candidate-hint] [data-bridges-rope]",
        ),
      ].map((rope) => Number(rope.getAttribute("data-bridges-rope")));
    }

    test.each([
      ["橋の無い交点", {}, [1.5, 3.5]],
      ["橋の無い交点から右へ 0.15 マス", {}, [1.65, 3.5]],
      ["縦に橋が1本ある交点", { [vertical]: 1 }, [1.5, 3.5]],
      ["縦に橋が2本ある交点", { [vertical]: 2 }, [1.5, 3.5]],
    ] as const)(
      "%sを押すと、どちらの橋も回さず、2辺にロープを張って候補を示すこと",
      (_, counts, point) => {
        renderWithBridges(counts);
        press(point);

        expect(onCycleEdge).not.toHaveBeenCalled();
        expect(onIneffectivePress).toHaveBeenCalledOnce();
        expect(listHintEdges().sort()).toEqual([vertical, horizontal].sort());
      },
    );

    test("縦の橋の上でも、横の線から離れた所を押せば縦の橋を回すこと", () => {
      renderWithBridges({ [vertical]: 1 });
      press([1.5, 2.4]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(vertical);
    });

    test("候補を示した後で島を押して相手の島を押すと、その間の橋を回すこと", () => {
      renderWithBridges({});
      press([1.5, 3.5]);
      press([0.5, 3.5]);
      press([2.5, 3.5]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(horizontal);
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

    test("印があっても押させる辺が無ければ、本番と同じくどちらの辺の橋も回さないこと", () => {
      const onCycleEdge = vi.fn<(edge: number) => void>();
      renderWith({ onCycleEdge });
      press([2.5, 2.5]);

      expect(onCycleEdge).not.toHaveBeenCalled();
    });
  });
  describe("評価で取り違えが報告された局面", () => {
    // 10×10 の盤面。横の 8(3,4)–6(3,7) と縦の 2(1,6)–3(6,6) が (6.5, 3.5) で交わる。1(0,0)–2(0,2) の斜め下に 3(1,1) がある。
    const wideBoard = parseBridgesBoard([
      "1.2....5.4",
      ".3..5.2...",
      "2.........",
      "..3.8..6.4",
      "..........",
      ".2...1.3..",
      "....4.3..4",
      "3.1....2..",
      "......1...",
      "2...3..4.2",
    ]);
    // 7×7 の盤面。6(0,4) の右に 3(0,6)、下に 6(2,4) がある。
    const smallBoard = parseBridgesBoard([
      ".2..6.3",
      ".......",
      ".3..6..",
      ".......",
      ".1.....",
      "2.4.4..",
      ".1....2",
    ]);
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;

    function renderScene(board: BridgesBoardState) {
      onCycleEdge = vi.fn<(edge: number) => void>();
      render(
        <BridgesBoard
          board={board}
          bridges={getBridgesNetwork(board).edges.map(() => 0)}
          islandStatuses={board.islands.map(() => "short")}
          edgeNotice={null}
          clearing={false}
          interactionDisabled={false}
          onCycleEdge={onCycleEdge}
          onClearAnimationComplete={vi.fn()}
        />,
      );
      placeBoard(board);
    }

    function edgeBetween(
      board: BridgesBoardState,
      [fromRow, fromColumn]: readonly [number, number],
      [toRow, toColumn]: readonly [number, number],
    ): number {
      const { edges } = getBridgesNetwork(board);
      const at = (row: number, column: number) =>
        board.islands.findIndex(
          (island) => island.row === row && island.column === column,
        );
      const [from, to] = [at(fromRow, fromColumn), at(toRow, toColumn)];
      return edges.findIndex(
        (edge) =>
          (edge.from === from && edge.to === to) ||
          (edge.from === to && edge.to === from),
      );
    }

    test.each([
      ["横の線の 0.1 マス下", [6.0, 3.6]],
      ["横の線の 0.35 マス下（縦の線から 0.7 マス）", [5.8, 3.85]],
    ] as const)(
      "交点の左の、%sを押すと、横の 8–6 の橋を回すこと",
      (_, point) => {
        renderScene(wideBoard);
        press(point);

        expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(
          edgeBetween(wideBoard, [3, 4], [3, 7]),
        );
      },
    );

    test("横の 1–2 の線の 0.48 マス下を押すと、斜め下の島を選ばず 1–2 の橋を回すこと", () => {
      renderScene(wideBoard);
      press([1.78, 0.98]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(
        edgeBetween(wideBoard, [0, 0], [0, 2]),
      );
    });

    test("間隔2の短い線の、陸のすぐ外を押すと、その線の橋を回すこと", () => {
      renderScene(wideBoard);
      press([1.05, 0.7]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(
        edgeBetween(wideBoard, [0, 0], [0, 2]),
      );
    });

    test("島を選んだまま別の島から下へなぞると、選んだ島ではなくなぞった向きの橋を回すこと", () => {
      renderScene(smallBoard);
      press([6.5, 0.5]);
      drag([4.5, 0.5], [4.5, 2.5]);

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(
        edgeBetween(smallBoard, [0, 4], [2, 4]),
      );
    });
  });
  describe("押して離す操作の場合", () => {
    // 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。辺: 0 = 島0-島1、1 = 島0-島2、2 = 島1-島4、3 = 島2-島3。
    const islandsBoard = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);
    let onCycleEdge: ReturnType<typeof vi.fn<(edge: number) => void>>;
    let onCycleEdgeBackward: ReturnType<typeof vi.fn<(edge: number) => void>>;

    function readPressedEdge(): string | null {
      return (
        document
          .querySelector("[data-bridges-pressed-edge]")
          ?.getAttribute("data-bridges-pressed-edge") ?? null
      );
    }

    function readRingCount(): number {
      return document.querySelectorAll("svg > circle[fill=none]").length;
    }

    beforeEach(() => {
      onCycleEdge = vi.fn<(edge: number) => void>();
      onCycleEdgeBackward = vi.fn<(edge: number) => void>();
      render(
        <>
          <BridgesBoard
            board={islandsBoard}
            bridges={getBridgesNetwork(islandsBoard).edges.map(() => 0)}
            islandStatuses={islandsBoard.islands.map(() => "short")}
            edgeNotice={null}
            clearing={false}
            interactionDisabled={false}
            onCycleEdge={onCycleEdge}
            onCycleEdgeBackward={onCycleEdgeBackward}
            onClearAnimationComplete={vi.fn()}
          />
          <button type="button">盤面の外</button>
        </>,
      );
      placeBoard(islandsBoard);
    });

    test("線を押した瞬間にその辺を光らせ、離すまで橋を回さないこと", () => {
      fireEvent.pointerDown(readBoardSurface(), toPointer([1.5, 0.7]));

      expect(readPressedEdge()).toBe("0");
      expect(onCycleEdge).not.toHaveBeenCalled();

      fireEvent.pointerUp(readBoardSurface(), toPointer([1.5, 0.7]));

      expect(onCycleEdge).toHaveBeenCalledExactlyOnceWith(0);
      expect(readPressedEdge()).toBeNull();
    });

    test("線を押したまま当たり範囲の外へずらすと光を消し、離しても橋を回さないこと", () => {
      fireEvent.pointerDown(readBoardSurface(), toPointer([1.5, 0.7]));
      fireEvent.pointerMove(readBoardSurface(), toPointer([1.5, 1.5]));

      expect(readPressedEdge()).toBeNull();

      fireEvent.pointerUp(readBoardSurface(), toPointer([1.5, 1.5]));

      expect(onCycleEdge).not.toHaveBeenCalled();
    });

    test("島を選んでから相手の島を押すと、押している間その間の辺を光らせること", () => {
      press([0.5, 0.5]);
      fireEvent.pointerDown(readBoardSurface(), toPointer([2.5, 0.5]));

      expect(readPressedEdge()).toBe("0");
    });

    test("島を選んでから盤面の外を押すと、選びを解くこと", () => {
      press([0.5, 0.5]);
      const ringsWhileSelected = readRingCount();
      fireEvent.pointerDown(screen.getByRole("button", { name: "盤面の外" }));

      expect(readRingCount()).toBeLessThan(ringsWhileSelected);
      press([2.5, 0.5]);
      expect(onCycleEdge).not.toHaveBeenCalled();
    });

    test("島を選んでから Esc キーを押すと、選びを解くこと", () => {
      press([0.5, 0.5]);
      fireEvent.keyDown(document.body, { key: "Escape" });
      press([2.5, 0.5]);

      expect(onCycleEdge).not.toHaveBeenCalled();
    });

    test("マウスで線を右クリックすると、その辺の橋を逆に回すこと", () => {
      const pointer = {
        ...toPointer([1.5, 0.5]),
        pointerType: "mouse",
        button: 2,
      };
      fireEvent.pointerDown(readBoardSurface(), pointer);
      fireEvent.contextMenu(readBoardSurface(), pointer);

      expect(onCycleEdgeBackward).toHaveBeenCalledExactlyOnceWith(0);
      expect(onCycleEdge).not.toHaveBeenCalled();
    });

    test("タッチの長押しで届くメニューの合図では、橋を回さないこと", () => {
      fireEvent.pointerDown(readBoardSurface(), toPointer([1.5, 0.5]));
      fireEvent.contextMenu(readBoardSurface(), toPointer([1.5, 0.5]));

      expect(onCycleEdgeBackward).not.toHaveBeenCalled();
    });
  });
});
