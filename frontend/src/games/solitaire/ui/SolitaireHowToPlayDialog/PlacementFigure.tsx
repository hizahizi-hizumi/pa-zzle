import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { SOLITAIRE_CARD_ASPECT_RATIO } from "@/games/solitaire/ui/board/board-geometry";
import { FIGURE_CARD_WIDTH } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureColumn";

const arrowSizePx = 16;

type PlacementFigureProps = {
  destination: ReactNode;
  moved: ReactNode;
};

/** 置く先の山の右に、置こうとする札を並べ、矢印で置く向きを示す。矢印は札1枚の高さの中央に置く。 */
export function PlacementFigure({ destination, moved }: PlacementFigureProps) {
  return (
    <span className="flex items-start gap-1">
      {destination}
      <ArrowLeft
        aria-hidden="true"
        style={{
          width: arrowSizePx,
          height: arrowSizePx,
          marginTop:
            (FIGURE_CARD_WIDTH * SOLITAIRE_CARD_ASPECT_RATIO - arrowSizePx) / 2,
        }}
      />
      {moved}
    </span>
  );
}
