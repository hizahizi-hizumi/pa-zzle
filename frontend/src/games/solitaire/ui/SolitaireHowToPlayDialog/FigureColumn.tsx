import type { SolitaireCard } from "@/games/solitaire/puzzle/card";
import {
  SOLITAIRE_CARD_ASPECT_RATIO,
  SOLITAIRE_CARD_OFFSET_RATIO,
} from "@/games/solitaire/ui/board/board-geometry";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { getSolitaireSelectionFrameStyle } from "@/games/solitaire/ui/board/selection-frame";

/** 遊び方の図の札の幅（px）。 */
export const FIGURE_CARD_WIDTH = 40;

type FigureColumnProps = {
  /** 奥から手前の順の札。 */
  cards: readonly SolitaireCard[];
  /** 置き元に選んだ姿で、この位置の札から手前を枠で囲む。 */
  selectedFrom?: number;
};

/** 遊び方の図の列1つ。本番の列と同じずらし幅で札を重ねる。 */
export function FigureColumn({ cards, selectedFrom }: FigureColumnProps) {
  const cardHeight = FIGURE_CARD_WIDTH * SOLITAIRE_CARD_ASPECT_RATIO;
  const offset = cardHeight * SOLITAIRE_CARD_OFFSET_RATIO;
  return (
    <span
      className="relative block"
      style={{
        width: FIGURE_CARD_WIDTH,
        height: cardHeight + Math.max(0, cards.length - 1) * offset,
      }}
    >
      {cards.map((card, index) => (
        <span
          key={card}
          className="absolute left-0"
          style={{ top: index * offset }}
        >
          <SolitaireCardFace card={card} width={FIGURE_CARD_WIDTH} />
        </span>
      ))}
      {selectedFrom === undefined ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0"
          style={{
            ...getSolitaireSelectionFrameStyle(FIGURE_CARD_WIDTH),
            top: selectedFrom * offset,
            width: FIGURE_CARD_WIDTH,
            height: (cards.length - 1 - selectedFrom) * offset + cardHeight,
          }}
        />
      )}
    </span>
  );
}
