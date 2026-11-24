import { type RefObject, useLayoutEffect, useState } from "react";

import type { FukumenzanGroundGrid } from "@/games/fukumenzan/ui/FukumenzanGround";
import { howToPlayProblem } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

/** 遊び方の図の式の置き場所に付ける印。地は、この印の付いた最初の式に罫線をそろえる。 */
export const exampleEquationAttributes = {
  "data-fukumenzan-example-equation": "",
} as const;

const columnCount = howToPlayProblem.result.length + 1;

/** 式のマス1つを方眼の目の 2×2 にする。 */
const CELLS_PER_TILE = 2;

function isSameGrid(
  left: FukumenzanGroundGrid | undefined,
  right: FukumenzanGroundGrid,
): boolean {
  return (
    left !== undefined &&
    left.cellPx === right.cellPx &&
    left.originXPx === right.originXPx &&
    left.originYPx === right.originYPx
  );
}

/**
 * 地の罫線を、`scope` の中の最初の式のマスの縁にそろえる方眼の目。目の一辺はマスの半分にし、罫線の交わる点を式の左上に置く。
 * 式が見つかる前と、地が描かれる前は `undefined`。地と式の大きさが変わるたびに測り直す。
 */
export function useEquationGrid(
  groundRef: RefObject<HTMLElement | null>,
  findScope: (ground: HTMLElement) => HTMLElement | null,
): FukumenzanGroundGrid | undefined {
  const [grid, setGrid] = useState<FukumenzanGroundGrid>();

  useLayoutEffect(() => {
    const ground = groundRef.current;
    const scope = ground === null ? null : findScope(ground);
    const equation = scope?.querySelector<HTMLElement>(
      "[data-fukumenzan-example-equation]",
    );
    if (ground === null || scope === null || !equation) {
      return;
    }
    const measure = () => {
      const groundBox = ground.getBoundingClientRect();
      const equationBox = equation.getBoundingClientRect();
      const next = {
        cellPx: equationBox.width / columnCount / CELLS_PER_TILE,
        originXPx: equationBox.left - groundBox.left,
        originYPx: equationBox.top - groundBox.top,
      };
      if (next.cellPx > 0) {
        setGrid((current) => (isSameGrid(current, next) ? current : next));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const resizes = new ResizeObserver(measure);
    resizes.observe(ground);
    resizes.observe(scope);
    resizes.observe(equation);
    return () => {
      resizes.disconnect();
    };
  }, [groundRef, findScope]);

  return grid;
}
