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

/** 答えの1桁ごとの足し算。一の位から順に、足す側の文字と答えの文字を持つ。 */
export type FukumenzanSumColumn = {
  /** 文字の番号の小さい順。 */
  terms: readonly FukumenzanColumnTerm[];
  resultVariable: number;
};

/** 完全な探索と素朴な解き方が、答えの桁を一の位から順に当てるための式の形。 */
export type FukumenzanSumColumns = {
  letterCount: number;
  leadingLetters: ReadonlySet<number>;
  /** 答えの桁の数だけ並ぶ。答えが1桁長いとき、最後の桁は足す側の文字を持たない。 */
  columns: readonly FukumenzanSumColumn[];
};

export function listFukumenzanSumColumns(
  equation: FukumenzanEquation,
): FukumenzanSumColumns {
  const { letters, leadingLetters, columns } =
    getFukumenzanEquationStructure(equation);
  return {
    letterCount: letters.length,
    leadingLetters: new Set(leadingLetters),
    columns: columns.map(({ addendLetters, resultLetter }) => {
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
    }),
  };
}

export type FukumenzanModelColumn = FukumenzanSumColumn & {
  carryInVariable: number;
  /** 最上位の桁で答えが1桁長いときは、答えの先頭の文字。 */
  carryOutVariable: number;
};

/**
 * 解法器が読む式の形。桁は足す数のある桁だけで、各桁は「足す文字の和＋右からの繰り上がり＝答えの文字＋10×左への繰り上がり」。
 * 答えが足す数より1桁長いとき、答えの先頭の文字は最上位の桁の左への繰り上がりそのものとして読む（人が筆算の式を書く形）。
 * 変数は、文字（`0`〜`letterCount - 1`。式に初めて出た順）と、繰り上がり（`letterCount` から。各桁の
 * `carryInVariable`・`carryOutVariable` が指す）。各変数の候補は数字のビットの集まり（`number[]`。添字が変数の番号）で持つ。
 */
export type FukumenzanColumnModel = {
  letterCount: number;
  addendCount: number;
  columnCount: number;
  variableCount: number;
  /** 一の位から順の桁。 */
  columns: readonly FukumenzanModelColumn[];
  leadingLetters: ReadonlySet<number>;
  /** 桁ごとの、足す側と答えと左への繰り上がりの文字の集まり（繰り上がりの変数を含まない）。 */
  columnLetters: readonly ReadonlySet<number>[];
  /** 値が0に決まっている繰り上がり（一の位に入る繰り上がりと、答えが伸びないときの最上位から出る繰り上がり）。 */
  zeroCarries: ReadonlySet<number>;
};

export function createFukumenzanColumnModel(
  equation: FukumenzanEquation,
): FukumenzanColumnModel {
  const { letterCount, leadingLetters, columns } =
    listFukumenzanSumColumns(equation);
  const longestAddendLength = Math.max(
    ...equation.addends.map((addend) => addend.length),
  );
  const columnCount = longestAddendLength;
  const grows = columns.length > longestAddendLength;
  const resultHead = columns[columns.length - 1]!.resultVariable;
  function carryVariable(column: number): number {
    return letterCount + column;
  }
  const topCarryOut = grows ? resultHead : carryVariable(columnCount);
  const modelColumns = columns.slice(0, columnCount).map(
    (column, index): FukumenzanModelColumn => ({
      ...column,
      carryInVariable: carryVariable(index),
      carryOutVariable:
        index === columnCount - 1 ? topCarryOut : carryVariable(index + 1),
    }),
  );
  return {
    letterCount,
    addendCount: equation.addends.length,
    columnCount,
    variableCount: letterCount + columnCount + (grows ? 0 : 1),
    columns: modelColumns,
    leadingLetters,
    columnLetters: modelColumns.map(
      ({ terms, resultVariable, carryOutVariable }) =>
        new Set([
          ...terms.map(({ variable }) => variable),
          resultVariable,
          ...(carryOutVariable < letterCount ? [carryOutVariable] : []),
        ]),
    ),
    zeroCarries: new Set(
      grows
        ? [carryVariable(0)]
        : [carryVariable(0), carryVariable(columnCount)],
    ),
  };
}

/**
 * 解き始めの候補。先頭の文字は0にならず、値が0に決まっている繰り上がりは0。
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
    return model.zeroCarries.has(variable) ? 1 : carryMask;
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
