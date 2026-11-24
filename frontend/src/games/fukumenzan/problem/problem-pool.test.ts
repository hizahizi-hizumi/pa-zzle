import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import {
  decodeFukumenzanPoolProblem,
  findFukumenzanPoolEntry,
  findFukumenzanPoolEntryByProblemId,
  findFukumenzanPoolProblemFeatures,
  listFukumenzanPoolEntries,
  listFukumenzanPoolProblemIds,
  measureFukumenzanProblemFeatures,
} from "@/games/fukumenzan/problem/problem-pool";
import {
  type FukumenzanEquation,
  getFukumenzanEquationStructure,
} from "@/games/fukumenzan/puzzle/equation";
import { isFukumenzanSolved } from "@/games/fukumenzan/puzzle/rules";
import {
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  fukumenzanDigits,
} from "@/games/fukumenzan/puzzle/state";
import { createProblemId } from "@/games/problem-id";

/**
 * 解を数える素朴な探索。一の位の桁から順に出た文字へ違う数字を割り当て、全部の文字が埋まったら規則で確かめる。
 * 途中では、埋まった桁の足し算が合わない割り当てだけを打ち切る。
 */
function countSolutions(equation: FukumenzanEquation, limit: number): number {
  const { letters, columns } = getFukumenzanEquationStructure(equation);
  const order = [
    ...new Set(
      columns.flatMap(({ addendLetters, resultLetter }) => [
        ...addendLetters,
        resultLetter,
      ]),
    ),
  ];
  const placed: (FukumenzanDigit | null)[] = letters.map(() => null);
  const crossedDigits = letters.map(() => []);
  let count = 0;

  function columnsAgree(): boolean {
    let carry = 0;
    for (const [place, { addendLetters, resultLetter }] of columns.entries()) {
      const digits = addendLetters.map((letter) => placed[letter]);
      const result = placed[resultLetter];
      if (result === null || digits.some((digit) => digit === null)) {
        return true;
      }
      const total = digits.reduce<number>((sum, digit) => sum + digit!, carry);
      if (
        total % 10 !== result ||
        (place === columns.length - 1 && total >= 10)
      ) {
        return false;
      }
      carry = Math.floor(total / 10);
    }
    return true;
  }

  function search(depth: number): void {
    if (count >= limit) return;
    if (depth === order.length) {
      const state: FukumenzanPuzzleState = {
        placedDigits: [...placed],
        crossedDigits,
      };
      if (isFukumenzanSolved(equation, state)) count += 1;
      return;
    }
    const letter = order[depth]!;
    for (const digit of fukumenzanDigits) {
      if (placed.includes(digit)) continue;
      placed[letter] = digit;
      if (columnsAgree()) search(depth + 1);
      placed[letter] = null;
    }
  }

  search(0);
  return count;
}

const levels = difficultyLevels.map(({ id }) => id);
const entries = levels.flatMap((difficulty) =>
  listFukumenzanPoolEntries(difficulty).map(
    (entry) => [difficulty, entry] as const,
  ),
);

describe("listFukumenzanPoolEntries", () => {
  test.each(levels)("レベル %s に1問以上の問題があること", (difficulty) => {
    const levelEntries = listFukumenzanPoolEntries(difficulty);

    expect(levelEntries.length).toBeGreaterThan(0);
  });

  test.each(entries)(
    "レベル %s の %s が、盤面に描ける一意解の問題であること",
    (_, entry) => {
      const problem = decodeFukumenzanPoolProblem(entry);
      const solutionCount = countSolutions(problem, 2);

      expect(solutionCount).toBe(1);
    },
  );
});

describe("findFukumenzanPoolEntryByProblemId", () => {
  const [difficulty, entry] = entries[0]!;
  const problemId = createProblemId(
    createFukumenzanProblemIdentity(decodeFukumenzanPoolProblem(entry)),
  );
  const otherDifficulty: DifficultyLevel = difficulty === "1" ? "2" : "1";

  test("問題 ID からその難易度の問題を引けること", () => {
    const found = findFukumenzanPoolEntryByProblemId(difficulty, problemId);

    expect(found).toBe(entry);
  });

  test("別の難易度の ID には null を返すこと", () => {
    const found = findFukumenzanPoolEntryByProblemId(
      otherDifficulty,
      problemId,
    );

    expect(found).toBeNull();
  });
});

describe("findFukumenzanPoolEntry", () => {
  const [, entry] = entries[0]!;
  const identity = createFukumenzanProblemIdentity(
    decodeFukumenzanPoolProblem(entry),
  );
  const unknownIdentity = createFukumenzanProblemIdentity({
    addends: ["AB", "CD"],
    result: "EF",
  });

  test("identity の式の問題を引けること", () => {
    const found = findFukumenzanPoolEntry(identity);

    expect(found).toBe(entry);
  });

  test("問題集に無い identity には null を返すこと", () => {
    const found = findFukumenzanPoolEntry(unknownIdentity);

    expect(found).toBeNull();
  });
});

describe("listFukumenzanPoolProblemIds", () => {
  test("全レベルの問題 ID が重ならないこと", () => {
    const ids = levels.flatMap((difficulty) =>
      listFukumenzanPoolProblemIds(difficulty),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("measureFukumenzanProblemFeatures", () => {
  test.each([
    // 一の位 V N T T・十の位 N F T V・百の位 N U N F・千の位 N。同じ文字の桁は一の位と百の位。
    ["NNV+UFN+NTT=NFVT", { letterCount: 5, sameLetterColumnCount: 2 }],
    // 一の位 C B T C・十の位 K K K B・百の位 B W W E・千の位 B A W C・万の位 K E A・十万の位 A。
    ["KBBKC+EAWKB+WWKT=AACEBC", { letterCount: 7, sameLetterColumnCount: 3 }],
    // 一の位 K K H・十の位 Y T H・百の位 B K K・千の位 T。
    ["BYK+KTK=TKHH", { letterCount: 5, sameLetterColumnCount: 2 }],
  ])("%s の文字の種類と同じ文字の桁を数えること", (entry, expected) => {
    const features = measureFukumenzanProblemFeatures(
      decodeFukumenzanPoolProblem(entry),
    );

    expect(features).toEqual(expected);
  });
});

describe("findFukumenzanPoolProblemFeatures", () => {
  test("問題集に無い ID には null を返すこと", () => {
    const features = findFukumenzanPoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});
