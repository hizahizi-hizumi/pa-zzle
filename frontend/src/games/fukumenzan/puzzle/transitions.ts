import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";

function assertLetter(state: FukumenzanPuzzleState, letter: number): void {
  if (!Number.isInteger(letter) || state.placedDigits[letter] === undefined) {
    throw new RangeError(`Fukumenzan letter is out of range: ${letter}`);
  }
}

/**
 * 札を文字に入れる。札がほかの文字に入っていれば、その文字は空になる（札を運び直す）。
 * 文字に別の札が入っていれば、その札は列へ戻る。同じ札が入っていれば、同じ状態を返す。
 */
export function placeFukumenzanDigit(
  state: FukumenzanPuzzleState,
  letter: number,
  digit: FukumenzanDigit,
): FukumenzanPuzzleState {
  assertLetter(state, letter);
  if (state.placedDigits[letter] === digit) {
    return state;
  }
  return {
    ...state,
    placedDigits: state.placedDigits.map((placed, index) =>
      index === letter ? digit : placed === digit ? null : placed,
    ),
  };
}

/** 文字の札を列へ戻して空にする。空の文字には同じ状態を返す。 */
export function returnFukumenzanDigit(
  state: FukumenzanPuzzleState,
  letter: number,
): FukumenzanPuzzleState {
  assertLetter(state, letter);
  if (state.placedDigits[letter] === null) {
    return state;
  }
  return { ...state, placedDigits: state.placedDigits.with(letter, null) };
}

/** 文字について、札の × を付け外しする。 */
export function toggleFukumenzanCross(
  state: FukumenzanPuzzleState,
  letter: number,
  digit: FukumenzanDigit,
): FukumenzanPuzzleState {
  assertLetter(state, letter);
  const crossed = state.crossedDigits[letter]!;
  const toggled = crossed.includes(digit)
    ? crossed.filter((crossedDigit) => crossedDigit !== digit)
    : [...crossed, digit].sort((left, right) => left - right);
  return {
    ...state,
    crossedDigits: state.crossedDigits.with(letter, toggled),
  };
}
