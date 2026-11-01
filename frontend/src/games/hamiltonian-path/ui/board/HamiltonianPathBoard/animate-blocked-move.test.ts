import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import type { HamiltonianPathBlockedMove } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  createHamiltonianPathPartition,
  parseHamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import { animateBlockedMove } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/animate-blocked-move";
import {
  getPartitionKey,
  HamiltonianPathFigure,
  hamiltonianPathFigureParts,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";

/**
 * 中央（4）と右（5）の間・左下（6）と下（7）の間に仕切りがあり、右下が壁の 3×3 の盤面。先端は中央。
 * 0 1 2
 * 3 4|5
 * 6|7 #
 */
const board = parseHamiltonianPathBoard(["S . .", "", ". .|.", "", ".|. #"]);
const path = [0, 1, 4];

type Offset = { x: number; y: number };
type AnimateCall = { element: Element; offsets: Offset[] };

/** 揺れの各キーフレームの、先端の元の位置からのずれ。 */
function readOffsets(keyframes: Keyframe[]): Offset[] {
  return keyframes.flatMap(({ transform }) => {
    const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(
      String(transform),
    );
    return match ? [{ x: Number(match[1]), y: Number(match[2]) }] : [];
  });
}

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
});

describe("animateBlockedMove", () => {
  let figure: SVGSVGElement;
  let calls: AnimateCall[];

  function findCalls(part: string): AnimateCall[] {
    return calls.filter(({ element }) => element.hasAttribute(part));
  }

  beforeEach(() => {
    calls = [];
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(function record(this: Element, keyframes: Keyframe[]) {
        calls.push({ element: this, offsets: readOffsets(keyframes) });
        return {} as Animation;
      }),
    });
    const { container } = render(
      createElement(HamiltonianPathFigure, {
        board,
        path,
        isDeadEnd: false,
        solved: false,
        blockedCell: 5,
      }),
    );
    figure = container.querySelector("svg")!;
  });

  describe("仕切りに阻まれた場合", () => {
    const blockedMove: HamiltonianPathBlockedMove = {
      id: 0,
      reason: "partition",
      head: 4,
      direction: "right",
      cell: 5,
    };
    const blockingPartitionKey = getPartitionKey(
      createHamiltonianPathPartition(4, 5),
    );

    test("進もうとしたマスの×を点けること", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const marks = findCalls(hamiltonianPathFigureParts.blockedMark);
      expect(marks).toHaveLength(1);
    });

    test("先端を進もうとした向きへだけ揺らして戻し、阻んだ仕切りだけを光らせること", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const [head] = findCalls(hamiltonianPathFigureParts.head);
      const halos = findCalls(hamiltonianPathFigureParts.partitionHalo);
      expect(head!.offsets.every(({ x, y }) => x >= 0 && y === 0)).toBe(true);
      expect(head!.offsets.some(({ x }) => x > 0)).toBe(true);
      expect(head!.offsets.at(-1)).toEqual({ x: 0, y: 0 });
      expect(halos.map(({ element }) => element)).toEqual([
        figure.querySelector(
          `[${hamiltonianPathFigureParts.partitionHalo}="${blockingPartitionKey}"]`,
        ),
      ]);
    });
  });

  describe("壁マスに阻まれた場合", () => {
    const blockedMove: HamiltonianPathBlockedMove = {
      id: 0,
      reason: "wall",
      head: 4,
      direction: "down",
      cell: 7,
    };

    test("先端を進もうとした向きへ揺らし、仕切りは光らせないこと", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const [head] = findCalls(hamiltonianPathFigureParts.head);
      const halos = findCalls(hamiltonianPathFigureParts.partitionHalo);
      expect(head!.offsets.every(({ x, y }) => x === 0 && y >= 0)).toBe(true);
      expect(head!.offsets.some(({ y }) => y > 0)).toBe(true);
      expect(halos).toEqual([]);
    });
  });

  describe("先端から離れたマスを押した場合", () => {
    const blockedMove: HamiltonianPathBlockedMove = {
      id: 0,
      reason: "not-adjacent",
      head: 4,
      direction: null,
      cell: 0,
    };

    test("先端を左右に揺らして元の位置へ戻すこと", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const [head] = findCalls(hamiltonianPathFigureParts.head);
      expect(head!.offsets.some(({ x }) => x < 0)).toBe(true);
      expect(head!.offsets.some(({ x }) => x > 0)).toBe(true);
      expect(head!.offsets.every(({ y }) => y === 0)).toBe(true);
      expect(head!.offsets.at(-1)).toEqual({ x: 0, y: 0 });
    });
  });

  describe("盤面の外へ進もうとした場合", () => {
    const blockedMove: HamiltonianPathBlockedMove = {
      id: 0,
      reason: "outside-board",
      head: 2,
      direction: "up",
      cell: null,
    };

    test("×は点けず、先端だけを揺らすこと", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const heads = findCalls(hamiltonianPathFigureParts.head);
      const marks = findCalls(hamiltonianPathFigureParts.blockedMark);
      expect(heads).toHaveLength(1);
      expect(marks).toEqual([]);
    });
  });

  describe("動きを減らす設定の場合", () => {
    const blockedMove: HamiltonianPathBlockedMove = {
      id: 0,
      reason: "partition",
      head: 4,
      direction: "right",
      cell: 5,
    };

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("先端は揺らさず、×と阻んだ仕切りの光だけを返すこと", () => {
      animateBlockedMove(figure, board.size, blockedMove);

      const heads = findCalls(hamiltonianPathFigureParts.head);
      const marks = findCalls(hamiltonianPathFigureParts.blockedMark);
      const halos = findCalls(hamiltonianPathFigureParts.partitionHalo);
      expect(heads).toEqual([]);
      expect(marks).toHaveLength(1);
      expect(halos).toHaveLength(1);
    });
  });
});
