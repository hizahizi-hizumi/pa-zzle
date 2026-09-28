import {
  _private,
  type NanpureHumanSolveResult,
  traceNanpureHumanSolve,
} from "@/games/nanpure/problem/generation/human-solver";
import { classifyNanpureSolutions } from "@/games/nanpure/problem/generation/solver";
import {
  listNanpureTechniquesUpTo,
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureCell,
} from "@/games/nanpure/puzzle/board";

const { createState, findByTechnique } = _private;

function boardFromString(value: string): NanpureBoard {
  return [...value].map<NanpureCell>((cell) =>
    cell === "." ? null : (Number(cell) as NanpureCell),
  );
}

function maskOf(digits: readonly number[]): number {
  return digits.reduce((mask, digit) => mask | (1 << digit), 0);
}

const allDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 全マスが空きで、指定したマス以外は1〜9のすべてを候補に持つ局面。手筋の形だけを置いて確かめる。 */
function createCandidateState(
  candidatesByCell: Readonly<Record<number, readonly number[]>>,
) {
  return {
    cells: new Uint8Array(NANPURE_CELL_COUNT),
    candidates: Uint16Array.from(
      { length: NANPURE_CELL_COUNT },
      (_, cellIndex) => maskOf(candidatesByCell[cellIndex] ?? allDigits),
    ),
  };
}

function withoutDigit(
  cellIndices: readonly number[],
  digit: number,
): Record<number, number[]> {
  return Object.fromEntries(
    cellIndices.map((cellIndex) => [
      cellIndex,
      allDigits.filter((candidate) => candidate !== digit),
    ]),
  );
}

function rowCells(row: number): number[] {
  return Array.from({ length: 9 }, (_, column) => row * 9 + column);
}

function columnCells(column: number): number[] {
  return Array.from({ length: 9 }, (_, row) => row * 9 + column);
}

function eliminationKeys(
  finding: ReturnType<typeof findByTechnique>,
): string[] {
  return finding.kind === "eliminations"
    ? finding.eliminations.map(
        ({ cellIndex, digit }) => `${cellIndex}:${digit}`,
      )
    : [];
}

function deepestTechniqueOf(
  result: NanpureHumanSolveResult,
): NanpureTechnique | null {
  const depth = Math.max(
    -1,
    ...result.rounds.map((round) => nanpureTechniques.indexOf(round.technique)),
  );
  return nanpureTechniques[depth] ?? null;
}

// 生成器の問題集合から、各手筋が最も深い手筋になる問題を1問ずつ取った（seed は np-<条件>-<候補番号>）。
const problemsByDeepestTechnique = [
  [
    "hidden-single-block",
    "7....86.1..........12.93......5..738......1...36.........85...497.26.5......47...",
  ],
  [
    "hidden-single-line",
    "7.5.9.6..8....532..2..4.5....43....6.6.....7....9.6...........4.97.82...4..7....5",
  ],
  [
    "naked-single",
    "..7...463.......78..6......9...17........3..5.8.9...2.6.5....4.1...647...34.8....",
  ],
  [
    "locked-candidates",
    "....5...2..87..6...5..4.7...4..6.....158.4.....251.......49...6.7......86......45",
  ],
  [
    "naked-pair",
    "...1....7....6......6.3.8...78.....6..3.....99...2...1.4...8...8.961..25.1.35..7.",
  ],
  [
    "hidden-pair",
    ".5381.................5...837...9.459..3...6..1...5..7..2..3.7.7.9......14.....5.",
  ],
  [
    "naked-triple",
    "...4..567...3..9......67.2.....3..82..5...4...81.7.3......23..51.........9.6..8..",
  ],
  [
    "hidden-triple",
    ".7...2..5.6.917..........3.......9....9.7.8...5...9..4..........9438...7.3.5...46",
  ],
  [
    "x-wing",
    "..1.6..2....25...18....1...5....7.9..74.1....6....8......3..8....6...53..5..9...4",
  ],
  [
    "xy-wing",
    "...2.9...1....4..39.4...5...67..2......5..36....7.......26..8..649......3.....2..",
  ],
  [
    "xyz-wing",
    ".3.7.9....2..6.3...1..4.........4..5....328969..........1........3..1467.76..32.1",
  ],
] as const satisfies readonly (readonly [NanpureTechnique, string])[];

const unsupportedProblem = boardFromString(
  "1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..",
);

