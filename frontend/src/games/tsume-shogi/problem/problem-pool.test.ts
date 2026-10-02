import { createProblemId } from "@/games/problem-id";
import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  parseTsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";
import {
  findTsumeShogiPooledProblem,
  findTsumeShogiPooledProblemByProblemId,
  formatTsumeShogiPoolPosition,
  formatTsumeShogiPoolProblemId,
  listTsumeShogiPoolEntries,
  parseTsumeShogiPoolPosition,
  parseTsumeShogiPoolSeed,
  restoreTsumeShogiPoolEntry,
  toTsumeShogiPooledProblem,
  toTsumeShogiPoolIdentity,
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

  test("起点の詰め手の種類を含む seed から identity を作ること", () => {
    const identity = parseTsumeShogiPoolSeed("ts-3-c1-4-move-7");

    expect(identity).toEqual(
      createTsumeShogiProblemIdentity(
        3,
        7,
        { minimum: 1, maximum: 4 },
        "board-move",
      ),
    );
  });

  const invalidCases = [
    ["初手の王手の数の範囲の無い seed", "ts-5-3"],
    ["扱わない手数の seed", "ts-7-c1-4-0"],
    ["扱わない起点の詰め手の種類の seed", "ts-3-c1-4-drop-0"],
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

  describe("起点の詰め手の種類のある問題", () => {
    const boardMoveIndex = listTsumeShogiPoolEntries("1").findIndex(([seed]) =>
      seed.includes("-move-"),
    );
    const boardMovePooled = toTsumeShogiPooledProblem("1", boardMoveIndex);

    test("同じ identity から同じ問題を引くこと", () => {
      const found = findTsumeShogiPooledProblem(
        structuredClone(boardMovePooled.identity),
      );

      expect(boardMovePooled.identity.conditions.baseMate).toBe("board-move");
      expect(found).toEqual(boardMovePooled);
    });

    test("起点の詰め手の種類の無い identity には null を返すこと", () => {
      const { baseMate: _, ...conditions } =
        boardMovePooled.identity.conditions;

      const found = findTsumeShogiPooledProblem({
        ...boardMovePooled.identity,
        conditions,
      });

      expect(found).toBeNull();
    });
  });
});

describe("findTsumeShogiPooledProblemByProblemId", () => {
  const poolEntries = tsumeShogiDifficulties.flatMap(({ id: difficulty }) =>
    listTsumeShogiPoolEntries(difficulty).map((entry, entryIndex) => ({
      difficulty,
      poolProblemId: formatTsumeShogiPoolProblemId(difficulty, entryIndex),
      problemId: createProblemId(toTsumeShogiPoolIdentity(entry)),
    })),
  );

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, poolProblemId, problemId }) =>
        findTsumeShogiPooledProblemByProblemId(difficulty, problemId)
          ?.poolReference.problemId !== poolProblemId,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDには null を返すこと", () => {
    const [{ problemId }] = poolEntries as [(typeof poolEntries)[number]];
    const found = findTsumeShogiPooledProblemByProblemId("5", problemId);

    expect(found).toBeNull();
  });
});
