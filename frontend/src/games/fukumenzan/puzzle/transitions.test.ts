import type { FukumenzanEquation } from "@/games/fukumenzan/puzzle/equation";
import {
  createInitialFukumenzanState,
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  fukumenzanDigits,
} from "@/games/fukumenzan/puzzle/state";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import {
  createProblemSeededRandom,
  pickProblemValue,
} from "@/games/problem-seed";

// 文字は B Y K T H の順。
const equation: FukumenzanEquation = {
  addends: ["BYK", "KTK"],
  result: "TKHH",
};
const initial = createInitialFukumenzanState(equation);

function withPlaced(
  placedDigits: readonly (FukumenzanDigit | null)[],
): FukumenzanPuzzleState {
  return { ...initial, placedDigits };
}

describe("placeFukumenzanDigit", () => {
  test("列の札を空の文字に入れること", () => {
    const state = placeFukumenzanDigit(initial, 2, 5);

    expect(state.placedDigits).toEqual([null, null, 5, null, null]);
  });

  describe("札がほかの文字に入っている場合", () => {
    const placed = withPlaced([9, null, 5, null, null]);

    test("札を運び直し、前の文字を空にすること", () => {
      const state = placeFukumenzanDigit(placed, 1, 5);

      expect(state.placedDigits).toEqual([9, 5, null, null, null]);
    });
  });

  describe("文字に別の札が入っている場合", () => {
    const placed = withPlaced([9, null, 5, null, null]);

    test("入れた札に替え、前の札を列へ戻すこと", () => {
      const state = placeFukumenzanDigit(placed, 2, 1);

      expect(state.placedDigits).toEqual([9, null, 1, null, null]);
    });
  });

  describe("文字に同じ札が入っている場合", () => {
    const placed = withPlaced([9, null, 5, null, null]);

    test("同じ状態を返すこと", () => {
      const state = placeFukumenzanDigit(placed, 2, 5);

      expect(state).toBe(placed);
    });
  });

  test("無い文字を拒むこと", () => {
    const act = () => placeFukumenzanDigit(initial, 5, 1);

    expect(act).toThrow(RangeError);
  });
});

describe("returnFukumenzanDigit", () => {
  const placed = withPlaced([9, null, 5, null, null]);

  test("文字の札を列へ戻して空にすること", () => {
    const state = returnFukumenzanDigit(placed, 0);

    expect(state.placedDigits).toEqual([null, null, 5, null, null]);
  });

  test("空の文字には同じ状態を返すこと", () => {
    const state = returnFukumenzanDigit(placed, 1);

    expect(state).toBe(placed);
  });
});

describe("toggleFukumenzanCross", () => {
  const crossed: FukumenzanPuzzleState = {
    ...initial,
    crossedDigits: [[], [], [0, 7], [], []],
  };

  test("× の無い札に × を付け、小さい順に並べること", () => {
    const state = toggleFukumenzanCross(crossed, 2, 3);

    expect(state.crossedDigits[2]).toEqual([0, 3, 7]);
  });

  test("× の付いた札から × を外すこと", () => {
    const state = toggleFukumenzanCross(crossed, 2, 7);

    expect(state.crossedDigits[2]).toEqual([0]);
  });

  test("ほかの文字の × を変えないこと", () => {
    const state = toggleFukumenzanCross(crossed, 0, 3);

    expect(state.crossedDigits).toEqual([[3], [], [0, 7], [], []]);
  });
});

describe("無作為な操作の列", () => {
  const random = createProblemSeededRandom("fukumenzan-transitions");
  const operationCount = 2000;
  const letterCount = initial.placedDigits.length;
  const letterIndices = Array.from(
    { length: letterCount },
    (_, index) => index,
  );

  test("1つの札が2つの文字に入らないこと", () => {
    let state = initial;
    let duplicatedCount = 0;
    for (let step = 0; step < operationCount; step += 1) {
      const letter = pickProblemValue(letterIndices, random);
      const digit = pickProblemValue(fukumenzanDigits, random);
      const kind = random();
      state =
        kind < 0.5
          ? placeFukumenzanDigit(state, letter, digit)
          : kind < 0.7
            ? returnFukumenzanDigit(state, letter)
            : toggleFukumenzanCross(state, letter, digit);
      const placed = state.placedDigits.filter(
        (placedDigit) => placedDigit !== null,
      );
      if (new Set(placed).size !== placed.length) {
        duplicatedCount += 1;
      }
    }

    expect(duplicatedCount).toBe(0);
  });
});
