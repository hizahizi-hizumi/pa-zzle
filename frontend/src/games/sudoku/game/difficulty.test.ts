import { expect, test } from "vitest";

import { parseSudokuDifficulty } from "./difficulty";

test.each(["easy", "normal", "hard"] as const)(
  "%s を定義済みの難易度として受理すること",
  (input) => {
    const result = parseSudokuDifficulty(input);

    expect(result).toBe(input);
  },
);

test.each([undefined, "", "impossible"])(
  "%s を未定義の難易度として拒否すること",
  (input) => {
    const result = parseSudokuDifficulty(input);

    expect(result).toBeUndefined();
  },
);
