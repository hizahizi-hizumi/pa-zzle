import { findTakuzuRuleViolations } from "@/games/takuzu/puzzle/rules";
import {
  getNextTakuzuCell,
  placeTakuzuCell,
} from "@/games/takuzu/puzzle/transitions";
import {
  createTakuzuExampleBoard,
  findTakuzuExampleHintCell,
  getTakuzuExampleLineTileCounts,
  getTakuzuExampleMarks,
  judgeTakuzuExample,
  listTakuzuExampleCells,
  listTakuzuExampleOverfilledTileCells,
  listTakuzuExampleViolations,
  tapTakuzuExampleCell,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import {
  backwardCycleTouchBoard,
  countRuleExamples,
  cycleFigures,
  duplicateRuleExamples,
  givenTileStrip,
  runRuleExamples,
  type TakuzuHowToPlayFigureBoard,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";

describe("tapTakuzuExampleCell", () => {
  const { steps } = cycleFigures;
  const forward = steps.map((before, index) => ({
    before,
    after: steps[(index + 1) % steps.length] ?? { rows: [] },
  }));
  const cases = [
    ...forward.map((pair) => ({
      name: "タップ",
      direction: cycleFigures.direction,
      ...pair,
    })),
    ...forward.map(({ before, after }) => ({
      name: "右クリック",
      direction:
        cycleFigures.direction === "forward"
          ? ("backward" as const)
          : ("forward" as const),
      before: after,
      after: before,
    })),
  ].map((testCase) => {
    const example = createTakuzuExampleBoard(testCase.before);
    return {
      ...testCase,
      example,
      expectedBoard: placeTakuzuCell(
        example.givens,
        example.board,
        0,
        getNextTakuzuCell(example.board.cells[0] ?? null, testCase.direction),
      ),
      expectedCells: listTakuzuExampleCells(
        createTakuzuExampleBoard(testCase.after),
      ),
    };
  });

  test.each(cases)(
    "巡る順の図で、$nameした後が、本番の遷移をかけた盤面と、図で矢印の先にあるマスに一致すること: $before.rows → $after.rows",
    ({ example, direction, expectedBoard, expectedCells }) => {
      const tapped = tapTakuzuExampleCell(example, 0, direction);

      expect(tapped.example.board).toEqual(expectedBoard);
      expect(listTakuzuExampleCells(tapped.example)).toEqual(expectedCells);
    },
  );

  describe("最初からあるタイルを押した場合", () => {
    const example = createTakuzuExampleBoard(givenTileStrip);

    test("盤面を変えず、押せなかったことを返すこと", () => {
      const tapped = tapTakuzuExampleCell(example, 0, "forward");

      expect(tapped.example).toBe(example);
      expect(tapped.rejected).toBe(true);
    });
  });
});

describe("getTakuzuExampleMarks", () => {
  const cases = [
    ...runRuleExamples,
    ...countRuleExamples,
    ...duplicateRuleExamples,
  ].map((ruleExample) => {
    const example = createTakuzuExampleBoard(ruleExample.board);
    return {
      rows: ruleExample.board.rows,
      example,
      violations: findTakuzuRuleViolations(example.board),
    };
  });

  test.each(cases)(
    "本番の判定が返す違反を、例のマスと行・列にそのまま移すこと: $rows",
    ({ example, violations }) => {
      const marks = getTakuzuExampleMarks(example);

      expect(
        marks.runCells.map(
          (figureIndex) =>
            Math.floor(figureIndex / example.columnCount) * example.board.size +
            (figureIndex % example.columnCount),
        ),
      ).toEqual(violations.runCellIndices);
      expect(marks.overfilledLines).toEqual(violations.overfilledLines);
      expect(marks.duplicateLines).toEqual(violations.duplicateLines);
    },
  );
});

describe("getTakuzuExampleLineTileCounts", () => {
  const firstRow = { axis: "row", index: 0 } as const;
  const cases = countRuleExamples.map((ruleExample) => {
    const tiles = [...(ruleExample.board.rows[0] ?? "")].map((mark) =>
      mark.toLowerCase(),
    );
    return {
      rows: ruleExample.board.rows,
      verdict: ruleExample.verdict,
      example: createTakuzuExampleBoard(ruleExample.board),
      counts: {
        a: tiles.filter((tile) => tile === "a").length,
        b: tiles.filter((tile) => tile === "b").length,
      },
    };
  });

  test.each(cases)(
    "行の四角と丸を数え、本番の判定が置ける数を超えたとする行でだけ、多い方のタイルを超えた方として返すこと: $rows",
    ({ verdict, example, counts }) => {
      const result = getTakuzuExampleLineTileCounts(example, firstRow);

      expect(result).toEqual({
        counts,
        overfilledTile: verdict === "allowed" ? null : "a",
      });
    },
  );
});

describe("listTakuzuExampleOverfilledTileCells", () => {
  const cases = [
    {
      name: "四角が5つの行",
      rows: ["aabaabab"],
      expected: [0, 1, 3, 4, 6],
    },
    {
      name: "丸が5つの行",
      rows: ["abbabbab"],
      expected: [1, 2, 4, 5, 7],
    },
    {
      name: "4つずつの行",
      rows: ["abbaabab"],
      expected: [],
    },
    {
      name: "2行目だけが丸5つの2行",
      rows: ["abaabbab", "ab.abbbb"],
      expected: [12, 13, 14, 15, 9],
    },
  ].map((testCase) => ({
    ...testCase,
    example: createTakuzuExampleBoard({ rows: testCase.rows }),
  }));

  test.each(cases)(
    "本番の判定が置ける数を超えたとする行の、超えた方のタイルのマスだけを返すこと: $name",
    ({ example, expected }) => {
      const cells = listTakuzuExampleOverfilledTileCells(example);

      expect(cells).toEqual([...expected].sort((left, right) => left - right));
    },
  );
});

describe("listTakuzuExampleViolations", () => {
  const cases = [
    { name: "3つ続く", rows: ["aaa"], expected: [{ kind: "run" }] },
    {
      name: "丸が5つ",
      rows: ["babbabab"],
      expected: [{ kind: "overfilled", tile: "b", count: 5 }],
    },
    {
      name: "同じ並び",
      rows: ["abaabbab", "abaabbab"],
      expected: [{ kind: "duplicate" }],
    },
    { name: "反していない", rows: ["abaabbab"], expected: [] },
  ].map((testCase) => ({
    ...testCase,
    example: createTakuzuExampleBoard({ rows: testCase.rows }),
  }));

  test.each(cases)(
    "本番の判定から、反しているルールと超えたタイルの数を返すこと: $name",
    ({ example, expected }) => {
      const violations = listTakuzuExampleViolations(example);

      expect(violations).toEqual(expected);
    },
  );
});

describe("judgeTakuzuExample", () => {
  const cases = [
    {
      name: "埋まって反していない",
      rows: ["abaabbab"],
      waits: true,
      expected: "allowed",
    },
    {
      name: "空きがあり反していない",
      rows: ["aba.bbab"],
      waits: true,
      expected: "incomplete",
    },
    {
      name: "空きがあり反している",
      rows: ["aaa.bbab"],
      waits: true,
      expected: "disallowed",
    },
    {
      name: "埋まるのを待たないルールで空きがある",
      rows: ["aa."],
      waits: false,
      expected: "allowed",
    },
  ] as const;

  test.each(cases)(
    "本番の判定で反していればできない、行を埋め切ってから決まるルールで空きがあれば途中とすること: $name",
    ({ rows, waits, expected }) => {
      const verdict = judgeTakuzuExample(
        createTakuzuExampleBoard({ rows }),
        waits,
      );

      expect(verdict).toBe(expected);
    },
  );
});

describe("findTakuzuExampleHintCell", () => {
  const figure: TakuzuHowToPlayFigureBoard = {
    rows: ["ab.abb.b"],
    pressedCells: [2, 6],
  };

  function pressCells(
    cells: readonly number[],
    board: TakuzuHowToPlayFigureBoard = figure,
  ) {
    let example = createTakuzuExampleBoard(board);
    for (const cell of cells) {
      example = tapTakuzuExampleCell(
        example,
        cell,
        board.pressDirection ?? "forward",
      ).example;
    }
    return example;
  }

  const cases = [
    { name: "触る前", presses: [], expected: 2 },
    { name: "1つ目を押した後", presses: [2], expected: 6 },
    { name: "後のマスを先に押した後", presses: [6], expected: 2 },
    { name: "押し終えた後", presses: [2, 6], expected: null },
    { name: "同じマスを2回押した後", presses: [2, 2], expected: null },
    { name: "ほかのマスを押した後", presses: [0], expected: null },
    { name: "押し続けて最初の姿に戻った後", presses: [2, 2, 2], expected: 2 },
  ].map((testCase) => ({ ...testCase, pressed: pressCells(testCase.presses) }));

  test.each(cases)(
    "押す所を1回ずつ押していく途中なら、まだ押していない最初のマスを返すこと: $name",
    ({ pressed, expected }) => {
      const hintCell = findTakuzuExampleHintCell(figure, pressed);

      expect(hintCell).toBe(expected);
    },
  );

  describe("右クリックで押す例を逆の向きに1回押した場合", () => {
    const pressed = pressCells([0], backwardCycleTouchBoard);

    test("押し終えた姿として、手がかりのマスを返さないこと", () => {
      const hintCell = findTakuzuExampleHintCell(
        backwardCycleTouchBoard,
        pressed,
      );

      expect(pressed.board.cells[0]).toBe("b");
      expect(hintCell).toBe(null);
    });
  });
});
