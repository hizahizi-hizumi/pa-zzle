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

/** 2つの状態で × が違う文字。1回の操作で × が変わるのは1文字だけなので、最初の1つを返す。違いが無ければ `null`。 */
export function findFukumenzanCrossChangedLetter(
  before: FukumenzanPuzzleState,
  after: FukumenzanPuzzleState,
): number | null {
  const letter = before.crossedDigits.findIndex(
    (digits, index) => digits.join() !== after.crossedDigits[index]?.join(),
  );
  return letter < 0 ? null : letter;
}
