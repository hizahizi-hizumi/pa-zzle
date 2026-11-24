import {
  type FukumenzanEquation,
  getFukumenzanEquationStructure,
} from "@/games/fukumenzan/puzzle/equation";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";

/** 0 を入れた、2桁以上の数の先頭の文字。 */
export function listFukumenzanLeadingZeroLetters(
  equation: FukumenzanEquation,
  state: FukumenzanPuzzleState,
): readonly number[] {
  return getFukumenzanEquationStructure(equation).leadingLetters.filter(
    (letter) => state.placedDigits[letter] === 0,
  );
}

/**
 * 一の位から続けて全部の文字が埋まった桁のうち、足し算が合わない桁（一の位から数えた位）。
 * 桁の足す数の和に右の桁からの繰り上がりを足した一の位が、答えの文字と違えば合わない。いちばん左の桁は、左へ繰り上がっても合わない。
 * 繰り上がりは足す数だけで決まるので、合わない桁の左の桁も続けて確かめる。空の文字がある桁から左は確かめない。
 */
export function listFukumenzanMiscalculatedColumns(
  equation: FukumenzanEquation,
  state: FukumenzanPuzzleState,
): readonly number[] {
  const { columns } = getFukumenzanEquationStructure(equation);
  const miscalculated: number[] = [];
  let carry = 0;
  for (const [place, { addendLetters, resultLetter }] of columns.entries()) {
    const addendDigits = addendLetters.map(
      (letter) => state.placedDigits[letter],
    );
    const resultDigit = state.placedDigits[resultLetter];
    if (
      resultDigit === null ||
      resultDigit === undefined ||
      addendDigits.some((digit) => digit === null || digit === undefined)
    ) {
      break;
    }
    const total = addendDigits.reduce<number>(
      (sum, digit) => sum + digit!,
      carry,
    );
    const isLeftmost = place === columns.length - 1;
    if (total % 10 !== resultDigit || (isLeftmost && total >= 10)) {
      miscalculated.push(place);
    }
    carry = Math.floor(total / 10);
  }
  return miscalculated;
}

/**
 * 全部の文字が埋まり、先頭に 0 が無く、全部の桁の足し算が合えばクリア。
 * 違う文字が違う数字であることは、札が1枚ずつしかない状態の作りで保たれる。
 */
export function isFukumenzanSolved(
  equation: FukumenzanEquation,
  state: FukumenzanPuzzleState,
): boolean {
  return (
    state.placedDigits.every((digit) => digit !== null) &&
    listFukumenzanLeadingZeroLetters(equation, state).length === 0 &&
    listFukumenzanMiscalculatedColumns(equation, state).length === 0
  );
}
