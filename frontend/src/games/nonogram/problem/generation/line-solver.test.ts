import {
  type NonogramSolveCell,
  nonogramSolveCell,
  solveNonogramLineByEdges,
  solveNonogramLineFully,
} from "@/games/nonogram/problem/generation/line-solver";
import { computeNonogramLineClue } from "@/games/nonogram/puzzle/clue";
import { createProblemSeededRandom } from "@/games/problem-seed";

const cellByNotation = {
  ".": nonogramSolveCell.unknown,
  x: nonogramSolveCell.white,
  "#": nonogramSolveCell.black,
} as const;

/** `.` が未確定、`x` が白、`#` が黒。 */
function parseLine(notation: string): NonogramSolveCell[] {
  return Array.from(
    notation,
    (symbol) => cellByNotation[symbol as keyof typeof cellByNotation],
  );
}

function formatLine(line: readonly NonogramSolveCell[] | null): string | null {
  if (line === null) {
    return null;
  }
  return line
    .map((cell) =>
      cell === nonogramSolveCell.black
        ? "#"
        : cell === nonogramSolveCell.white
          ? "x"
          : ".",
    )
    .join("");
}

/** 線のマスの黒白をすべて並べ、今のマスとヒントに合う並びの共通部分を求める。 */
function solveLineByEnumeration(
  clue: readonly number[],
  line: readonly NonogramSolveCell[],
): NonogramSolveCell[] | null {
  let common: NonogramSolveCell[] | null = null;
  for (let bits = 0; bits < 1 << line.length; bits += 1) {
    const black = line.map((_, cellIndex) => ((bits >> cellIndex) & 1) === 1);
    const agrees = line.every(
      (cell, cellIndex) =>
        cell === nonogramSolveCell.unknown ||
        (cell === nonogramSolveCell.black) === black[cellIndex],
    );
    const clueOfBits = computeNonogramLineClue(black);
    if (
      !agrees ||
      clueOfBits.length !== clue.length ||
      clueOfBits.some((length, block) => length !== clue[block])
    ) {
      continue;
    }
    const cells = black.map((isBlack) =>
      isBlack ? nonogramSolveCell.black : nonogramSolveCell.white,
    );
    common =
      common === null
        ? cells
        : common.map((cell, cellIndex) =>
            cell === cells[cellIndex] ? cell : nonogramSolveCell.unknown,
          );
  }
  return common;
}

/**
 * 解の並びから一部のマスを見せた線を作る。2割の線では1マスを解と逆にして、ヒントに合わない線も混ぜる。
 */
function createRandomLines(count: number) {
  const random = createProblemSeededRandom("nonogram-line-solver");
  return Array.from({ length: count }, function createLine() {
    const length = 1 + Math.floor(random() * 12);
    const solution = Array.from({ length }, () => random() < 0.55);
    const clue = computeNonogramLineClue(solution);
    const line: NonogramSolveCell[] = solution.map((isBlack) => {
      if (random() >= 0.3) {
        return nonogramSolveCell.unknown;
      }
      return isBlack ? nonogramSolveCell.black : nonogramSolveCell.white;
    });
    if (random() < 0.2) {
      const flipped = Math.floor(random() * length);
      line[flipped] = solution[flipped]
        ? nonogramSolveCell.white
        : nonogramSolveCell.black;
    }
    return { clue, line };
  });
}

