import type { HowToPlayVerdictLabels } from "@/components/HowToPlayVerdict";
import { createSolitaireCard } from "@/games/solitaire/puzzle/card";
import {
  emptySolitaireFoundations,
  findSolitaireRunStart,
  type SolitaireColumn,
} from "@/games/solitaire/puzzle/state";

export const spadeEight = createSolitaireCard("spades", 8);
export const heartSeven = createSolitaireCard("hearts", 7);
export const clubSeven = createSolitaireCard("clubs", 7);
export const heartKing = createSolitaireCard("hearts", 13);
export const spadeQueen = createSolitaireCard("spades", 12);
export const heartJack = createSolitaireCard("hearts", 11);
export const heartFour = createSolitaireCard("hearts", 4);
export const heartFive = createSolitaireCard("hearts", 5);
export const heartTen = createSolitaireCard("hearts", 10);
export const spadeAce = createSolitaireCard("spades", 1);

export const heartsUpToThree = { ...emptySolitaireFoundations, hearts: 3 };

/** 9♣ 8♥ 7♠ が並び、その奥に並びにならない 5♦ がある列。 */
export const runColumn: SolitaireColumn = [
  createSolitaireCard("diamonds", 5),
  createSolitaireCard("clubs", 9),
  createSolitaireCard("hearts", 8),
  createSolitaireCard("spades", 7),
];
export const runStart = findSolitaireRunStart(runColumn);

export const stackLabels: HowToPlayVerdictLabels = {
  allowed: "重ねられる",
  disallowed: "重ねられない",
};
export const placeLabels: HowToPlayVerdictLabels = {
  allowed: "置ける",
  disallowed: "置けない",
};
