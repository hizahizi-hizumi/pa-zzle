import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { animateDeadEnd } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/animate-dead-end";
import {
  HamiltonianPathFigure,
  hamiltonianPathFigureParts,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";

/** 先端（2）から延ばせるマスが無い 3×3 の盤面。 */
const board = parseHamiltonianPathBoard(["S . .", "", ". . .", "", ". . ."]);
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
      createElement(HamiltonianPathFigure, {
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
      figure.querySelector(`[${hamiltonianPathFigureParts.head}]`),
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
