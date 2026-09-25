import {
  _private,
  type TakuzuTechnique,
  takuzuTechniques,
  traceTakuzuHumanSolve,
} from "@/games/takuzu/problem/generation/human-solver";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  listTakuzuPoolEntries,
  toTakuzuPooledProblem,
} from "@/games/takuzu/problem/problem-pool";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

const {
  createSolveState,
  findAdjacency,
  findCountCompletion,
  findLineReading,
} = _private;

function listFoundTiles(
  findings: ReturnType<typeof findAdjacency>,
): [number, string][] {
  return findings.status === "found"
    ? [...findings.tileByCellIndex].sort(([left], [right]) => left - right)
    : [];
}

describe("findAdjacency", () => {
  const cases = [
    ["並んだ2つの隣", ["AA..", "....", "....", "...."], [[2, "b"]]],
    ["挟まれた1つ", ["B.B.", "....", "....", "...."], [[1, "a"]]],
    ["列の中で並んだ2つの隣", ["A...", "A...", "....", "...."], [[8, "b"]]],
  ] as const;

  test.each(cases)("%s に反対のタイルを求めること", (_, rows, expected) => {
    const result = findAdjacency(createSolveState(parseTakuzuBoard(rows)));

    expect(listFoundTiles(result)).toEqual(expected);
  });
});

describe("findCountCompletion", () => {
  const state = createSolveState(
    parseTakuzuBoard(["A..A", "....", "....", "...."]),
  );

  test("片方のタイルが半分そろった行の空きマスに反対のタイルを求めること", () => {
    const result = findCountCompletion(state);

    expect(listFoundTiles(result)).toEqual([
      [1, "b"],
      [2, "b"],
    ]);
  });
});

describe("findLineReading", () => {
  describe("片方のタイルが残り1個の行", () => {
    const state = createSolveState(
      parseTakuzuBoard([
        "AAB...",
        "......",
        "......",
        "......",
        "......",
        "......",
      ]),
    );

    test("残り1個をどこに置いても同じになるマスを求めること", () => {
      const result = findLineReading(state, "single-remaining", false);

      expect(listFoundTiles(result)).toEqual([[5, "b"]]);
    });
  });

  describe("完成済みの行と同じ並びになる置き方がある行", () => {
    const state = createSolveState(
      parseTakuzuBoard([
        "AABABB",
        "......",
        "......",
        "A.BA.B",
        "......",
        "......",
      ]),
    );
    const targetCells = [
      [19, "b"],
      [22, "a"],
    ];

    test("重複を除かなければ確定しないこと", () => {
      const result = findLineReading(state, "single-remaining", false);

      expect(listFoundTiles(result)).not.toEqual(
        expect.arrayContaining(targetCells),
      );
    });

    test("完成済みの行と同じ並びを除いて確定すること", () => {
      const result = findLineReading(state, "single-remaining", true);

      expect(listFoundTiles(result)).toEqual(
        expect.arrayContaining(targetCells),
      );
    });
  });

  describe("両方のタイルが残り2個以上の行", () => {
    const state = createSolveState(
      parseTakuzuBoard([
        "A..B..A.",
        "........",
        "........",
        "........",
        "........",
        "........",
        "........",
        "........",
      ]),
    );

    test("ルールを満たす並びすべてで同じになるマスを求めること", () => {
      const result = findLineReading(state, "general", true);

      expect(listFoundTiles(result)).toEqual([[7, "b"]]);
    });
  });
});

describe("traceTakuzuHumanSolve", () => {
  // 難易度2 の問題は、個数の完成（B）が要り、隣接・挟み（A）だけでは解き切れない。
  const { problem } = toTakuzuPooledProblem(listTakuzuPoolEntries("2")[0]!);

  describe("手筋で解き切れる問題", () => {
    test("解と同じ盤面まで埋めること", () => {
      const result = traceTakuzuHumanSolve(problem.givens);

      expect(result.status).toBe("solved");
      expect(result.board).toEqual(problem.solution);
    });

    test("各ラウンドで、その局面で確定できる最も浅い手筋を使うこと", () => {
      const result = traceTakuzuHumanSolve(problem.givens);

      expect(result.rounds[0]?.technique).toBe("adjacency");
    });
  });

  describe("使える手筋を減らした解法", () => {
    const techniques: readonly TakuzuTechnique[] = ["adjacency"];

    test("許した手筋で確定できなくなった所で止まること", () => {
      const result = traceTakuzuHumanSolve(problem.givens, {
        techniques,
      });

      expect(result.status).toBe("stalled");
      expect(
        result.rounds.every((round) => round.technique === "adjacency"),
      ).toBe(true);
    });
  });

  describe("解が無い初期配置", () => {
    const givens = parseTakuzuBoard(["AA.A", "....", "....", "...."]);

    test("矛盾を報告すること", () => {
      const result = traceTakuzuHumanSolve(givens);

      expect(result.status).toBe("contradiction");
    });
  });

  describe("手筋の上限を変えて作った問題", () => {
    const problems = takuzuTechniques.map(
      (technique) =>
        generateTakuzuProblem(createTakuzuProblemIdentity(technique, 0, 0))
          .problem,
    );

    test.each(problems)(
      "どのラウンドの確定も解と一致すること: %#",
      (problem) => {
        const result = traceTakuzuHumanSolve(problem.givens);

        const deductions = result.rounds.flatMap((round) => round.deductions);
        expect(
          deductions.every(
            ({ cellIndex, tile }) => problem.solution.cells[cellIndex] === tile,
          ),
        ).toBe(true);
        expect(result.status).toBe("solved");
      },
    );
  });
});
