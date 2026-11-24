import { createSolitaireCard } from "@/games/solitaire/puzzle/card";
import { SolitaireCardBack } from "@/games/solitaire/ui/board/SolitaireCardBack";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { FIGURE_CARD_WIDTH } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureColumn";

/** 山札（裏向き）と、めくった札を重ねる捨て札。本番の上の段と同じ並び。 */
export function StockFigure() {
  return (
    <span className="flex gap-1">
      <SolitaireCardBack width={FIGURE_CARD_WIDTH} />
      <SolitaireCardFace
        card={createSolitaireCard("diamonds", 6)}
        width={FIGURE_CARD_WIDTH}
      />
    </span>
  );
}
