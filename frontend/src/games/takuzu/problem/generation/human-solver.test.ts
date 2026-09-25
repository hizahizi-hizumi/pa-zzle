import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import {
  _private,
  traceTakuzuHumanSolve,
} from "@/games/takuzu/problem/generation/human-solver";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  type TakuzuTechnique,
  takuzuTechniques,
} from "@/games/takuzu/problem/technique";
import {
  parseTakuzuBoard,
  type TakuzuBoard,
} from "@/games/takuzu/puzzle/board";

const { createSolveState, findTechnique } = _private;

type TechniqueFindings = ReturnType<(typeof findTechnique)["adjacency"]>;

function listFoundTiles(findings: TechniqueFindings): [number, string][] {
  return findings.status === "found"
    ? [...findings.tileByCellIndex].sort(([left], [right]) => left - right)
    : [];
}

/** 初期配置から解いた経過を再生し、各ラウンドの直前の局面で、そのラウンドより浅い手筋が確定を見つけたものを返す。 */
function listShallowerFindings(
  givens: TakuzuBoard,
  rounds: ReturnType<typeof traceTakuzuHumanSolve>["rounds"],
): string[] {
  const cells = [...givens.cells];
  return rounds.flatMap(function checkRound(round, roundIndex) {
    const state = createSolveState({ size: givens.size, cells: [...cells] });
    const shallowerTechniques = takuzuTechniques.slice(
      0,
      takuzuTechniques.indexOf(round.technique),
    );
    for (const { cellIndex, tile } of round.deductions) {
      cells[cellIndex] = tile;
    }
    return shallowerTechniques
      .filter(
        (technique) =>
          listFoundTiles(findTechnique[technique](state)).length > 0,
      )
      .map((technique) => `${roundIndex}: ${technique}`);
  });
}

describe("findTechnique.adjacency", () => {
  const cases = [
    ["並んだ2つの隣", ["AA..", "....", "....", "...."], [[2, "b"]]],
    ["挟まれた1つ", ["B.B.", "....", "....", "...."], [[1, "a"]]],
    ["列の中で並んだ2つの隣", ["A...", "A...", "....", "...."], [[8, "b"]]],
  ] as const;

  test.each(cases)("%s に反対のタイルを求めること", (_, rows, expected) => {
    const result = findTechnique.adjacency(
      createSolveState(parseTakuzuBoard(rows)),
    );

    expect(listFoundTiles(result)).toEqual(expected);
  });
});

describe('findTechnique["count-completion"]', () => {
  const state = createSolveState(
    parseTakuzuBoard(["A..A", "....", "....", "...."]),
  );

  test("片方のタイルが半分そろった行の空きマスに反対のタイルを求めること", () => {
    const result = findTechnique["count-completion"](state);

    expect(listFoundTiles(result)).toEqual([
      [1, "b"],
      [2, "b"],
    ]);
  });
});

/** 1行目が完成済みで、4行目の置き方の片方が1行目と同じ並びになる盤面。 */
const rowsWithCompletedDuplicate = [
  "AABABB",
  "......",
  "......",
  "A.BA.B",
  "......",
  "......",
];

describe('findTechnique["single-remaining"]', () => {
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
      const result = findTechnique["single-remaining"](state);

      expect(listFoundTiles(result)).toEqual([[5, "b"]]);
    });
  });

  describe("完成済みの行と同じ並びになる置き方がある行", () => {
    const state = createSolveState(
      parseTakuzuBoard(rowsWithCompletedDuplicate),
    );

    test("重複を除かなければ何も確定しないこと", () => {
      const result = findTechnique["single-remaining"](state);

      expect(listFoundTiles(result)).toEqual([]);
    });
  });
});

describe('findTechnique["duplicate-avoidance"]', () => {
  describe("完成済みの行と同じ並びになる置き方がある行", () => {
    const state = createSolveState(
      parseTakuzuBoard(rowsWithCompletedDuplicate),
    );

    test("完成済みの行と同じ並びを除いて確定すること", () => {
      const result = findTechnique["duplicate-avoidance"](state);

      expect(listFoundTiles(result)).toEqual([
        [19, "b"],
        [22, "a"],
      ]);
    });

    test("確定を与えた1本の行を数え、重複の除外が要ったと記録すること", () => {
      const result = findTechnique["duplicate-avoidance"](state);

      expect(result).toMatchObject({
        sourceCount: 1,
        requiresDuplicateAvoidance: true,
      });
    });
  });
});

describe('findTechnique["general-line"]', () => {
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
      const result = findTechnique["general-line"](state);

      expect(listFoundTiles(result)).toEqual([[7, "b"]]);
    });
  });
});

describe("traceTakuzuHumanSolve", () => {
  describe("手筋で解き切れる問題", () => {
    test("解と同じ盤面まで埋めること", () => {
      const result = traceTakuzuHumanSolve(takuzuFixedProblem.givens);

      expect(result.status).toBe("solved");
      expect(result.board).toEqual(takuzuFixedProblem.solution);
    });
  });

  describe("A〜E のすべての手筋が要る問題", () => {
    // seed tk-general-line-0-1 で生成した問題の初期配置。
    const givens = parseTakuzuBoard([
      ".....AB.",
      ".A.B..A.",
      "A.......",
      "A....A.A",
      ".B.A....",
      "B.......",
      "........",
      ".A.....A",
    ]);

    test("すべての手筋を使って解き切ること", () => {
      const result = traceTakuzuHumanSolve(givens);

      expect(result.status).toBe("solved");
      expect(new Set(result.rounds.map((round) => round.technique))).toEqual(
        new Set(takuzuTechniques),
      );
    });

    test("各ラウンドの直前の局面では、それより浅い手筋で確定できるマスが無いこと", () => {
      const result = traceTakuzuHumanSolve(givens);

      expect(listShallowerFindings(givens, result.rounds)).toEqual([]);
    });
  });

  describe("使える手筋を減らした解法", () => {
    const techniques: readonly TakuzuTechnique[] = ["adjacency"];

    test("許した手筋で確定できなくなった所で止まること", () => {
      const result = traceTakuzuHumanSolve(takuzuFixedProblem.givens, {
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
    const cases = takuzuTechniques.map(
      (technique) =>
        [
          technique,
          generateTakuzuProblem(createTakuzuProblemIdentity(technique, 0, 0))
            .problem,
        ] as const,
    );

    test.each(cases)(
      "上限 %s で作った問題で、どのラウンドの確定も解と一致すること",
      (_, problem) => {
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
