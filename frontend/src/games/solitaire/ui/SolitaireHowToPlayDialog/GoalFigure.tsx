import {
  createSolitaireCard,
  SOLITAIRE_KING_RANK,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";

const goalCardWidth = 56;

/** 解き終えた盤面の組札。4つのマークの組札が、どれも K まで積み上がった姿。 */
export function GoalFigure() {
  return (
    <div
      role="img"
      aria-label="4つの組札が、どれもKまで積み上がった盤面"
      className="flex gap-2"
    >
      {solitaireSuits.map((suit) => (
        <SolitaireCardFace
          key={suit}
          card={createSolitaireCard(suit, SOLITAIRE_KING_RANK)}
          width={goalCardWidth}
        />
      ))}
    </div>
  );
}
