import { difficultyLevels } from "@/games/difficulty";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { createHamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import {
  decodeHamiltonianPathPoolProblem,
  encodeHamiltonianPathPoolObstacles,
  findHamiltonianPathPoolEntry,
  findHamiltonianPathPoolEntryByProblemId,
  listHamiltonianPathPoolEntries,
  toHamiltonianPathPooledProblem,
  toHamiltonianPathPoolIdentity,
} from "@/games/hamiltonian-path/problem/problem-pool";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { createProblemId } from "@/games/problem-id";

describe("encodeHamiltonianPathPoolObstacles", () => {
  // 壁マス9・左右の仕切り6・上下の仕切り6 の21ビットのうち、右下の壁（8番）・左上の左右の仕切り（9番）・
  // 右上の上下の仕切り（17番）が立つ。
  const board = parseHamiltonianPathBoard([
    "S|. .",
    "    -",
    ". . .",
    "",
    ". . #",
  ]);

  test("壁マス・左右の仕切り・上下の仕切りの順のビット列を16進で表すこと", () => {
    const encoded = encodeHamiltonianPathPoolObstacles(board);

    expect(encoded).toBe("00c040");
  });
});

describe("decodeHamiltonianPathPoolProblem", () => {
  describe("encodeHamiltonianPathPoolObstacles で表した問題", () => {
    const { problem } = generateHamiltonianPathProblem(
      createHamiltonianPathProblemIdentity(8, 0.15, 0),
    );
    const encoded = encodeHamiltonianPathPoolObstacles(problem);

    test("元の問題へ戻すこと", () => {
      const decoded = decodeHamiltonianPathPoolProblem(
        problem.size,
        problem.start,
        encoded,
      );

      expect(decoded).toEqual(problem);
    });
  });

  const invalidCases = [
    ["扱わない盤面サイズ", 4, 0, "0".repeat(12)],
    ["盤面サイズと合わない桁数", 5, 0, "0".repeat(16)],
    ["16進でない文字", 5, 0, `${"0".repeat(16)}g`],
    ["末尾の埋め草に立ったビット", 5, 0, `${"0".repeat(16)}7`],
    ["壁マスの始点", 5, 0, `8${"0".repeat(16)}`],
  ] as const;

  test.each(invalidCases)(
    "%sを拒否すること",
    (_, size, start, encodedObstacles) => {
      const act = () =>
        decodeHamiltonianPathPoolProblem(size, start, encodedObstacles);

      expect(act).toThrow();
    },
  );
});

describe("toHamiltonianPathPoolIdentity", () => {
  test("盤面サイズ・壁率の百分率・候補番号から identity を作ること", () => {
    const identity = toHamiltonianPathPoolIdentity([
      7,
      15,
      219,
      0,
      "0".repeat(34),
      1,
      6,
      6,
      7,
    ]);

    expect(identity).toEqual(
      createHamiltonianPathProblemIdentity(7, 0.15, 219),
    );
  });
});

describe("toHamiltonianPathPooledProblem", () => {
  const { problem, identity } = generateHamiltonianPathProblem(
    createHamiltonianPathProblemIdentity(6, 0.15, 4),
  );
  const openCellCount = problem.size ** 2 - problem.walls.length;

  test("問題集の作業の量と、盤面から数えたなぞる長さを伴うこと", () => {
    const pooled = toHamiltonianPathPooledProblem([
      6,
      15,
      4,
      problem.start,
      encodeHamiltonianPathPoolObstacles(problem),
      2,
      13,
      7,
      9,
    ]);

    expect(pooled).toEqual({
      problem,
      identity,
      workload: {
        openCellCount,
        assumptionCount: 2,
        refutationStepCount: 13,
        longestRefutationLength: 7,
        fatalBranchCount: 9,
      },
    });
  });
});

describe("findHamiltonianPathPoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listHamiltonianPathPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toHamiltonianPathPoolIdentity(entry)),
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
      ({ difficulty, entry, problemId }) =>
        findHamiltonianPathPoolEntryByProblemId(difficulty, problemId) !==
        entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  describe("別の難易度の問題ID", () => {
    const [entry] = listHamiltonianPathPoolEntries("1");
    const problemId = createProblemId(toHamiltonianPathPoolIdentity(entry!));

    test("null を返すこと", () => {
      const found = findHamiltonianPathPoolEntryByProblemId("2", problemId);

      expect(found).toBeNull();
    });
  });
});

describe("findHamiltonianPathPoolEntry", () => {
  const entry = listHamiltonianPathPoolEntries("3")[0]!;
  const identity = toHamiltonianPathPoolIdentity(entry);
  const otherWallRatio = identity.conditions.wallRatio === 0 ? 0.15 : 0;

  test("問題集の identity から項目を引くこと", () => {
    const found = findHamiltonianPathPoolEntry(structuredClone(identity));

    expect(found).toBe(entry);
  });

  const unknownIdentities = [
    ["seed が問題集に無い", { ...identity, seed: "hp-8-0-999999" }],
    [
      "生成条件が seed と食い違う",
      {
        ...identity,
        conditions: { ...identity.conditions, wallRatio: otherWallRatio },
      },
    ],
  ] as const;

  test.each(unknownIdentities)(
    "%s identity には null を返すこと",
    (_, unknown) => {
      const found = findHamiltonianPathPoolEntry(unknown);

      expect(found).toBeNull();
    },
  );
});
