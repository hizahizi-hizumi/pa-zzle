import {
  formatReflectionPoolProblemQuery,
  formatReflectionProblemQuery,
  hasReflectionProblemQuery,
  parseReflectionProblemQuery,
} from "@/games/reflection/diagnostics";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { toReflectionPooledProblem } from "@/games/reflection/problem/problem-pool";

describe("parseReflectionProblemQuery", () => {
  const identity = createReflectionProblemIdentity(6, 6, 2);
  const formattedParams = new URLSearchParams(
    formatReflectionProblemQuery(identity),
  );
  const paramsWithoutGenerator = new URLSearchParams(
    "seed=rf-5-3-0&size=5&pieces=3",
  );
  const invalidCases = [
    ["seed の欠けたクエリ", "size=5&pieces=3"],
    ["扱わない盤面サイズ", "seed=a&size=8&pieces=3"],
    ["盤面に収まらないピース数", "seed=a&size=5&pieces=25"],
    ["数でないピース数", "seed=a&size=5&pieces=three"],
    ["今と違う生成器の版", "generator=0&seed=a&size=5&pieces=3"],
    ["今と違う問題集の版", "pool=0&problem=1-1"],
    ["問題集に無い問題番号", "problem=1-100000"],
    ["問題番号の無い問題集の版", "pool=1"],
    [
      "問題集の番号と identity の両方",
      "problem=1-1&seed=rf-5-3-0&size=5&pieces=3",
    ],
  ] as const;

  test("formatReflectionProblemQuery で書き出したクエリから同じ identity を読み戻すこと", () => {
    const result = parseReflectionProblemQuery(formattedParams);

    expect(result).toEqual(identity);
  });

  test("生成器の版を省略したクエリは今の版として読むこと", () => {
    const result = parseReflectionProblemQuery(paramsWithoutGenerator);

    expect(result).toEqual(createReflectionProblemIdentity(5, 3, 0));
  });

  const pooled = toReflectionPooledProblem("3", 1);
  const poolParams = new URLSearchParams(
    formatReflectionPoolProblemQuery(pooled.poolReference),
  );
  const poolParamsWithoutVersion = new URLSearchParams("problem=3-2");

  test("問題集の番号で指定したクエリから、その問題の identity を読むこと", () => {
    const result = parseReflectionProblemQuery(poolParams);

    expect(result).toEqual(pooled.identity);
  });

  test("問題集の版を省略したクエリは今の版として読むこと", () => {
    const result = parseReflectionProblemQuery(poolParamsWithoutVersion);

    expect(result).toEqual(pooled.identity);
  });

  test.each(invalidCases)(
    "読めないクエリに null を返すこと: %s",
    (_, query) => {
      const result = parseReflectionProblemQuery(new URLSearchParams(query));

      expect(result).toBeNull();
    },
  );
});

describe("hasReflectionProblemQuery", () => {
  const cases = [
    ["seed=a", true],
    ["size=5", true],
    ["problem=1-1", true],
    ["from=home", false],
  ] as const;

  test.each(cases)(
    "問題指定のキーを含むかを返すこと: %s",
    (query, expected) => {
      const result = hasReflectionProblemQuery(new URLSearchParams(query));

      expect(result).toBe(expected);
    },
  );
});
