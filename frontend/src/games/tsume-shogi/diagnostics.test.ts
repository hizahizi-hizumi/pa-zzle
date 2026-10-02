import {
  formatTsumeShogiPoolProblemQuery,
  formatTsumeShogiProblemQuery,
  hasTsumeShogiProblemQuery,
  parseTsumeShogiProblemQuery,
} from "@/games/tsume-shogi/diagnostics";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import { toTsumeShogiPooledProblem } from "@/games/tsume-shogi/problem/problem-pool";

describe("parseTsumeShogiProblemQuery", () => {
  const pooled = toTsumeShogiPooledProblem("3", 2);
  const pooledIdentityParams = new URLSearchParams(
    formatTsumeShogiProblemQuery(pooled.identity),
  );
  const poolParams = new URLSearchParams(
    formatTsumeShogiPoolProblemQuery(pooled.poolReference),
  );
  const poolParamsWithoutVersion = new URLSearchParams(
    `problem=${pooled.poolReference.problemId}`,
  );
  const generatedIdentity = createTsumeShogiProblemIdentity(3, 0);
  const paramsWithoutGenerator = new URLSearchParams("seed=ts-3-0&plies=3");
  const rootCheckIdentity = createTsumeShogiProblemIdentity(3, 3, {
    minimum: 1,
    maximum: 1,
  });
  const rootCheckParams = new URLSearchParams(
    formatTsumeShogiProblemQuery(rootCheckIdentity),
  );
  const invalidCases = [
    ["seed の欠けたクエリ", "plies=3"],
    ["扱わない手数", "seed=ts-7-0&plies=7"],
    ["数でない手数", "seed=ts-3-0&plies=three"],
    ["今と違う生成器の版", "generator=0&seed=ts-3-0&plies=3"],
    ["形の違う初手の王手の数の範囲", "seed=ts-3-c1-1-3&plies=3&checks=1"],
    ["逆転した初手の王手の数の範囲", "seed=ts-3-c4-1-3&plies=3&checks=4-1"],
    ["今と違う問題集の版", "pool=0&problem=1-1"],
    ["範囲外の問題番号", "problem=1-100000"],
    [
      "問題集の番号と identity が混ざったクエリ",
      "problem=1-1&seed=ts-3-0&plies=3",
    ],
  ] as const;

  test("問題集の問題の identity から、その問題を読み戻すこと", () => {
    const result = parseTsumeShogiProblemQuery(pooledIdentityParams);

    expect(result).toEqual({
      problem: pooled.problem,
      identity: pooled.identity,
    });
  });

  test.each([
    ["版つき", poolParams],
    ["版を省いた", poolParamsWithoutVersion],
  ])("%sの問題集の番号から、その問題を読み戻すこと", (_, params) => {
    const result = parseTsumeShogiProblemQuery(params);

    expect(result).toEqual({
      problem: pooled.problem,
      identity: pooled.identity,
    });
  });

  test("生成器の版を省略したクエリは今の版として、生成器で問題を作ること", () => {
    const result = parseTsumeShogiProblemQuery(paramsWithoutGenerator);

    expect(result?.identity).toEqual(generatedIdentity);
    expect(formatTsumeShogiProblemText(result!.problem).mainLine).toHaveLength(
      3,
    );
  });

  test("初手の王手の数の範囲のある identity から、生成器で問題を作ること", () => {
    const result = parseTsumeShogiProblemQuery(rootCheckParams);

    expect(rootCheckParams.get("checks")).toBe("1-1");
    expect(result?.identity).toEqual(rootCheckIdentity);
  });

  test.each(invalidCases)("%sは null を返すこと", (_, query) => {
    const result = parseTsumeShogiProblemQuery(new URLSearchParams(query));

    expect(result).toBeNull();
  });
});

describe("hasTsumeShogiProblemQuery", () => {
  const cases = [
    ["seed=ts-3-0", true],
    ["plies=3", true],
    ["problem=1-1", true],
    ["other=1", false],
  ] as const;

  test.each(cases)("%s で問題の指定かを判定すること", (query, expected) => {
    const result = hasTsumeShogiProblemQuery(new URLSearchParams(query));

    expect(result).toBe(expected);
  });
});
