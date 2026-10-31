import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
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
  hasTsumeShogiPoolProblemId,
  listTsumeShogiPoolEntries,
  listTsumeShogiPoolSeeds,
  parseTsumeShogiPoolPosition,
  parseTsumeShogiPoolSeed,
  restoreTsumeShogiPoolEntry,
  storeTsumeShogiProblemPool,
  toTsumeShogiPooledProblem,
  toTsumeShogiPoolIdentity,
} from "@/games/tsume-shogi/problem/problem-pool";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

// 問題集の本体は画面を開いたときに読み込むので、テストではファイルの内容を先に置いておく。
storeTsumeShogiProblemPool(problemPoolJson);

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

  test("起点の玉の範囲を含む seed から identity を作ること", () => {
    const identity = parseTsumeShogiPoolSeed("ts-5-c10-99-mid-3");

    expect(identity).toEqual(
      createTsumeShogiProblemIdentity(
        5,
        3,
        { minimum: 10, maximum: 99 },
        undefined,
        "middle",
      ),
    );
  });

  test("起点の詰め手の種類と玉の範囲を含む seed から identity を作ること", () => {
    const identity = parseTsumeShogiPoolSeed("ts-3-c1-4-move-mid-7");

    expect(identity).toEqual(
      createTsumeShogiProblemIdentity(
        3,
        7,
        { minimum: 1, maximum: 4 },
        "board-move",
        "middle",
      ),
    );
  });

  const invalidCases = [
    ["初手の王手の数の範囲の無い seed", "ts-5-3"],
    ["扱わない手数の seed", "ts-7-c1-4-0"],
    ["扱わない起点の詰め手の種類の seed", "ts-3-c1-4-drop-0"],
    ["起点の玉の範囲と詰め手の種類の順が逆の seed", "ts-3-c1-4-mid-move-0"],
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

describe("loadTsumeShogiProblemPool", () => {
  let fresh: typeof import("@/games/tsume-shogi/problem/problem-pool");
  let fetchProblemPool: ReturnType<typeof vi.fn>;

  function respondWithProblemPool(): Response {
    return new Response(JSON.stringify(problemPoolJson));
  }

  beforeEach(async () => {
    vi.resetModules();
    fresh = await import("@/games/tsume-shogi/problem/problem-pool");
    fetchProblemPool = vi.fn(async () => respondWithProblemPool());
    vi.stubGlobal("fetch", fetchProblemPool);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("読み込む前は、索引で問題 ID を引けても問題を復元できないこと", () => {
    const [seed] = fresh.listTsumeShogiPoolSeeds("2");
    const found = fresh.hasTsumeShogiPoolProblemId(
      "2",
      createProblemId(fresh.parseTsumeShogiPoolSeed(seed!)),
    );
    const restore = () => fresh.toTsumeShogiPooledProblem("2", 0);

    expect(fresh.isTsumeShogiProblemPoolLoaded()).toBe(false);
    expect(found).toBe(true);
    expect(restore).toThrow();
  });

  test("読み込んでから問題を復元できること", async () => {
    await fresh.loadTsumeShogiProblemPool();
    const pooled = fresh.toTsumeShogiPooledProblem("2", 0);

    expect(pooled.identity.seed).toBe(fresh.listTsumeShogiPoolSeeds("2")[0]);
  });

  test("読み込んだ後は読み込み直さないこと", async () => {
    await fresh.loadTsumeShogiProblemPool();
    await fresh.loadTsumeShogiProblemPool();

    expect(fetchProblemPool).toHaveBeenCalledOnce();
  });

  const failures = [
    ["通信が切れた", () => Promise.reject(new TypeError("Failed to fetch"))],
    [
      "サーバーがエラーを返した",
      async () => new Response(null, { status: 503 }),
    ],
  ] as const;

  describe.each(failures)("%s場合", (_, fail) => {
    beforeEach(() => {
      fetchProblemPool.mockImplementationOnce(fail);
    });

    test("失敗を返し、次に呼んだときに読み込み直すこと", async () => {
      const firstFailed = await fresh.loadTsumeShogiProblemPool().then(
        () => false,
        () => true,
      );
      const loadedAfterFailure = fresh.isTsumeShogiProblemPoolLoaded();
      await fresh.loadTsumeShogiProblemPool();

      expect(firstFailed).toBe(true);
      expect(loadedAfterFailure).toBe(false);
      expect(fetchProblemPool).toHaveBeenCalledTimes(2);
      expect(fresh.isTsumeShogiProblemPoolLoaded()).toBe(true);
    });
  });
});

describe("同梱の問題集", () => {
  const entries = difficultyLevels.flatMap(({ id }) =>
    listTsumeShogiPoolEntries(id).map(
      (_, index) => [`${id}-${index + 1}`, id, index] as const,
    ),
  );

  test("どのレベルにも問題があること", () => {
    const counts = difficultyLevels.map(
      ({ id }) => listTsumeShogiPoolEntries(id).length,
    );

    expect(counts.every((count) => count > 0)).toBe(true);
  });

  test("索引の seed が問題集と同じ並びであること", () => {
    for (const { id } of difficultyLevels) {
      expect(listTsumeShogiPoolSeeds(id)).toEqual(
        listTsumeShogiPoolEntries(id).map(([seed]) => seed),
      );
    }
  });

  test("索引で問題集のすべての問題 ID を引けること", () => {
    const found = entries.every(([, difficulty, index]) =>
      hasTsumeShogiPoolProblemId(
        difficulty,
        createProblemId(
          toTsumeShogiPoolIdentity(
            listTsumeShogiPoolEntries(difficulty)[index]!,
          ),
        ),
      ),
    );

    expect(found).toBe(true);
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

  describe("起点の玉の範囲のある問題", () => {
    const middleIndex = listTsumeShogiPoolEntries("5").findIndex(([seed]) =>
      seed.includes("-mid-"),
    );
    const middlePooled = toTsumeShogiPooledProblem("5", middleIndex);

    test("同じ identity から同じ問題を引くこと", () => {
      const found = findTsumeShogiPooledProblem(
        structuredClone(middlePooled.identity),
      );

      expect(middlePooled.identity.conditions.baseKingArea).toBe("middle");
      expect(found).toEqual(middlePooled);
    });

    test("起点の玉の範囲の無い identity には null を返すこと", () => {
      const { baseKingArea: _, ...conditions } =
        middlePooled.identity.conditions;

      const found = findTsumeShogiPooledProblem({
        ...middlePooled.identity,
        conditions,
      });

      expect(found).toBeNull();
    });
  });
});

describe("findTsumeShogiPooledProblemByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
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
