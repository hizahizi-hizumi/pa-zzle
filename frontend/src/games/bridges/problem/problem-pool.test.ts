import { createBridgesProblemIdentity } from "@/games/bridges/problem/problem";
import {
  decodeBridgesPoolProblem,
  encodeBridgesPoolClues,
  encodeBridgesPoolIslands,
  findBridgesPoolEntry,
  findBridgesPoolEntryByProblemId,
  findBridgesPoolProblemFeatures,
  listBridgesPoolEntries,
  listBridgesPoolProblemIds,
  toBridgesPooledProblem,
  toBridgesPoolIdentity,
} from "@/games/bridges/problem/problem-pool";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";

describe("encodeBridgesPoolIslands", () => {
  // 3×3 の9ビットのうち、左上（0番）と右下（8番）が立つ。
  const board = parseBridgesBoard(["1..", "...", "..1"]);

  test("盤面の全マスの順のビット列を16進で表すこと", () => {
    const encoded = encodeBridgesPoolIslands(board);

    expect(encoded).toBe("808");
  });
});

describe("decodeBridgesPoolProblem", () => {
  const problem = parseBridgesBoard([
    "2..3...2",
    "........",
    "4.5.1..3",
    "........",
    ".1..2...",
    "........",
    "3.4...3.",
    "........",
  ]);

  test("encodeBridgesPoolIslands と encodeBridgesPoolClues で表した問題を元へ戻すこと", () => {
    const decoded = decodeBridgesPoolProblem(
      8,
      encodeBridgesPoolIslands(problem),
      encodeBridgesPoolClues(problem),
    );

    expect(decoded).toEqual(problem);
  });

  // 7×7 は 49 ビットで13桁、末尾の3ビットは埋め草。
  test.each([
    ["盤面の大きさと合わない桁数", 7, "8".padEnd(12, "0"), "1"],
    ["16進でない文字", 7, `${"8".padEnd(12, "0")}g`, "1"],
    ["末尾の埋め草に立ったビット", 7, `${"8".padEnd(12, "0")}1`, "1"],
    ["島の数と合わない数字の数", 7, "8".padEnd(13, "0"), "11"],
    ["9 の数字", 7, "8".padEnd(13, "0"), "9"],
    ["隣り合う島", 7, "c".padEnd(13, "0"), "11"],
    ["生成器が扱わない一辺", 5, "8".padEnd(7, "0"), "1"],
  ] as const)("%sを拒むこと", (_, size, islands, clues) => {
    const act = () => decodeBridgesPoolProblem(size, islands, clues);

    expect(act).toThrow(RangeError);
  });
});

describe("toBridgesPoolIdentity", () => {
  test("生成条件（密度・2本・輪・分割）の百分率と磨く回数・候補番号から identity を作ること", () => {
    const identity = toBridgesPoolIdentity([
      9,
      26,
      50,
      25,
      45,
      150,
      "lookahead",
      31,
      "0",
      "",
      1,
      2,
      3,
      4,
      1,
    ]);

    expect(identity).toEqual(
      createBridgesProblemIdentity(
        {
          size: 9,
          islandDensity: 0.26,
          doubleBridgeRate: 0.5,
          extraBridgeRate: 0.25,
          splitRate: 0.45,
          refinementSteps: 150,
          refinementGoal: "lookahead",
        },
        31,
      ),
    );
  });

  test("扱わない生成条件を拒むこと", () => {
    const act = () =>
      toBridgesPoolIdentity([
        9,
        50,
        50,
        25,
        45,
        150,
        "lookahead",
        31,
        "0",
        "",
        1,
        2,
        3,
        4,
        1,
      ]);

    expect(act).toThrow(RangeError);
  });
});

describe("同梱の問題集", () => {
  const levels = difficultyLevels.map(({ id }) => ({
    id,
    entries: listBridgesPoolEntries(id),
  }));

  test("どのレベルも500問あること", () => {
    const counts = levels.map(({ entries }) => entries.length);

    expect(counts).toEqual([500, 500, 500, 500, 500]);
  });

  test("全問を問題として復元できること", () => {
    const decode = () =>
      levels.flatMap(({ entries }) => entries.map(toBridgesPooledProblem));

    expect(decode).not.toThrow();
  });

  test("問題 ID がレベルをまたいで重複しないこと", () => {
    const ids = levels.flatMap(({ id }) => listBridgesPoolProblemIds(id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("問題集の1問の場合", () => {
    const entry = listBridgesPoolEntries("4")[7]!;
    const identity = toBridgesPoolIdentity(entry);

    test("問題 ID と identity のどちらからも同じ項目を引けること", () => {
      const found = [
        findBridgesPoolEntryByProblemId("4", createProblemId(identity)),
        findBridgesPoolEntry(identity),
      ];

      expect(found).toEqual([entry, entry]);
    });

    test("別のレベルの問題 ID では引けないこと", () => {
      const found = findBridgesPoolEntryByProblemId(
        "3",
        createProblemId(identity),
      );

      expect(found).toBeNull();
    });

    test("seed が同じで生成条件が違う identity では引けないこと", () => {
      const otherSplitRate = identity.conditions.splitRate === 0.2 ? 0.45 : 0.2;
      const found = findBridgesPoolEntry({
        ...identity,
        conditions: { ...identity.conditions, splitRate: otherSplitRate },
      });

      expect(found).toBeNull();
    });
  });
});

describe("findBridgesPoolProblemFeatures", () => {
  const [entry] = listBridgesPoolEntries("3");
  const pooled = toBridgesPooledProblem(entry!);
  const problemId = createProblemId(pooled.identity);

  test("問題集の1問の特徴を、復元した問題の盤面の一辺と島の数で返すこと", () => {
    const features = findBridgesPoolProblemFeatures("3", problemId);

    expect(features).toEqual({
      size: pooled.problem.width,
      islandCount: pooled.problem.islands.length,
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findBridgesPoolProblemFeatures("3", "unknown");
    const otherDifficulty = findBridgesPoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
