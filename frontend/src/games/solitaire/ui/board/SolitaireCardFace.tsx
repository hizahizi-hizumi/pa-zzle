import {
  getSolitaireCardSuit,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import { SOLITAIRE_CARD_ASPECT_RATIO } from "@/games/solitaire/ui/board/board-geometry";
import {
  formatSolitaireRank,
  solitaireSuitSymbols,
} from "@/games/solitaire/ui/card-text";
import {
  getSolitaireSuitColor,
  solitaireTone,
} from "@/games/solitaire/ui/solitaire-tone";

type SolitaireCardFaceProps = {
  card: SolitaireCard;
  /** 札の幅（px）。高さは縦横比から決まる。 */
  width: number;
};

/**
 * 表向きの札1枚。列では手前の札が奥の札の下の方を覆うので、数とマークは上の帯に書き、奥の札でも読めるようにする。
 * 一番手前の札だけに見える下の方には、マークを大きく描く。
 */
export function SolitaireCardFace({ card, width }: SolitaireCardFaceProps) {
  const suit = getSolitaireCardSuit(card);
  const symbol = solitaireSuitSymbols[suit];
  return (
    <span
      aria-hidden="true"
      className="relative block overflow-hidden font-sans font-bold leading-none"
      style={{
        width,
        height: width * SOLITAIRE_CARD_ASPECT_RATIO,
        borderRadius: width * 0.1,
        backgroundColor: solitaireTone.cardFace,
        boxShadow: `inset 0 0 0 1px ${solitaireTone.cardEdge}`,
        color: getSolitaireSuitColor(suit),
      }}
    >
      <span
        className="absolute whitespace-nowrap tracking-tight"
        style={{
          left: width * 0.08,
          top: width * 0.06,
          fontSize: width * 0.3,
        }}
      >
        {formatSolitaireRank(card)}
        {symbol}
      </span>
      <span
        className="absolute"
        style={{
          right: width * 0.1,
          bottom: width * 0.1,
          fontSize: width * 0.55,
        }}
      >
        {symbol}
      </span>
    </span>
  );
}
