import {
  type FukumenzanEquation,
  getFukumenzanEquationStructure,
} from "@/games/fukumenzan/puzzle/equation";

/** 0〜9 のどれでもよい候補。候補は数字ごとの1ビットで表す。 */
export const ANY_DIGIT_MASK = 0b11_1111_1111;

const NONZERO_DIGIT_MASK = 0b11_1111_1110;

/** 候補の集まりごとの、小さい順の数字。 */
export const digitsOfMask: readonly (readonly number[])[] = Array.from(
  { length: ANY_DIGIT_MASK + 1 },
  (_, mask) =>
    Array.from({ length: 10 }, (_, digit) => digit).filter(
      (digit) => (mask >> digit) & 1,
    ),
);

/** 候補の集まりごとの、候補の数。 */
export const digitCountOfMask: readonly number[] = digitsOfMask.map(
  (digits) => digits.length,
);

/** 1つの桁の足す側の文字。同じ文字が同じ桁に2回以上出るときは、その回数を `multiplicity` に持つ。 */
export type FukumenzanColumnTerm = {
  variable: number;
  multiplicity: number;
};

export type FukumenzanModelColumn = {
  /** 変数の番号の小さい順。 */
  terms: readonly FukumenzanColumnTerm[];
  resultVariable: number;
};

/**
 * 解法器が読む式の形。変数は、文字（`0`〜`letterCount - 1`。式に初めて出た順）と、繰り上がり
 * （`letterCount + j` が一の位から j 番目の桁に右から入る繰り上がり。`j` は `0`〜`columnCount`）。
 * 各変数の候補は数字のビットの集まり（`number[]`。添字が変数の番号）で持つ。
 */
export type FukumenzanColumnModel = {
  letterCount: number;
  addendCount: number;
  columnCount: number;
  variableCount: number;
  /** 一の位から順の桁。 */
  columns: readonly FukumenzanModelColumn[];
  leadingLetters: ReadonlySet<number>;
  /** 桁ごとの、足す側と答えの文字の集まり（繰り上がりを含まない）。 */
  columnLetters: readonly ReadonlySet<number>[];
};

export function createFukumenzanColumnModel(
  equation: FukumenzanEquation,
): FukumenzanColumnModel {
  const { letters, leadingLetters, columns } =
    getFukumenzanEquationStructure(equation);
  const modelColumns = columns.map(
    ({ addendLetters, resultLetter }): FukumenzanModelColumn => {
      const multiplicities = new Map<number, number>();
      for (const letter of addendLetters) {
        multiplicities.set(letter, (multiplicities.get(letter) ?? 0) + 1);
      }
      return {
        terms: [...multiplicities]
          .sort(([left], [right]) => left - right)
          .map(([variable, multiplicity]) => ({ variable, multiplicity })),
        resultVariable: resultLetter,
      };
    },
  );
  return {
    letterCount: letters.length,
    addendCount: equation.addends.length,
    columnCount: columns.length,
    variableCount: letters.length + columns.length + 1,
    columns: modelColumns,
    leadingLetters: new Set(leadingLetters),
    columnLetters: modelColumns.map(
      ({ terms, resultVariable }) =>
        new Set([...terms.map(({ variable }) => variable), resultVariable]),
    ),
  };
}

export function getCarryInVariable(
  model: FukumenzanColumnModel,
  column: number,
): number {
  return model.letterCount + column;
}

export function getCarryOutVariable(
  model: FukumenzanColumnModel,
  column: number,
): number {
  return model.letterCount + column + 1;
}

/**
 * 解き始めの候補。先頭の文字は0にならず、一の位に入る繰り上がりと最上位から出る繰り上がりは0。
 * 途中の繰り上がりは、足す数の数より小さい（3つの足し算の1桁の和は 9×3＋2＝29 まで）。
 */
export function createInitialDomains(model: FukumenzanColumnModel): number[] {
  const carryMask = (1 << model.addendCount) - 1;
  return Array.from({ length: model.variableCount }, (_, variable) => {
    if (variable < model.letterCount) {
      return model.leadingLetters.has(variable)
        ? NONZERO_DIGIT_MASK
        : ANY_DIGIT_MASK;
    }
    const column = variable - model.letterCount;
    return column === 0 || column === model.columnCount ? 1 : carryMask;
  });
}

export function areAllLettersDecided(
  model: FukumenzanColumnModel,
  domains: readonly number[],
): boolean {
  for (let letter = 0; letter < model.letterCount; letter += 1) {
    if (digitCountOfMask[domains[letter]!] !== 1) {
      return false;
    }
  }
  return true;
}

/** 候補の並びを、同じ盤面を見分けるための文字列にする。候補は 1023 以下なので1文字に収まる。 */
export function getDomainsKey(domains: readonly number[]): string {
  return String.fromCharCode(...domains);
}
