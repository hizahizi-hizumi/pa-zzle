import {
  type FukumenzanEquation,
  listFukumenzanLetters,
} from "@/games/fukumenzan/puzzle/equation";

export const fukumenzanDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 0〜9 の札1枚。札は各数字に1枚ずつしかないので、1つの数字は1つの文字にしか入らない。 */
export type FukumenzanDigit = (typeof fukumenzanDigits)[number];

/** 文字は `listFukumenzanLetters` の番号で並べる。 */
export type FukumenzanPuzzleState = {
  /** 文字ごとに入れた札。`null` は空。 */
  placedDigits: readonly (FukumenzanDigit | null)[];
  /** 文字ごとに × を付けた札。小さい順。入れた札とは別に持つメモで、入れても消えない。 */
  crossedDigits: readonly (readonly FukumenzanDigit[])[];
};

export function createInitialFukumenzanState(
  equation: FukumenzanEquation,
): FukumenzanPuzzleState {
  const letters = listFukumenzanLetters(equation);
  return {
    placedDigits: letters.map(() => null),
    crossedDigits: letters.map(() => []),
  };
}

export function isInitialFukumenzanState(
  state: FukumenzanPuzzleState,
): boolean {
  return (
    state.placedDigits.every((digit) => digit === null) &&
    state.crossedDigits.every((digits) => digits.length === 0)
  );
}
