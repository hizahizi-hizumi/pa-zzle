import { difficultyLevels } from "@/games/difficulty";
import { createHamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import {
  decodeHamiltonianPathPoolProblem,
  encodeHamiltonianPathPoolHoles,
  findHamiltonianPathPoolEntry,
  findHamiltonianPathPoolEntryByProblemId,
  listHamiltonianPathPoolEntries,
  toHamiltonianPathPooledProblem,
  toHamiltonianPathPoolIdentity,
} from "@/games/hamiltonian-path/problem/problem-pool";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { createProblemId } from "@/games/problem-id";

describe("encodeHamiltonianPathPoolHoles", () => {
  // 9マスのビット列のうち、上の中央（1番）と右下（8番）が立つ。
  const board = parseHamiltonianPathBoard(["S # .", ". . .", ". . #"]);

  test("枠の全マスの順のビット列を16進で表すこと", () => {
    const encoded = encodeHamiltonianPathPoolHoles(board);

    expect(encoded).toBe("408");
  });
});

describe("decodeHamiltonianPathPoolProblem", () => {
  describe("encodeHamiltonianPathPoolHoles で表した問題", () => {
    const problem = parseHamiltonianPathBoard([
      "# . . . . . . #",
      ". . . # . . . .",
      ". . . . . . . .",
      ". # . . . S . .",
      ". . . . . . # .",
      ". . . . . . . .",
      "# . . . # . . .",
      ". . . . . . . .",
    ]);
    const encoded = encodeHamiltonianPathPoolHoles(problem);

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
    ["扱わない盤面サイズ", 4, 0, "0".repeat(4)],
    ["盤面サイズと合わない桁数", 5, 0, "0".repeat(8)],
    ["16進でない文字", 5, 0, `${"0".repeat(6)}g`],
    ["末尾の埋め草に立ったビット", 5, 0, `${"0".repeat(6)}7`],
    ["穴の始点", 5, 0, `8${"0".repeat(6)}`],
    ["穴で切り離された", 5, 0, `44${"0".repeat(5)}`],
  ] as const;

  test.each(invalidCases)(
    "%sを拒否すること",
    (_, size, start, encodedHoles) => {
      const act = () =>
        decodeHamiltonianPathPoolProblem(size, start, encodedHoles);

      expect(act).toThrow();
    },
  );
});

describe("toHamiltonianPathPoolIdentity", () => {
  test("盤面サイズ・仮置きの回数の目標・候補番号から identity を作ること", () => {
    const identity = toHamiltonianPathPoolIdentity([
      7,
      4,
      219,
      0,
      "0".repeat(13),
      4,
      26,
      9,
      7,
    ]);

    expect(identity).toEqual(createHamiltonianPathProblemIdentity(7, 4, 219));
  });
});

describe("toHamiltonianPathPooledProblem", () => {
  const problem = parseHamiltonianPathBoard([
    ". . # . . .",
    ". . . . . .",
    "# . . S . .",
    ". . . . . #",
    ". . . . . .",
    ". # . . . .",
  ]);
  const identity = createHamiltonianPathProblemIdentity(6, 0, 4);

  test("問題集の作業の量と、盤面から数えたなぞる長さを伴うこと", () => {
    const pooled = toHamiltonianPathPooledProblem([
      6,
      0,
      4,
      problem.start,
      encodeHamiltonianPathPoolHoles(problem),
      2,
      13,
      7,
      9,
    ]);

    expect(pooled).toEqual({
      problem,
      identity,
      workload: {
        openCellCount: 32,
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
  const otherTarget = identity.conditions.targetAssumptionCount === 0 ? 4 : 0;

  test("問題集の identity から項目を引くこと", () => {
    const found = findHamiltonianPathPoolEntry(structuredClone(identity));

    expect(found).toBe(entry);
  });

  const unknownIdentities = [
    ["seed が問題集に無い", { ...identity, seed: "hp-8-t7-999999" }],
    [
      "生成条件が seed と食い違う",
      {
        ...identity,
        conditions: {
          ...identity.conditions,
          targetAssumptionCount: otherTarget,
        },
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