// scripts/research/nonogram_core.py の solve_line_full と solve_line_lr が返した結果。
// 端寄せの読みが弱い線・同じ線・矛盾する線を8本ずつ含む。
const pythonLineReadings: readonly [
  readonly number[],
  string,
  string | null,
  string | null,
][] = [
  [[1, 2, 3, 2], "...#x#....#.", "#x##x###x.#.", "#x##x###x.#."],
  [[2], "...", ".#.", ".#."],
  [[4, 1], "........", "..##....", "..##...."],
  [[1, 6], ".....##..", "...#####.", "...#####."],
  [[1, 2], "x..#.x", "x#x##x", "x#x##x"],
  [[2, 1, 2], ".##x....x", "x##x#x##x", "x##x#x##x"],
  [[1], ".....#", "xxxxx#", "xxxxx#"],
  [[1], ".", "#", "#"],
  [[4, 1, 1], "..#...x#..", "..##..x#x.", "..##..x#.."],
  [[1, 1, 1, 1], ".#....x.#.x.", "x#x...xx#xx.", "x#x...x.#.x."],
  [[1, 2, 3], "..#..#....", ".x#..#.#..", "..#..#.#.."],
  [[3, 2], "##...x.", null, null],
  [[1], "xx", null, null],
  [[1, 1, 1, 1], ".x#...x#..", ".x#x..x#x.", ".x#...x#.."],
  [[2], ".#x#.", null, null],
  [[1, 1, 2], ".x.xx.x", null, null],
  [[1, 1, 4, 1], "x..x#...xx#.", null, null],
  [[1, 1], "..#..", ".x#x.", "..#.."],
  [[1, 1, 1, 2], "..#.......#.", ".x#x......#.", "..#.......#."],
  [[1], "##.", null, null],
  [[1, 3, 1], "#..x....", null, null],
  [[1, 3, 1, 1], "..#........", ".x#.#......", "..#.#......"],
  [[3, 1], "..##.##", null, null],
  [[1, 1], ".xx#..x.x", ".xx#x.x.x", ".xx#..x.x"],
];

const randomLines = createRandomLines(1500);

describe("solveNonogramLineFully", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonLineReadings)(
      "ヒント %j・線 %s を同じ結果に読むこと",
      (clue, notation, expected) => {
        const solved = solveNonogramLineFully(clue, parseLine(notation));

        expect(formatLine(solved)).toBe(expected);
      },
    );
  });

  describe("総当たりとの照合", () => {
    test("長さ1〜12の線で、黒白の全並びのうちヒントに合うものの共通部分と一致すること", () => {
      const mismatches = randomLines.filter(
        ({ clue, line }) =>
          formatLine(solveNonogramLineFully(clue, line)) !==
          formatLine(solveLineByEnumeration(clue, line)),
      );

      expect(mismatches).toEqual([]);
    });
  });

  describe("黒の無い行の場合", () => {
    const line = parseLine("....");

    test("すべてを白にすること", () => {
      const solved = solveNonogramLineFully([], line);

      expect(formatLine(solved)).toBe("xxxx");
    });
  });

  describe("ヒントの合計と区切りで長さが埋まる場合", () => {
    const line = parseLine(".......");

    test("すべてのマスを決めること", () => {
      const solved = solveNonogramLineFully([3, 3], line);

      expect(formatLine(solved)).toBe("###x###");
    });
  });

  describe("未確定のマスを決める場合", () => {
    const line = parseLine("...");

    test("受け取った線を書き換えないこと", () => {
      solveNonogramLineFully([3], line);

      expect(formatLine(line)).toBe("...");
    });
  });
});

describe("solveNonogramLineByEdges", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonLineReadings)(
      "ヒント %j・線 %s を同じ結果に読むこと",
      (clue, notation, _, expected) => {
        const solved = solveNonogramLineByEdges(clue, parseLine(notation));

        expect(formatLine(solved)).toBe(expected);
      },
    );
  });

  describe("完全な線の読みとの照合", () => {
    test("完全な線の読みと矛盾の有無が同じで、決めたマスが完全な線の読みと食い違わないこと", () => {
      const unsound = randomLines.filter(function contradictsFullReading({
        clue,
        line,
      }) {
        const byEdges = solveNonogramLineByEdges(clue, line);
        const fully = solveNonogramLineFully(clue, line);
        if (byEdges === null || fully === null) {
          return byEdges !== fully;
        }
        return byEdges.some(
          (cell, cellIndex) =>
            cell !== nonogramSolveCell.unknown && cell !== fully[cellIndex],
        );
      });

      expect(unsound).toEqual([]);
    });

    test("完全な線の読みより決めるマスが少ない線があること", () => {
      const weaker = randomLines.filter(
        ({ clue, line }) =>
          formatLine(solveNonogramLineByEdges(clue, line)) !==
          formatLine(solveNonogramLineFully(clue, line)),
      );

      expect(weaker.length).toBeGreaterThan(0);
    });
  });
});
