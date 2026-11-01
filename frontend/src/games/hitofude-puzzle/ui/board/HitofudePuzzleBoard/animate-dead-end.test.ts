import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import { animateDeadEnd } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/animate-dead-end";
import {
  HitofudePuzzleFigure,
  hitofudePuzzleFigureParts,
} from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

/** 先端（2）から延ばせるマスが無い 3×3 の盤面。 */
const board = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);
const path = [0, 1, 4, 5, 2];

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
});

describe("animateDeadEnd", () => {
  let figure: SVGSVGElement;
  let animatedElements: Element[];

  beforeEach(() => {
    animatedElements = [];
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(function record(this: Element) {
        animatedElements.push(this);
        return {} as Animation;
      }),
    });
    const { container } = render(
      createElement(HitofudePuzzleFigure, {
        board,
        path,
        isDeadEnd: true,
        solved: false,
      }),
    );
    figure = container.querySelector("svg")!;
  });

  test("先端の輪だけを動かすこと", () => {
    animateDeadEnd(figure);

    expect(animatedElements).toEqual([
      figure.querySelector(`[${hitofudePuzzleFigureParts.head}]`),
    ]);
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("動かさないこと", () => {
      animateDeadEnd(figure);

      expect(animatedElements).toEqual([]);
    });
  });
});
