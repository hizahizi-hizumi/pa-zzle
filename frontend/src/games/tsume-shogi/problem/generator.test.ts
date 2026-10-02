import { validateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generation/validator";
import { generateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generator";
import {
  assertTsumeShogiProblem,
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  TSUME_SHOGI_GENERATOR_VERSION,
} from "@/games/tsume-shogi/problem/problem";

describe("generateTsumeShogiProblem", () => {
  describe.each([1, 3, 5] as const)("%i手の identity", (plies) => {
    const identity = createTsumeShogiProblemIdentity(plies, 0);

    test("strict validator が採用する、条件どおりの手数の問題を作ること", () => {
      const { problem } = generateTsumeShogiProblem(identity);

      const validation = validateTsumeShogiProblem(
        problem.initialPosition,
        plies,
      );

      expect(() => assertTsumeShogiProblem(problem)).not.toThrow();
      expect(problem.plies).toBe(plies);
      expect(validation.verdict).toBe("accepted");
    });
  });

  describe("同じ identity", () => {
    const identity = createTsumeShogiProblemIdentity(3, 1);

    test("同じ問題を作り、identity をそのまま返すこと", () => {
      const first = generateTsumeShogiProblem(identity);
      const second = generateTsumeShogiProblem(structuredClone(identity));

      expect(formatTsumeShogiProblemText(second.problem)).toEqual(
        formatTsumeShogiProblemText(first.problem),
      );
      expect(second.identity).toEqual(identity);
    });
  });

  describe("seed の違う identity", () => {
    const identities = [0, 1, 2].map((index) =>
      createTsumeShogiProblemIdentity(3, index),
    );

    test("別の問題を作ること", () => {
      const sfens = identities.map(
        (identity) =>
          formatTsumeShogiProblemText(
            generateTsumeShogiProblem(identity).problem,
          ).sfen,
      );

      expect(new Set(sfens).size).toBe(identities.length);
    });
  });

  describe("扱わない identity", () => {
    const cases = [
      [
        "版の違う",
        { generatorVersion: "0", seed: "ts-3-0", conditions: { plies: 3 } },
        Error,
      ],
      [
        "手数が扱わない",
        {
          generatorVersion: TSUME_SHOGI_GENERATOR_VERSION,
          seed: "ts-7-0",
          conditions: { plies: 7 },
        },
        RangeError,
      ],
    ] as const;

    test.each(cases)("%s identity を拒否すること", (_, identity, error) => {
      const act = () =>
        generateTsumeShogiProblem(
          identity as unknown as Parameters<
            typeof generateTsumeShogiProblem
          >[0],
        );

      expect(act).toThrow(error);
    });
  });
});
