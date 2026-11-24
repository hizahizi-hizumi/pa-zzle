import { difficultyLevels } from "@/games/difficulty";
import {
  findSolitairePoolEntryByProblemId,
  findSolitairePoolProblemFeatures,
  listSolitairePoolEntries,
  listSolitairePoolProblemIds,
  measureSolitaireProblemFeatures,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import { parseSolitaireCard } from "@/games/solitaire/puzzle/card";

const difficulties = difficultyLevels.map(({ id }) => id);

function parseCards(text: string) {
  return text.split(" ").map((card) => parseSolitaireCard(card)!);
}

describe("listSolitairePoolEntries", () => {
  test.each(difficulties)(
    "レベル %s の問題がどれも52枚を1回ずつ配った問題として復元できること",
    (difficulty) => {
      const entries = listSolitairePoolEntries(difficulty);

      const restored = entries.map(restoreSolitairePoolEntry);

      expect(restored.length).toBeGreaterThan(0);
    },
  );
});

describe("listSolitairePoolProblemIds", () => {
  test.each(difficulties)(
    "レベル %s の問題 ID でそのレベルの問題を引けること",
    (difficulty) => {
      const problemIds = listSolitairePoolProblemIds(difficulty);

      const entries = problemIds.map((problemId) =>
        findSolitairePoolEntryByProblemId(difficulty, problemId),
      );

      expect(entries).toEqual(listSolitairePoolEntries(difficulty));
    },
  );

  test("全レベルを通して問題 ID が重ならないこと", () => {
    const problemIds = difficulties.flatMap(listSolitairePoolProblemIds);

    const unique = new Set(problemIds);

    expect(unique.size).toBe(problemIds.length);
  });
});

describe("findSolitairePoolEntryByProblemId", () => {
  const [problemId] = listSolitairePoolProblemIds("1");
  const cases = [
    ["別のレベルの問題 ID", "2", problemId!],
    ["問題集に無い問題 ID", "1", "0000000000"],
  ] as const;

  test.each(cases)("%s には null を返すこと", (_, difficulty, id) => {
    const entry = findSolitairePoolEntryByProblemId(difficulty, id);

    expect(entry).toBeNull();
  });
});

describe("findSolitairePoolProblemFeatures", () => {
  // 導入調査の図鑑の資料の期待値（`solitaire_zukan.expected.json`）。
  const cases = [
    ["1", { cardsAboveAce: 0, cardsBelowKing: 0 }],
    ["2", { cardsAboveAce: 0, cardsBelowKing: 7 }],
    ["3", { cardsAboveAce: 0, cardsBelowKing: 5 }],
    ["4", { cardsAboveAce: 3, cardsBelowKing: 0 }],
    ["5", { cardsAboveAce: 2, cardsBelowKing: 0 }],
  ] as const;

  test.each(cases)(
    "レベル %s の先頭の問題の特徴を、配った列から数えること",
    (difficulty, expected) => {
      const [problemId] = listSolitairePoolProblemIds(difficulty);

      const features = findSolitairePoolProblemFeatures(difficulty, problemId!);

      expect(features).toEqual(expected);
    },
  );

  test("問題集に無い問題 ID には null を返すこと", () => {
    const features = findSolitairePoolProblemFeatures("1", "0000000000");

    expect(features).toBeNull();
  });
});

describe("measureSolitaireProblemFeatures", () => {
  // 列4 は A が2枚あり、一番奥の A より上に3枚。列5 は K が2枚あり、一番手前の K より下に3枚。
  // 列6 は A より上に2枚。列7 は一番奥が A、一番手前が K で、A より上と K より下にどちらも6枚。
  const problem = {
    columns: [
      parseCards("2S"),
      parseCards("3S 4S"),
      parseCards("5S 6S 7S"),
      parseCards("AS 2H AH 3H"),
      parseCards("KS 4H 5H KH 6H"),
      parseCards("7H 8H 9H AD 10H JH"),
      parseCards("AC 2D 3D 4D 5D 6D KD"),
    ],
    stock: [],
  };

  test("列ごとに、一番奥の A より上の札と、一番手前の K より下の札を数えて足すこと", () => {
    const features = measureSolitaireProblemFeatures(problem);

    expect(features).toEqual({
      cardsAboveAce: 3 + 2 + 6,
      cardsBelowKing: 3 + 6,
    });
  });
});
