import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import {
  getSolitaireCardSuit,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import { canPlaceSolitaireCardOnFoundation } from "@/games/solitaire/puzzle/rules";
import {
  getSolitaireFoundationTop,
  type SolitaireFoundations,
} from "@/games/solitaire/puzzle/state";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { SolitaireEmptySlot } from "@/games/solitaire/ui/board/SolitaireEmptySlot";
import { FIGURE_CARD_WIDTH } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureColumn";
import { placeLabels } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-examples";
import { PlacementFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/PlacementFigure";

type FoundationPlacementExampleProps = {
  foundations: SolitaireFoundations;
  card: SolitaireCard;
};

/** `card` のマークの組札に `card` を置こうとする姿と、置けるかの判定。判定はプレイと同じ規則で求める。 */
export function FoundationPlacementExample({
  foundations,
  card,
}: FoundationPlacementExampleProps) {
  const top = getSolitaireFoundationTop(
    foundations,
    getSolitaireCardSuit(card),
  );
  const allowed = canPlaceSolitaireCardOnFoundation(foundations, card);
  return (
    <HowToPlayExample
      figure={
        <PlacementFigure
          destination={
            top === null ? (
              <SolitaireEmptySlot width={FIGURE_CARD_WIDTH} />
            ) : (
              <SolitaireCardFace card={top} width={FIGURE_CARD_WIDTH} />
            )
          }
          moved={<SolitaireCardFace card={card} width={FIGURE_CARD_WIDTH} />}
        />
      }
      caption={
        <HowToPlayVerdict
          verdict={allowed ? "allowed" : "disallowed"}
          labels={placeLabels}
        />
      }
    />
  );
}
