import {
  type NonogramCellState,
  parseNonogramBoard,
  setNonogramCellState,
} from "@/games/nonogram/puzzle/board";
import {
  computeNonogramClues,
  computeNonogramLineClue,
} from "@/games/nonogram/puzzle/clue";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import {
  findNonogramMatchedLines,
  isNonogramLineMatched,
  isNonogramSolved,
} from "@/games/nonogram/puzzle/rules";
import { createProblemSeededRandom } from "@/games/problem-seed";

const stateByNotation = {
  ".": "unknown",
  "#": "filled",
  x: "crossed",
} as const;

function toStates(notation: string): NonogramCellState[] {
  return Array.from(
    notation,
    (symbol) => stateByNotation[symbol as keyof typeof stateByNotation],
  );
}

const cellStates = ["unknown", "filled", "crossed"] as const;

/** 塗りの並びが図柄の行ヒントと合う線を多めに混ぜるため、半分は解の線から始めて1マスだけ変える。 */
function createRandomLineStates(count: number) {
  const random = createProblemSeededRandom("nonogram-line-match");
  return Array.from({ length: count }, function createLine() {
    const length = 1 + Math.floor(random() * 10);
    const black = Array.from({ length }, () => random() < 0.55);
    const clue = computeNonogramLineClue(black);
    const states: NonogramCellState[] =
      random() < 0.5
        ? black.map((isBlack) =>
            isBlack ? "filled" : random() < 0.5 ? "crossed" : "unknown",
          )
        : black.map(() => cellStates[Math.floor(random() * 3)]!);
    const changed = Math.floor(random() * length);
    if (random() < 0.5) {
      states[changed] = cellStates[Math.floor(random() * 3)]!;
    }
    return { clue, states };
  });
}

/** 塗ったマスを `#`、ほかを `.` にした文字列で、`#` の続く長さを左から並べる。 */
function measureFilledRuns(states: readonly NonogramCellState[]): number[] {
  const notation = states
    .map((state) => (state === "filled" ? "#" : "."))
    .join("");
  return (notation.match(/#+/g) ?? []).map((run) => run.length);
}

describe("isNonogramLineMatched", () => {
  const cases = [
    ["塗りがヒントにちょうど合う線", [2, 1], "##x#.", true],
    ["未確定のマスが残っていても塗りが合う線", [2, 1], "##.#.", true],
    ["× を付けていなくても塗りが合う線", [1], "..#..", true],
    ["塗りが足りない線", [2, 1], "#..#.", false],
    ["塗りすぎた線", [2], "###..", false],
    ["塊の順が逆の線", [2, 1], "#.##.", false],
    ["黒の無い線で何も塗っていない線", [], "x..x", true],
    ["黒の無い線に塗りがある線", [], "x#.x", false],
  ] as const;

  test.each(cases)("%s を判定すること", (_, clue, notation, expected) => {
    const matched = isNonogramLineMatched(clue, toStates(notation));

    expect(matched).toBe(expected);
  });

  describe("無作為な線の場合", () => {
    const lines = createRandomLineStates(2000);
    const expected = lines.map(
      ({ clue, states }) =>
        measureFilledRuns(states).join(",") === clue.join(","),
    );

    test("塗ったマスの塊の長さがヒントと同じ並びの線を一致と判定すること", () => {
      const matched = lines.map(({ clue, states }) =>
        isNonogramLineMatched(clue, states),
      );

      expect(matched).toEqual(expected);
      expect(matched).toContain(true);
      expect(matched).toContain(false);
    });
  });
});

describe("findNonogramMatchedLines", () => {
  const clues = computeNonogramClues(
    parseNonogramPattern(["##.", "..#", "#.#"]),
  );
  const board = parseNonogramBoard(["##x", "...", "#.."]);

  test("行ヒントと列ヒントの順に、塗りがちょうど合う線を返すこと", () => {
    const matched = findNonogramMatchedLines(board, clues);

    expect(matched).toEqual({
      rows: [true, false, false],
      columns: [true, true, false],
    });
  });
});

describe("isNonogramSolved", () => {
  const solution = parseNonogramPattern(["##.", "..#", "#.#"]);
  const solvedBoard = parseNonogramBoard(["##x", "..#", "#.#"]);
  const cases = [
    ["× や未確定が残っていても塗りが解と同じ盤面", solvedBoard, true],
    [
      "塗りが1マス足りない盤面",
      parseNonogramBoard(["##x", "..#", "#.."]),
      false,
    ],
    [
      "解に無いマスも塗った盤面",
      parseNonogramBoard(["###", "..#", "#.#"]),
      false,
    ],
    ["何も塗っていない盤面", parseNonogramBoard(["...", "...", "..."]), false],
  ] as const;

  test.each(cases)("%s を判定すること", (_, board, expected) => {
    const solved = isNonogramSolved(board, solution);

    expect(solved).toBe(expected);
  });

  describe("解がただ1つの問題の場合", () => {
    const clues = computeNonogramClues(solution);
    const boards = solvedBoard.cells.flatMap((_, cellIndex) =>
      cellStates.map((state) =>
        setNonogramCellState(solvedBoard, cellIndex, state),
      ),
    );

    test("1マスを変えた盤面で、クリアとすべての線の一致が同時に成り立つこと", () => {
      const disagreements = boards.filter(function disagrees(board) {
        const matched = findNonogramMatchedLines(board, clues);
        const allMatched = [...matched.rows, ...matched.columns].every(Boolean);
        return allMatched !== isNonogramSolved(board, solution);
      });

      expect(disagreements).toEqual([]);
    });
  });
});
