import {
  type TakuzuDifficulty,
  takuzuDifficulties,
} from "@/games/takuzu/difficulty";
import { traceTakuzuHumanSolve } from "@/games/takuzu/problem/generation/human-solver";
import type { TakuzuTechnique } from "@/games/takuzu/problem/technique";
import type { TakuzuBoard } from "@/games/takuzu/puzzle/board";
import { _private } from "@/games/takuzu/ui/TakuzuDifficultyPreview";

const { previewMoments, createPreviewRows } = _private;

const difficultyIds = takuzuDifficulties.map((difficulty) => difficulty.id);

// 各レベルで初めて要る読み。レベル5 はこの読み（D）が2つの局面で要ることで決まるが、図では2か所の見比べを1つの局面にまとめて描く。
const expectedTechniques = {
  "1": "adjacency",
  "2": "count-completion",
  "3": "single-remaining",
  "4": "duplicate-avoidance",
  "5": "duplicate-avoidance",
} satisfies Record<TakuzuDifficulty, TakuzuTechnique>;

function readMoment(difficulty: TakuzuDifficulty) {
  const flat = previewMoments[difficulty].join("");
  const givens: TakuzuBoard = {
    size: 8,
    cells: Array.from(flat, (mark) =>
      mark === "A" ? "a" : mark === "B" ? "b" : null,
    ),
  };
  const deductions = Array.from(flat).flatMap((mark, cellIndex) =>
    mark === "a" || mark === "b" ? [{ cellIndex, tile: mark }] : [],
  );
  return { givens, deductions };
}

describe("previewMoments", () => {
  const momentCases = difficultyIds.map(
    (difficulty) => [difficulty, readMoment(difficulty)] as const,
  );
  const duplicateAvoidanceGivens = [
    readMoment("4").givens,
    readMoment("5").givens,
  ];

  test.each(momentCases)(
    "レベル %s の局面は、人間向け解法器の最初のラウンドがそのレベルで初めて要る読みになり、示したマスがちょうど決まること",
    (difficulty, { givens, deductions }) => {
      const [firstRound] = traceTakuzuHumanSolve(givens).rounds;

      expect(firstRound?.technique).toBe(expectedTechniques[difficulty]);
      expect(firstRound?.deductions).toEqual(deductions);
    },
  );

  test("レベル 5 の局面は完成した行との見比べをレベル 4 より多くの場所で要すること", () => {
    const sourceCounts = duplicateAvoidanceGivens.map(
      (givens) => traceTakuzuHumanSolve(givens).rounds[0]?.sourceCount,
    );

    expect(sourceCounts).toEqual([1, 2]);
  });
});

describe("createPreviewRows", () => {
  const rowCases = [
    ["1", [3]],
    ["2", [3]],
    ["3", [3]],
    ["4", [2, 6]],
    ["5", [1, 4, 7]],
  ] as const satisfies readonly (readonly [TakuzuDifficulty, number[]])[];

  test.each(rowCases)(
    "レベル %s ではタイルのある行 %j だけを切り出すこと",
    (difficulty, expectedRows) => {
      const rows = createPreviewRows(difficulty);

      expect(rows.map(({ row }) => row)).toEqual(expectedRows);
    },
  );

  test("決まるマスはタイルを持たない空きマスとして返すこと", () => {
    const [row] = createPreviewRows("3");

    expect(row?.cells).toEqual([
      { column: 0, given: null, deduced: false },
      { column: 1, given: null, deduced: false },
      { column: 2, given: "a", deduced: false },
      { column: 3, given: "b", deduced: false },
      { column: 4, given: "b", deduced: false },
      { column: 5, given: "a", deduced: false },
      { column: 6, given: "b", deduced: false },
      { column: 7, given: null, deduced: true },
    ]);
  });

  test.each(difficultyIds)(
    "レベル %s の図で全マスが埋まった行は、見比べる相手の完成した行だけであること",
    (difficulty) => {
      const rows = createPreviewRows(difficulty);
      const filledRows = rows.filter(({ cells }) =>
        cells.every(({ given }) => given !== null),
      );

      expect(filledRows).toEqual(rows.filter(({ complete }) => complete));
      expect(filledRows.length).toBe(
        expectedTechniques[difficulty] === "duplicate-avoidance" ? 1 : 0,
      );
    },
  );
});