describe("traceNanpureHumanSolve", () => {
  describe.each(problemsByDeepestTechnique)(
    "%s が最も深い手筋になる問題",
    (technique, clues) => {
      const board = boardFromString(clues);
      const classification = classifyNanpureSolutions(board);
      const solution =
        classification.status === "unique" ? classification.solution : [];
      const shallowerTechniques = listNanpureTechniquesUpTo(technique).slice(
        0,
        -1,
      );

      test("すべての手筋で一意解まで解き切り、その手筋が最も深いこと", () => {
        const result = traceNanpureHumanSolve(board);

        expect(result.status).toBe("solved");
        expect(result.board).toEqual(solution);
        expect(deepestTechniqueOf(result)).toBe(technique);
      });

      test("その手筋より浅い手筋だけでは進めなくなること", () => {
        const result = traceNanpureHumanSolve(board, {
          techniques: shallowerTechniques,
        });

        expect(result.status).toBe("stalled");
      });

      test("置いた数字は解と一致し、解の数字の候補を消さないこと", () => {
        const { rounds } = traceNanpureHumanSolve(board);

        const wrongPlacements = rounds.flatMap((round) =>
          round.placements.filter(
            ({ cellIndex, digit }) => solution[cellIndex] !== digit,
          ),
        );
        const wrongEliminations = rounds.flatMap((round) =>
          round.eliminations.filter(
            ({ cellIndex, digit }) => solution[cellIndex] === digit,
          ),
        );
        expect(wrongPlacements).toEqual([]);
        expect(wrongEliminations).toEqual([]);
      });
    },
  );

  describe("対応した手筋では解き切れない一意解の問題", () => {
    test("推測せず停止すること", () => {
      const result = traceNanpureHumanSolve(unsupportedProblem);

      expect(result.status).toBe("stalled");
      expect(result.board.some((cell) => cell === null)).toBe(true);
    });
  });

  describe("同じ行に同じ数字がある盤面", () => {
    const board = boardFromString(`11${".".repeat(79)}`);

    test("矛盾として返すこと", () => {
      const result = traceNanpureHumanSolve(board);

      expect(result.status).toBe("contradiction");
    });
  });

  describe("同じ盤面を2回解く", () => {
    const board = boardFromString(problemsByDeepestTechnique[4][1]);
    const before = [...board];

    test("同じ経過を再現し、元の盤面を変更しないこと", () => {
      const first = traceNanpureHumanSolve(board);
      const second = traceNanpureHumanSolve(board);

      expect(second).toEqual(first);
      expect(board).toEqual(before);
    });
  });

  describe("候補を消す手筋が要る問題", () => {
    const board = boardFromString(problemsByDeepestTechnique[3][1]);

    test("候補を消すラウンドは置ける数字が無い局面で使い、数字を置かないこと", () => {
      const { rounds } = traceNanpureHumanSolve(board);

      const eliminationRounds = rounds.filter(
        (round) => round.eliminations.length > 0,
      );
      expect(eliminationRounds.length).toBeGreaterThan(0);
      expect(
        eliminationRounds.filter(
          (round) =>
            round.placements.length > 0 || round.availablePlacementCount > 0,
        ),
      ).toEqual([]);
    });

    test("数字を置くラウンドでは、置ける数字の数が置いた数字の数以上であること", () => {
      const { rounds } = traceNanpureHumanSolve(board);

      const placementRounds = rounds.filter(
        (round) => round.placements.length > 0,
      );
      expect(
        placementRounds.filter(
          (round) => round.availablePlacementCount < round.placements.length,
        ),
      ).toEqual([]);
    });
  });
});

function boardWith(digitsByCell: Readonly<Record<number, number>>) {
  return Array.from(
    { length: NANPURE_CELL_COUNT },
    (_, cellIndex) => (digitsByCell[cellIndex] ?? null) as NanpureCell,
  );
}

