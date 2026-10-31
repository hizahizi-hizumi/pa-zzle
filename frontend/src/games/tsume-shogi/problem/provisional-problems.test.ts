import { generateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generator";
import {
  assertTsumeShogiProblem,
  formatTsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import { listTsumeShogiProvisionalProblems } from "@/games/tsume-shogi/problem/provisional-problems";

describe("listTsumeShogiProvisionalProblems", () => {
  const provisionalProblems = listTsumeShogiProvisionalProblems().map(
    (provisional) => [provisional.identity.seed, provisional] as const,
  );

  test.each(provisionalProblems)(
    "%s は作意どおりに詰む問題であること",
    (_, { problem }) => {
      const act = () => assertTsumeShogiProblem(problem);

      expect(act).not.toThrow();
    },
  );

  test.each(provisionalProblems)(
    "%s は生成器が identity から作る問題と同じであること",
    (_, { problem, identity }) => {
      const generated = generateTsumeShogiProblem(identity);

      expect(formatTsumeShogiProblemText(generated.problem)).toEqual(
        formatTsumeShogiProblemText(problem),
      );
      expect(generated.validation.verdict).toBe("accepted");
    },
  );
});
