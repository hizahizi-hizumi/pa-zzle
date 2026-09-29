import { toReflectionCellCode } from "@/games/reflection/problem/generation/cell-code";
import {
  type ReflectionHumanSolveInput,
  type ReflectionHumanSolveTrace,
  traceReflectionHumanSolve,
} from "@/games/reflection/problem/generation/human-solver";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  createReflectionProblemIdentity,
  type ReflectionBoardSize,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  createEmptyReflectionInventory,
  parseReflectionBoard,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

function toInput(board: ReflectionBoard): ReflectionHumanSolveInput {
  return {
    size: board.size,
    inventory: countReflectionBoardPieces(board),
    clues: computeReflectionClues(board),
  };
}

function includesSolution(
  domains: Readonly<Uint8Array>,
  solution: ReflectionBoard,
): boolean {
  return solution.cells.every(
    (cell, cellIndex) =>
      ((domains[cellIndex] ?? 0) & (1 << toReflectionCellCode(cell))) !== 0,
  );
}

/** 解の手持ちのピースが置かれたマスについて、候補がそのピースだけになっているか。 */
function pinsSolutionPieces(
  domains: Readonly<Uint8Array>,
  solution: ReflectionBoard,
): boolean {
  return solution.cells.every(
    (cell, cellIndex) =>
      cell === null || domains[cellIndex] === 1 << toReflectionCellCode(cell),
  );
}

type TraceObservation = {
  trace: ReflectionHumanSolveTrace;
  observedDomains: Readonly<Uint8Array>[];
};

function traceWithObservation(
  input: ReflectionHumanSolveInput,
): TraceObservation {
  const observedDomains: Readonly<Uint8Array>[] = [];
  const trace = traceReflectionHumanSolve(input, {
    observeDomains(domains) {
      observedDomains.push(domains);
    },
  });
  return { trace, observedDomains };
}

describe("traceReflectionHumanSolve", () => {
  describe("推論レベルごとの代表問題", () => {
    // 難易度文書の代表問題（生成器の版 2 の seed）。
    const cases: readonly [
      string,
      ReflectionBoard,
      Omit<ReflectionHumanSolveTrace, "status" | "unresolvedCellCount">,
    ][] = [
      [
        "1本のヒントだけで2個とも決まる問題（rf-5-2-33）",
        parseReflectionBoard([".....", ".....", ".@...", ".....", "...@."]),
        {
          highestLevel: 1,
          fixedPieceCountByLevel: [2, 0, 0, 0, 0],
          propagationRoundCount: 0,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      ],
      [
        "他のヒントと照らして残り1個が決まる問題（rf-5-3-45）",
        parseReflectionBoard([".....", ".....", "o...o", "=....", "....."]),
        {
          highestLevel: 2,
          fixedPieceCountByLevel: [2, 1, 0, 0, 0],
          propagationRoundCount: 1,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      ],
      [
        "照らし合わせを繰り返して連鎖的に決まる問題（rf-5-3-0）",
        parseReflectionBoard([".....", "...\\.", ".....", "/.|..", "....."]),
        {
          highestLevel: 3,
          fixedPieceCountByLevel: [0, 0, 3, 0, 0],
          propagationRoundCount: 6,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      ],
      [
        "手持ちの残り数を使って決まる問題（rf-5-5-16）",
        parseReflectionBoard(["..oo.", ".....", ".....", "...|.", "..o=."]),
        {
          highestLevel: 4,
          fixedPieceCountByLevel: [0, 4, 0, 1, 0],
          propagationRoundCount: 2,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      ],
      [
        "残り1個では届かない光路を除いて決まる問題（rf-5-2-87）",
        parseReflectionBoard([".....", "...\\\\", ".....", ".....", "....."]),
        {
          highestLevel: 4,
          fixedPieceCountByLevel: [1, 0, 0, 1, 0],
          propagationRoundCount: 4,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      ],
      [
        "仮に置いた先の矛盾で候補を除いて決まる問題（rf-5-7-36）",
        parseReflectionBoard(["/\\|..", "/....", ".=...", "/|...", "....."]),
        {
          highestLevel: 5,
          fixedPieceCountByLevel: [1, 0, 0, 0, 6],
          propagationRoundCount: 9,
          assumptionTestCount: 1,
          assumptionEliminationCount: 1,
        },
      ],
    ];

    test.each(cases)(
      "%s で、そのレベルまでの推論で置き場所を決め切ること",
      (_, board, expected) => {
        const result = traceReflectionHumanSolve(toInput(board));

        expect(result).toEqual({
          status: "solved",
          unresolvedCellCount: 0,
          ...expected,
        });
      },
    );

    test.each(cases)(
      "%s で、最後に絞った候補が解のピースの置き場所だけを指すこと",
      (_, board) => {
        const { observedDomains } = traceWithObservation(toInput(board));

        expect(pinsSolutionPieces(observedDomains.at(-1)!, board)).toBe(true);
      },
    );
  });

  describe("生成した問題", () => {
    const conditions: readonly [ReflectionBoardSize, number][] = [
      [5, 2],
      [5, 3],
      [5, 4],
      [5, 6],
      [5, 8],
      [6, 5],
      [6, 8],
      [7, 10],
    ];
    const problems = conditions.flatMap(([size, pieceCount]) =>
      Array.from(
        { length: 4 },
        (_, index) =>
          generateReflectionProblem(
            createReflectionProblemIdentity(size, pieceCount, index),
          ).problem,
      ),
    );
    const cases = problems.map(
      (problem, index) =>
        [
          `${conditions[Math.floor(index / 4)]!.join("-")}-${index % 4}`,
          problem,
        ] as const,
    );

    test.each(cases)(
      "rf-%s で、候補を絞る途中で既知の一意解を落とさないこと",
      (_, problem) => {
        const { observedDomains } = traceWithObservation(problem);

        expect(observedDomains.length).toBeGreaterThan(0);
        expect(
          observedDomains.every((domains) =>
            includesSolution(domains, problem.solution),
          ),
        ).toBe(true);
      },
    );

    const repeatedProblem = problems.at(-1)!;

    test("同じ入力には同じ結果を返すこと", () => {
      const first = traceReflectionHumanSolve(repeatedProblem);
      const second = traceReflectionHumanSolve(
        structuredClone(repeatedProblem),
      );

      expect(second).toEqual(first);
    });
  });

  describe("外周ヒントと手持ちに合う配置が無い入力", () => {
    const input: ReflectionHumanSolveInput = {
      ...toInput(
        parseReflectionBoard([".....", ".....", ".....", ".....", "....."]),
      ),
      inventory: { ...createEmptyReflectionInventory(), "black-hole": 1 },
    };

    test("矛盾とすること", () => {
      const result = traceReflectionHumanSolve(input);

      expect(result).toMatchObject({
        status: "contradiction",
        highestLevel: null,
      });
    });
  });
});
