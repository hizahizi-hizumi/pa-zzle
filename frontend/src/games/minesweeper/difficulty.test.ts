import { parseMinesweeperDifficulty } from "./difficulty";

describe("parseMinesweeperDifficulty", () => {
  const definedCases = ["1", "2", "3", "4", "5"] as const;
  const undefinedCases = [undefined, "", "0", "6", "easy"] as const;

  test.each(definedCases)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each(undefinedCases)(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});