describe("findByTechnique", () => {
  describe("数字を置く手筋", () => {
    // 行0・行1・列1・列2 に 1 があるので、ブロック0 で 1 が入るのは r2c0 だけ。
    const hiddenSingleBoard = boardWith({ 3: 1, 15: 1, 37: 1, 56: 1 });
    // r0c0 から見えるマスに 2〜9 があるので、r0c0 に入るのは 1 だけ。
    const nakedSingleBoard = boardWith({
      1: 2,
      2: 3,
      3: 4,
      4: 5,
      45: 6,
      54: 7,
      63: 8,
      72: 9,
    });
    const cases = [
      [
        "残り1マスの行へ足りない数字を置くこと",
        boardWith({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 }),
        "full-house",
        [{ cellIndex: 8, digit: 9 }],
      ],
      [
        "ブロックの中で置き場所が1つしかない数字を置くこと",
        hiddenSingleBoard,
        "hidden-single-block",
        [{ cellIndex: 18, digit: 1 }],
      ],
      [
        "ブロックの中で決まる数字を、マスの候補からは置かないこと",
        hiddenSingleBoard,
        "naked-single",
        [],
      ],
      [
        "候補が1つしかないマスへ数字を置くこと",
        nakedSingleBoard,
        "naked-single",
        [{ cellIndex: 0, digit: 1 }],
      ],
    ] as const;

    test.each(cases)("%s", (_, board, technique, expected) => {
      const state = createState(board)!;

      const finding = findByTechnique(state, technique);

      expect(finding).toEqual({ kind: "placements", placements: expected });
    });
  });

  describe("候補を消す手筋", () => {
    const hiddenPairOthers = rowCells(4).filter(
      (cellIndex) => cellIndex !== 36 && cellIndex !== 40,
    );
    const swordfishBases = [
      [0, [1, 4]],
      [3, [4, 8]],
      [7, [1, 8]],
    ] as const;
    const swordfishBaseCells = new Set(
      swordfishBases.flatMap(([row]) => rowCells(row)),
    );
    const cases = [
      [
        "ブロックの中で1本の行に並ぶ候補を、その行の他のブロックから消すこと",
        withoutDigit([9, 10, 11, 18, 19, 20], 7),
        "locked-candidates",
        [3, 4, 5, 6, 7, 8].map((cellIndex) => `${cellIndex}:7`),
      ],
      [
        "2マスの候補が同じ2数字なら、同じブロックの他のマスからその数字を消すこと",
        { 0: [1, 2], 1: [1, 2] },
        "naked-pair",
        [2, 9, 10, 11, 18, 19, 20].flatMap((cellIndex) => [
          `${cellIndex}:1`,
          `${cellIndex}:2`,
        ]),
      ],
      [
        "3マスの候補が合わせて3数字なら、同じブロックの他のマスからその数字を消すこと",
        { 0: [1, 2], 1: [2, 3], 2: [1, 3] },
        "naked-triple",
        [9, 10, 11, 18, 19, 20].flatMap((cellIndex) => [
          `${cellIndex}:1`,
          `${cellIndex}:2`,
          `${cellIndex}:3`,
        ]),
      ],
      [
        "候補が合わせて3数字の3マスを、2マスの組とは読まないこと",
        { 0: [1, 2], 1: [2, 3], 2: [1, 3] },
        "naked-pair",
        [],
      ],
      [
        "行の中で2数字の置き場所が同じ2マスなら、そのマスから他の候補を消すこと",
        Object.fromEntries(
          hiddenPairOthers.map((cellIndex) => [
            cellIndex,
            [1, 2, 3, 4, 5, 6, 7],
          ]),
        ),
        "hidden-pair",
        [36, 40].flatMap((cellIndex) =>
          [1, 2, 3, 4, 5, 6, 7].map((digit) => `${cellIndex}:${digit}`),
        ),
      ],
      [
        "2本の行で同じ2本の列に収まる数字を、その列の他の行から消すこと",
        {
          ...withoutDigit(
            rowCells(1).filter(
              (cellIndex) => cellIndex !== 11 && cellIndex !== 16,
            ),
            5,
          ),
          ...withoutDigit(
            rowCells(6).filter(
              (cellIndex) => cellIndex !== 56 && cellIndex !== 61,
            ),
            5,
          ),
        },
        "x-wing",
        [...columnCells(2), ...columnCells(7)]
          .filter((cellIndex) => ![11, 16, 56, 61].includes(cellIndex))
          .sort((left, right) => left - right)
          .map((cellIndex) => `${cellIndex}:5`),
      ],
      [
        "3本の行で同じ3本の列に収まる数字を、その列の他の行から消すこと",
        Object.assign(
          {},
          ...swordfishBases.map(([row, columns]) =>
            withoutDigit(
              rowCells(row).filter(
                (cellIndex) =>
                  !(columns as readonly number[]).includes(cellIndex % 9),
              ),
              4,
            ),
          ),
        ),
        "swordfish",
        [...columnCells(1), ...columnCells(4), ...columnCells(8)]
          .filter((cellIndex) => !swordfishBaseCells.has(cellIndex))
          .sort((left, right) => left - right)
          .map((cellIndex) => `${cellIndex}:4`),
      ],
      [
        "{x,y} の軸と {x,z}・{y,z} の2マスから、両方が見えるマスの z を消すこと",
        { 0: [1, 2], 4: [1, 3], 27: [2, 3] },
        "xy-wing",
        ["31:3"],
      ],
      [
        "{x,y,z} の軸と {x,z}・{y,z} の2マスから、3マスすべてが見えるマスの z を消すこと",
        { 0: [1, 2, 3], 1: [1, 3], 9: [2, 3] },
        "xyz-wing",
        [2, 10, 11, 18, 19, 20].map((cellIndex) => `${cellIndex}:3`),
      ],
      [
        "{x,y,z} の軸を {x,y} の軸と読まないこと",
        { 0: [1, 2, 3], 1: [1, 3], 9: [2, 3] },
        "xy-wing",
        [],
      ],
    ] as const satisfies readonly (readonly [
      string,
      Readonly<Record<number, readonly number[]>>,
      NanpureTechnique,
      readonly string[],
    ])[];

    test.each(cases)("%s", (_, candidatesByCell, technique, expected) => {
      const state = createCandidateState(candidatesByCell);

      const finding = findByTechnique(state, technique);

      expect(eliminationKeys(finding)).toEqual(expected);
    });
  });
});
