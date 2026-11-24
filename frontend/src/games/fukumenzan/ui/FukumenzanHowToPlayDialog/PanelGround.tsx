import { useRef } from "react";

import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";
import { useEquationGrid } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/use-equation-grid";

/** 地を敷く層（`HowToPlayExamplePanel` が地を包む要素）の親の、例を並べる面。 */
function findPanel(ground: HTMLElement): HTMLElement | null {
  return ground.parentElement?.parentElement ?? null;
}

/**
 * 例と図を並べる面に敷く方眼の紙。面そのものを盤面の地にして、例の盤面を地の箱で囲まない。
 * 紙は面いっぱいに敷き、罫線を面の最初の例の式のマスにそろえる。
 */
export function PanelGround() {
  const groundRef = useRef<HTMLDivElement>(null);
  const grid = useEquationGrid(groundRef, findPanel);

  return (
    <div ref={groundRef} className="size-full">
      <FukumenzanGround grid={grid} />
    </div>
  );
}
