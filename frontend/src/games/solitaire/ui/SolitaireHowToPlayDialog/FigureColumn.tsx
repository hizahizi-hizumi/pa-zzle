import type { SolitaireCard } from "@/games/solitaire/puzzle/card";
import {
  SOLITAIRE_CARD_ASPECT_RATIO,
  SOLITAIRE_CARD_OFFSET_RATIO,
} from "@/games/solitaire/ui/board/board-geometry";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import {
  getSolitaireColumnSelectionFrame,
  getSolitaireSelectionFrameStyle,
} from "@/games/solitaire/ui/board/selection-frame";

/** 遊び方の図の札の幅（px）。 */
export const FIGURE_CARD_WIDTH = 40;

type FigureColumnProps = {
  /** 奥から手前の順の札。 */
  cards: readonly SolitaireCard[];
  /** 置き元に選んだ姿で、盤面と同じく手前から続く並びを枠で囲む。 */
  selected?: boolean;
};

/** 遊び方の図の列1つ。本番の列と同じずらし幅で札を重ねる。 */
export function FigureColumn({ cards, selected = false }: FigureColumnProps) {
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
      {selected ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0"
          style={{
            ...getSolitaireSelectionFrameStyle(FIGURE_CARD_WIDTH),
            ...getSolitaireColumnSelectionFrame({
              column: cards,
              offset,
              cardHeight,
            }),
            width: FIGURE_CARD_WIDTH,
          }}
        />
      ) : null}
    </span>
  );
}
