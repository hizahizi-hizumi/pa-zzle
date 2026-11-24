/**
 * 足し算の式。足す数と答えを、上の位から1文字ずつ並べた文字の列で持つ。同じ文字は同じ数字を表す。
 */
export type FukumenzanEquation = {
  addends: readonly string[];
  result: string;
};

/**
 * 盤面に描ける式の上限。スマホの縦画面の最小幅でも、式の文字と 0〜9 の札が押し分けられる大きさで一画面に収まる範囲。
 * 文字は 0〜9 の札の数までしか置けない。
 */
export const FUKUMENZAN_EQUATION_LIMITS = {
  minimumAddendCount: 2,
  maximumAddendCount: 3,
  maximumResultLength: 7,
  maximumLetterCount: 10,
} as const;

/** 一の位から数えた1つの桁。文字は `listFukumenzanLetters` の番号で表す。 */
export type FukumenzanColumn = {
  /** その桁まで届く足す数の文字。届かない足す数は含まない。 */
  addendLetters: readonly number[];
  resultLetter: number;
};

export type FukumenzanEquationStructure = {
  /** 式に出る文字。足す数を上から、答えを最後に、左から読んで初めて出た順。 */
  letters: readonly string[];
  /** 2桁以上の数の先頭にある文字。0 を入れられない。 */
  leadingLetters: readonly number[];
  /** 一の位から順の桁。 */
  columns: readonly FukumenzanColumn[];
};

function listWords({ addends, result }: FukumenzanEquation): string[] {
  return [...addends, result];
}

export function listFukumenzanLetters(
  equation: FukumenzanEquation,
): readonly string[] {
  return [...new Set(listWords(equation).join(""))];
}

export function getFukumenzanEquationStructure(
  equation: FukumenzanEquation,
): FukumenzanEquationStructure {
  const letters = listFukumenzanLetters(equation);
  const letterIndices = new Map(
    letters.map((letter, index) => [letter, index]),
  );
  function indexOf(letter: string): number {
    return letterIndices.get(letter)!;
  }

  const leadingLetters = [
    ...new Set(
      listWords(equation)
        .filter((word) => word.length > 1)
        .map((word) => indexOf(word[0]!)),
    ),
  ].sort((left, right) => left - right);

  const { addends, result } = equation;
  const columns = Array.from(
    { length: result.length },
    (_, place): FukumenzanColumn => ({
      addendLetters: addends
        .filter((addend) => addend.length > place)
        .map((addend) => indexOf(addend[addend.length - 1 - place]!)),
      resultLetter: indexOf(result[result.length - 1 - place]!),
    }),
  );

  return { letters, leadingLetters, columns };
}

/**
 * 盤面に描ける形かを確かめる。答えは、足す数のいちばん長いものと同じか1桁長い（3つまでの足し算の繰り上がりは1桁に収まる）。
 * 解があるか・一意かは探索を要するので、ここでは確かめない。
 */
export function assertFukumenzanEquation(equation: FukumenzanEquation): void {
  const { addends, result } = equation;
  const {
    minimumAddendCount,
    maximumAddendCount,
    maximumResultLength,
    maximumLetterCount,
  } = FUKUMENZAN_EQUATION_LIMITS;
  if (
    addends.length < minimumAddendCount ||
    addends.length > maximumAddendCount
  ) {
    throw new RangeError(
      `Fukumenzan equation must have ${minimumAddendCount} to ${maximumAddendCount} addends`,
    );
  }
  if (listWords(equation).some((word) => !/^[A-Z]+$/.test(word))) {
    throw new RangeError("Fukumenzan equation words must be uppercase letters");
  }
  const longestAddendLength = Math.max(
    ...addends.map((addend) => addend.length),
  );
  if (
    result.length > maximumResultLength ||
    result.length < longestAddendLength ||
    result.length > longestAddendLength + 1
  ) {
    throw new RangeError(
      `Fukumenzan result must be up to ${maximumResultLength} letters and as long as the longest addend or one letter longer`,
    );
  }
  if (listFukumenzanLetters(equation).length > maximumLetterCount) {
    throw new RangeError(
      `Fukumenzan equation must use at most ${maximumLetterCount} letters`,
    );
  }
}
