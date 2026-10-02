import {
  formatTsumeShogiProblemQuery,
  hasTsumeShogiProblemQuery,
  parseTsumeShogiProblemQuery,
} from "@/games/tsume-shogi/diagnostics";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import { restoreTsumeShogiProblem } from "@/games/tsume-shogi/problem-selection";

describe("parseTsumeShogiProblemQuery", () => {
  const provisionalIdentity = createTsumeShogiProblemIdentity(3, 14);
  const provisionalParams = new URLSearchParams(
    formatTsumeShogiProblemQuery(provisionalIdentity),
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
  ] as const;

  test("仮の問題の identity から、その問題を読み戻すこと", () => {
    const result = parseTsumeShogiProblemQuery(provisionalParams);

    expect(result).toEqual(restoreTsumeShogiProblem(provisionalIdentity));
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
    ["other=1", false],
  ] as const;

  test.each(cases)("%s で問題の指定かを判定すること", (query, expected) => {
    const result = hasTsumeShogiProblemQuery(new URLSearchParams(query));

    expect(result).toBe(expected);
  });
});
