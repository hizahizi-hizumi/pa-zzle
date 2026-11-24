import { SOLITAIRE_CARD_ASPECT_RATIO } from "@/games/solitaire/ui/board/board-geometry";
import { solitaireTone } from "@/games/solitaire/ui/solitaire-tone";

type SolitaireCardBackProps = {
  /** 札の幅（px）。高さは縦横比から決まる。 */
  width: number;
};

/** 裏向きの札1枚。山札に残る札を表す。 */
export function SolitaireCardBack({ width }: SolitaireCardBackProps) {
  return (
    <span
      aria-hidden="true"
      className="block"
      style={{
        width,
        height: width * SOLITAIRE_CARD_ASPECT_RATIO,
        borderRadius: width * 0.1,
        backgroundColor: solitaireTone.cardBack,
        backgroundImage: `repeating-linear-gradient(45deg, ${solitaireTone.cardBackStripe} 0 2px, transparent 2px 6px)`,
        boxShadow: `inset 0 0 0 ${Math.max(2, width * 0.08)}px ${solitaireTone.cardFace}`,
      }}
    />
  );
}
