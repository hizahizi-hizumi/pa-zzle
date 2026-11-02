import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import type { HitofudePuzzleBlockedMove } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import { animateBlockedMove } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/animate-blocked-move";
import {
  HitofudePuzzleFigure,
  hitofudePuzzleFigureParts,
} from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

/**
 * 中央の右（5）が穴の 3×3 の盤面。先端は中央。
 * 0 1 2
 * 3 4 #
 * 6 7 8
 */
const board = parseHitofudePuzzleBoard(["S . .", ". . #", ". . ."]);
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
      createElement(HitofudePuzzleFigure, {
        board,
        path,
        isDeadEnd: false,
        solved: false,
        blockedCell: 5,
      }),
    );
    figure = container.querySelector("svg")!;
  });

  describe("穴に阻まれた場合", () => {
    const blockedMove: HitofudePuzzleBlockedMove = {
      id: 0,
      direction: "right",
      cell: 5,
    };

    test("先端を進もうとした向きへだけ揺らして戻し、×を点けること", () => {
      animateBlockedMove(figure, blockedMove);

      const [head] = findCalls(hitofudePuzzleFigureParts.head);
      const marks = findCalls(hitofudePuzzleFigureParts.blockedMark);
      expect(head!.offsets.every(({ x, y }) => x >= 0 && y === 0)).toBe(true);
      expect(head!.offsets.some(({ x }) => x > 0)).toBe(true);
      expect(head!.offsets.at(-1)).toEqual({ x: 0, y: 0 });
      expect(marks).toHaveLength(1);
    });
  });

  describe("先端から離れたマスを押した場合", () => {
    const blockedMove: HitofudePuzzleBlockedMove = {
      id: 0,
      direction: null,
      cell: 0,
    };

    test("先端を左右に揺らして元の位置へ戻すこと", () => {
      animateBlockedMove(figure, blockedMove);

      const [head] = findCalls(hitofudePuzzleFigureParts.head);
      expect(head!.offsets.some(({ x }) => x < 0)).toBe(true);
      expect(head!.offsets.some(({ x }) => x > 0)).toBe(true);
      expect(head!.offsets.every(({ y }) => y === 0)).toBe(true);
      expect(head!.offsets.at(-1)).toEqual({ x: 0, y: 0 });
    });
  });

  describe("盤面の外へ進もうとした場合", () => {
    const blockedMove: HitofudePuzzleBlockedMove = {
      id: 0,
      direction: "up",
      cell: null,
    };

    test("×は点けず、先端だけを揺らすこと", () => {
      animateBlockedMove(figure, blockedMove);

      const heads = findCalls(hitofudePuzzleFigureParts.head);
      const marks = findCalls(hitofudePuzzleFigureParts.blockedMark);
      expect(heads).toHaveLength(1);
      expect(marks).toEqual([]);
    });
  });

  describe("動きを減らす設定の場合", () => {
    const blockedMove: HitofudePuzzleBlockedMove = {
      id: 0,
      direction: "right",
      cell: 5,
    };

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("先端は揺らさず、×だけを返すこと", () => {
      animateBlockedMove(figure, blockedMove);

      const heads = findCalls(hitofudePuzzleFigureParts.head);
      const marks = findCalls(hitofudePuzzleFigureParts.blockedMark);
      expect(heads).toEqual([]);
      expect(marks).toHaveLength(1);
    });
  });
});
