import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  parseTsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import {
  findTsumeShogiPooledProblem,
  findTsumeShogiPooledProblemByReference,
  formatTsumeShogiPoolPosition,
  getTsumeShogiProblemPoolVersion,
  listTsumeShogiPoolEntries,
  parseTsumeShogiPoolPosition,
  parseTsumeShogiPoolSeed,
  restoreTsumeShogiPoolEntry,
  toTsumeShogiPooledProblem,
} from "@/games/tsume-shogi/problem/problem-pool";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

const fivePly = parseTsumeShogiProblemText({
  sfen: "6l1k/7g1/7P1/4+B4/9/2B6/9/9/9 b 2r3g4s4n3l17p 1",
  mainLine: ["5d2a", "2b2a", "7f2a+", "1a2a", "G*2b"],
});

describe("formatTsumeShogiPoolPosition", () => {
  const cases = [
    [
      "攻方の持駒の無い局面",
      createTsumeShogiPosition("6l1k/7g1/7P1/4+B4/9/2B6/9/9/9", {}),
      "6l1k/7g1/7P1/4+B4/9/2B6/9/9/9 -",
    ],
    [
      "攻方の持駒が2種類ある局面",
      createTsumeShogiPosition("8k/7Ps/7+P1/9/9/9/9/9/9", {
        gold: 2,
        silver: 1,
      }),
      "8k/7Ps/7+P1/9/9/9/9/9/9 2GS",
    ],
  ] as const;

  test.each(cases)(
    "%sを盤面と攻方の持駒だけにし、読み戻すと同じ局面になること",
    (_, position, expected) => {
      const formatted = formatTsumeShogiPoolPosition(position);
      const parsed = parseTsumeShogiPoolPosition(formatted);

      expect(formatted).toBe(expected);
      expect(formatTsumeShogiPosition(parsed)).toBe(
        formatTsumeShogiPosition(position),
      );
    },
  );
});

describe("parseTsumeShogiPoolPosition", () => {
  const invalidCases = [
    ["持駒の無い文字列", "8k/9/9/9/9/9/9/9/9"],
    ["玉方の持駒を含む文字列", "8k/9/9/9/9/9/9/9/9 Gr"],
    ["区切りの多い文字列", "8k/9/9/9/9/9/9/9/9 G 1"],
  ] as const;

  test.each(invalidCases)("%sを拒否すること", (_, text) => {
    const act = () => parseTsumeShogiPoolPosition(text);

    expect(act).toThrow(RangeError);
  });
});

describe("parseTsumeShogiPoolSeed", () => {
  test("手数・初手の王手の数の範囲・候補番号から identity を作ること", () => {
    const identity = parseTsumeShogiPoolSeed("ts-5-c6-99-12");

    expect(identity).toEqual(
      createTsumeShogiProblemIdentity(5, 12, { minimum: 6, maximum: 99 }),
    );
  });

  const invalidCases = [
    ["初手の王手の数の範囲の無い seed", "ts-5-3"],
    ["扱わない手数の seed", "ts-7-c1-4-0"],
  ] as const;

  test.each(invalidCases)("%sを拒否すること", (_, seed) => {
    const act = () => parseTsumeShogiPoolSeed(seed);

    expect(act).toThrow(RangeError);
  });
});

describe("restoreTsumeShogiPoolEntry", () => {
  const reference = { poolVersion: "1", problemId: "3-5" };
  const position = formatTsumeShogiPoolPosition(fivePly.initialPosition);
  const mainLine = formatTsumeShogiProblemText(fivePly).mainLine.join(" ");

  test("seed の identity と、盤面・攻方の持駒・作意から問題を復元すること", () => {
    const pooled = restoreTsumeShogiPoolEntry(
      ["ts-5-c3-12-7", position, mainLine],
      reference,
    );

    expect(formatTsumeShogiProblemText(pooled.problem)).toEqual(
      formatTsumeShogiProblemText(fivePly),
    );
    expect(pooled.identity).toEqual(
      createTsumeShogiProblemIdentity(5, 7, { minimum: 3, maximum: 12 }),
    );
    expect(pooled.poolReference).toEqual(reference);
  });

  test("seed の手数と作意の長さが違う問題を拒否すること", () => {
    const act = () =>
      restoreTsumeShogiPoolEntry(
        ["ts-3-c3-12-7", position, mainLine],
        reference,
      );

    expect(act).toThrow(RangeError);
  });
});

describe("同梱の問題集", () => {
  const entries = tsumeShogiDifficulties.flatMap(({ id }) =>
    listTsumeShogiPoolEntries(id).map(
      (_, index) => [`${id}-${index + 1}`, id, index] as const,
    ),
  );

  test("どのレベルにも問題があること", () => {
    const counts = tsumeShogiDifficulties.map(
      ({ id }) => listTsumeShogiPoolEntries(id).length,
    );

    expect(counts.every((count) => count > 0)).toBe(true);
  });

  test("すべての問題を復元できること", () => {
    const restore = () =>
      entries.map(([, difficulty, index]) =>
        toTsumeShogiPooledProblem(difficulty, index),
      );

    expect(restore).not.toThrow();
  });
});

describe("findTsumeShogiPooledProblem", () => {
  const pooled = toTsumeShogiPooledProblem("3", 4);

  test("問題集の identity から同じ問題を引くこと", () => {
    const found = findTsumeShogiPooledProblem(structuredClone(pooled.identity));

    expect(found).toEqual(pooled);
  });

  test("初手の王手の数の範囲の違う identity には null を返すこと", () => {
    const found = findTsumeShogiPooledProblem({
      ...pooled.identity,
      conditions: { plies: pooled.identity.conditions.plies },
    });

    expect(found).toBeNull();
  });
});

describe("findTsumeShogiPooledProblemByReference", () => {
  const pooled = toTsumeShogiPooledProblem("5", 0);
  const poolVersion = getTsumeShogiProblemPoolVersion();

  test("問題集の版と問題番号から同じ問題を引くこと", () => {
    const found = findTsumeShogiPooledProblemByReference({
      poolVersion,
      problemId: "5-1",
    });

    expect(found).toEqual(pooled);
  });

  const missingCases = [
    ["版の違う", { poolVersion: "0", problemId: "5-1" }],
    ["番号が範囲外の", { poolVersion, problemId: "5-100000" }],
    ["形の違う", { poolVersion, problemId: "5" }],
  ] as const;

  test.each(missingCases)("%s問題番号には null を返すこと", (_, reference) => {
    const found = findTsumeShogiPooledProblemByReference(reference);

    expect(found).toBeNull();
  });
});
