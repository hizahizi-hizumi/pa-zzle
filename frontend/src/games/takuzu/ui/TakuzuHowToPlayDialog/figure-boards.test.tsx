import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { traceTakuzuHumanSolve } from "@/games/takuzu/problem/generation/human-solver";
import { countTakuzuSolutions } from "@/games/takuzu/problem/generation/solver";
import {
  TAKUZU_BOARD_SIZE,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  isTakuzuSolved,
} from "@/games/takuzu/puzzle/rules";
import {
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCorrectionCount,
  type TakuzuCellView,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import { TakuzuBoard as TakuzuBoardView } from "@/games/takuzu/ui/board/TakuzuBoard";
import {
  createTakuzuExampleBoard,
  type TakuzuExampleBoard,
  tapTakuzuExampleCell,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import {
  backwardCycleFigures,
  countRuleExamples,
  cycleFigures,
  duplicateRuleExamples,
  givenTileStrip,
  goalFigure,
  replacementCountFigures,
  runRuleExamples,
  type TakuzuHowToPlayFigureBoard,
  type TakuzuHowToPlayReplacementCountFigure,
  type TakuzuHowToPlayRuleExample,
  type TakuzuHowToPlayViolation,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";

afterEach(cleanup);

function listViolationKinds(board: TakuzuBoard): TakuzuHowToPlayViolation[] {
  const violations = findTakuzuRuleViolations(board);
  return [
    violations.runCellIndices.length > 0 ? "run" : null,
    violations.overfilledLines.length > 0 ? "overfilled" : null,
    violations.duplicateLines.length > 0 ? "duplicate" : null,
  ].filter((kind): kind is TakuzuHowToPlayViolation => kind !== null);
}

describe("goalFigure", () => {
  const { board, givens } = createTakuzuExampleBoard(goalFigure);

  test("盤面の全体で、完成の判定を満たすこと", () => {
    const solved = isTakuzuSolved(board);

    expect(goalFigure.rows).toHaveLength(board.size);
    expect(solved).toBe(true);
  });

  test("始まりの盤面の解は、ゴールの盤面ただ1つであること", () => {
    const { solutionCount, firstSolution } = countTakuzuSolutions(givens);

    expect(solutionCount).toBe(1);
    expect(firstSolution).toEqual(board);
  });

  test("始まりの盤面から、推測なしの手筋だけでゴールの盤面まで解けること", () => {
    const { status, board: solved } = traceTakuzuHumanSolve(givens);

    expect(status).toBe("solved");
    expect(solved).toEqual(board);
  });
});

/** 押す所を前から1回ずつ押し、押すたびに本番の判定で反しているルールを返す。 */
function pressInOrder(
  board: TakuzuHowToPlayFigureBoard,
): TakuzuHowToPlayViolation[][] {
  let example = createTakuzuExampleBoard(board);
  return (board.pressedCells ?? []).map((pressedCell) => {
    example = tapTakuzuExampleCell(example, pressedCell, "forward").example;
    return listViolationKinds(example.board);
  });
}

/** どのマスを何回押しても、押すたびに本番の判定で反しているルールを集める。 */
function pressEveryCell(example: TakuzuExampleBoard) {
  const cellCount = example.rowCount * example.columnCount;
  const kinds: TakuzuHowToPlayViolation[][] = [];
  for (let figureIndex = 0; figureIndex < cellCount; figureIndex += 1) {
    let current = example;
    for (let press = 0; press < 3; press += 1) {
      current = tapTakuzuExampleCell(current, figureIndex, "forward").example;
      kinds.push(listViolationKinds(current.board));
    }
  }
  return kinds;
}

/** 1回押すとそのルールだけに反する形になるマス。 */
function listCellsViolatingOnlyByOnePress(
  board: TakuzuHowToPlayFigureBoard,
  rule: TakuzuHowToPlayViolation,
): number[] {
  const example = createTakuzuExampleBoard(board);
  const cellCount = example.rowCount * example.columnCount;
  return Array.from(
    { length: cellCount },
    (_, figureIndex) => figureIndex,
  ).filter((figureIndex) => {
    const kinds = listViolationKinds(
      tapTakuzuExampleCell(example, figureIndex, "forward").example.board,
    );
    return kinds.length === 1 && kinds[0] === rule;
  });
}

/** どのルールの例にも共通する決まり。例の組ごとの describe の中で呼ぶ。 */
function testRuleExampleSet(
  examples: readonly TakuzuHowToPlayRuleExample[],
  rule: TakuzuHowToPlayViolation,
) {
  const cases = examples.map((ruleExample) => ({
    rows: ruleExample.board.rows,
    ruleExample,
    board: createTakuzuExampleBoard(ruleExample.board).board,
  }));
  const hintedCases = cases.filter(
    ({ ruleExample }) => (ruleExample.board.pressedCells ?? []).length > 0,
  );

  test.each(cases)(
    "できる形と途中の形はどのルールにも反さず、できない形は示すルールだけに反すること: $rows",
    ({ ruleExample, board }) => {
      const kinds = listViolationKinds(board);

      expect(kinds).toEqual(
        ruleExample.verdict === "disallowed" ? [ruleExample.violates] : [],
      );
    },
  );

  test.each(
    cases.filter(({ ruleExample }) => ruleExample.verdict !== "disallowed"),
  )(
    "できる形は埋まり、途中の形には空きがあること: $rows",
    ({ ruleExample }) => {
      const hasEmpty = ruleExample.board.rows.some((row) => row.includes("."));

      expect(hasEmpty).toBe(ruleExample.verdict === "incomplete");
    },
  );

  test("押す所の手がかりを付けた例がただ1つあること", () => {
    const hintedCount = hintedCases.length;

    expect(hintedCount).toBe(1);
  });

  test.each(hintedCases)(
    "押す所を前から1回ずつ押すと、途中はどのルールにも反さず、最後にそのルールだけに反すること: $rows",
    ({ ruleExample }) => {
      const kinds = pressInOrder(ruleExample.board);

      expect(kinds.slice(0, -1).every((step) => step.length === 0)).toBe(true);
      expect(kinds.at(-1)).toEqual([rule]);
    },
  );

  test.each(
    hintedCases.filter(
      ({ ruleExample }) => (ruleExample.board.pressedCells ?? []).length === 1,
    ),
  )(
    "1回押すとそのルールだけに反する形になるマスのすべてに、手がかりを付けること: $rows",
    ({ ruleExample }) => {
      const violatingCells = listCellsViolatingOnlyByOnePress(
        ruleExample.board,
        rule,
      );

      expect(violatingCells).toEqual(ruleExample.board.pressedCells);
    },
  );
}

describe("runRuleExamples", () => {
  const cases = runRuleExamples.map((ruleExample) => ({
    rows: ruleExample.board.rows,
    example: createTakuzuExampleBoard(ruleExample.board),
  }));

  testRuleExampleSet(runRuleExamples, "run");

  test.each(cases)(
    "どのマスを押していっても、3つ続けないのほかのルールには反さないこと: $rows",
    ({ example }) => {
      const kinds = pressEveryCell(example);

      expect(kinds.flat().every((kind) => kind === "run")).toBe(true);
    },
  );

  test("できない形を縦に3つ続く帯にし、できる形を押した後の姿と別の向きにすること", () => {
    const [allowed, disallowed] = cases;

    expect(allowed?.example.rowCount).toBe(1);
    expect(disallowed?.example.columnCount).toBe(1);
    expect(disallowed?.example.rowCount).toBe(3);
  });
});

describe("countRuleExamples", () => {
  const [allowed] = countRuleExamples;
  const { board } = createTakuzuExampleBoard(allowed?.board ?? { rows: [] });

  testRuleExampleSet(countRuleExamples, "overfilled");

  test("できる形の行を、四角と丸が4つずつで埋め切った形にすること", () => {
    const row = board.cells.slice(0, TAKUZU_BOARD_SIZE);

    expect(row.filter((cell) => cell === "a")).toHaveLength(
      TAKUZU_BOARD_SIZE / 2,
    );
    expect(row.filter((cell) => cell === "b")).toHaveLength(
      TAKUZU_BOARD_SIZE / 2,
    );
  });
});

describe("duplicateRuleExamples", () => {
  const [allowed, touched] = duplicateRuleExamples;

  function readRows(board: TakuzuHowToPlayFigureBoard): TakuzuCell[][] {
    const example = createTakuzuExampleBoard(board);
    return Array.from({ length: example.rowCount }, (_, row) =>
      example.board.cells.slice(
        row * TAKUZU_BOARD_SIZE,
        row * TAKUZU_BOARD_SIZE + example.columnCount,
      ),
    );
  }

  testRuleExampleSet(duplicateRuleExamples, "duplicate");

  test("できる形を、四角と丸が4つずつで埋まった、違う並びの2行にすること", () => {
    const rows = readRows(allowed?.board ?? { rows: [] });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveLength(TAKUZU_BOARD_SIZE);
      expect(row.filter((cell) => cell === "a")).toHaveLength(
        TAKUZU_BOARD_SIZE / 2,
      );
    }
    expect(rows[0]).not.toEqual(rows[1]);
  });

  test("触ってできない形にする例を、上の行の四角を空けた下の行にし、空けたマスに左から順に手がかりを付けること", () => {
    const board = touched?.board ?? { rows: [] };
    const [top = [], bottom = []] = readRows(board);
    const emptyColumns = bottom.flatMap((cell, column) =>
      cell === null ? [column] : [],
    );
    const hintedColumns = (board.pressedCells ?? []).map(
      (cell) => cell - TAKUZU_BOARD_SIZE,
    );

    expect(top.every((cell) => cell !== null)).toBe(true);
    expect(emptyColumns.length).toBeGreaterThan(0);
    expect(hintedColumns).toEqual(emptyColumns);
    expect(emptyColumns.every((column) => top[column] === "a")).toBe(true);
    expect(bottom.map((cell, column) => cell ?? top[column])).toEqual(top);
  });
});

describe("givenTileStrip", () => {
  const example = createTakuzuExampleBoard(givenTileStrip);
  const pressedCells = givenTileStrip.pressedCells ?? [];
  const placedCells = example.givens.cells
    .slice(0, example.columnCount)
    .flatMap((given, figureIndex) =>
      given === null && example.board.cells[figureIndex] !== null
        ? [figureIndex]
        : [],
    );

  test("押す所の手がかりを、最初からあるタイルに付けること", () => {
    const hintedGivens = pressedCells.map(
      (cell) => example.givens.cells[cell] ?? null,
    );

    expect(pressedCells.length).toBeGreaterThan(0);
    expect(hintedGivens.every((given) => given !== null)).toBe(true);
  });

  test("置いたタイルを押して巡らせても、どの姿でもルールに反さないこと", () => {
    const kinds: TakuzuHowToPlayViolation[][] = [];
    let current: TakuzuExampleBoard = example;
    for (const placedCell of placedCells) {
      for (let press = 0; press < 3; press += 1) {
        current = tapTakuzuExampleCell(current, placedCell, "forward").example;
        kinds.push(listViolationKinds(current.board));
      }
    }

    expect(placedCells.length).toBeGreaterThan(0);
    expect(kinds.every((step) => step.length === 0)).toBe(true);
  });
});

describe("cycleFigures", () => {
  const onCycleCell = vi.fn();
  const cellViews: TakuzuCellView[] = Array.from({ length: 4 }, () => ({
    cell: null,
    given: false,
    inViolatingRun: false,
  }));

  beforeEach(() => {
    onCycleCell.mockClear();
    render(
      <TakuzuBoardView
        size={2}
        cells={cellViews}
        lineViolations={[]}
        operation={null}
        interactionDisabled={false}
        onCycleCell={onCycleCell}
        onPlaceCell={vi.fn()}
      />,
    );
  });

  test("図の巡る向きが、本番の盤面でマスを押したときの向きと一致すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "1行1列 空き" }));

    expect(onCycleCell).toHaveBeenCalledWith(0, cycleFigures.direction);
  });

  test("右クリックの図の巡る向きが、本番の盤面で右クリックしたときの向きと一致すること", () => {
    const cell = screen.getByRole("button", { name: "1行1列 空き" });

    fireEvent.pointerDown(cell, { pointerType: "mouse" });
    fireEvent.contextMenu(cell);

    expect(onCycleCell).toHaveBeenCalledWith(0, backwardCycleFigures.direction);
  });
});

describe("replacementCountFigures", () => {
  /** 固定マスの無い問題。例の盤面は左上を切り出したものなので、本番の大きさの盤面で押す。 */
  const problem: TakuzuProblem = {
    givens: {
      size: TAKUZU_BOARD_SIZE,
      cells: Array.from(
        { length: TAKUZU_BOARD_SIZE * TAKUZU_BOARD_SIZE },
        (): TakuzuCell => null,
      ),
    },
    solution: createTakuzuExampleBoard(goalFigure).board,
  };
  const cases: {
    name: string;
    figure: TakuzuHowToPlayReplacementCountFigure;
  }[] = Object.entries(replacementCountFigures).map(([name, figure]) => ({
    name,
    figure,
  }));

  function toBoardIndex(
    frame: TakuzuHowToPlayFigureBoard,
    figureIndex: number,
  ): number {
    const columnCount = frame.rows[0]?.length ?? 0;
    return (
      Math.floor(figureIndex / columnCount) * TAKUZU_BOARD_SIZE +
      (figureIndex % columnCount)
    );
  }

  /** 空きの盤面から、最初のコマの置いたタイルを、本番と同じく押して置く。 */
  function startFromFirstFrame(
    frame: TakuzuHowToPlayFigureBoard,
  ): TakuzuSession {
    const { board } = createTakuzuExampleBoard(frame);
    return board.cells.reduce(
      function placeByPressing(session, cell, cellIndex) {
        let current = session;
        while (current.puzzleState.cells[cellIndex] !== cell) {
          current = cycleTakuzuSessionCell(current, cellIndex, "forward", 0);
        }
        return current;
      },
      createTakuzuSession(problem, 0),
    );
  }

  /** 各コマの押すマスを順に押し、押すたびの盤面と、最後のコマでの置き直しの回数を返す。 */
  function pressFrames({ frames }: TakuzuHowToPlayReplacementCountFigure): {
    boards: TakuzuBoard[];
    correctionCount: number;
  } {
    const [firstFrame] = frames;
    if (firstFrame === undefined) {
      return { boards: [], correctionCount: 0 };
    }
    let session = startFromFirstFrame(firstFrame);
    const boards = [session.puzzleState];
    for (const frame of frames.slice(0, -1)) {
      for (const pressedCell of frame.pressedCells ?? []) {
        session = cycleTakuzuSessionCell(
          session,
          toBoardIndex(frame, pressedCell),
          "forward",
          0,
        );
      }
      boards.push(session.puzzleState);
    }
    return {
      boards,
      correctionCount: getTakuzuSessionCorrectionCount(session),
    };
  }

  test.each(cases)(
    "各コマの押すマスを押すと、本番の session が次のコマの姿に進むこと: $name",
    ({ figure }) => {
      const { boards } = pressFrames(figure);

      expect(boards).toEqual(
        figure.frames.map((frame) => createTakuzuExampleBoard(frame).board),
      );
    },
  );

  test.each(cases)(
    "最後のコマまで押したときに本番の session が数える置き直しの回数が、図に添える回数と一致すること: $name",
    ({ figure }) => {
      const { correctionCount } = pressFrames(figure);

      expect(correctionCount).toBe(figure.correctionCount);
    },
  );

  test.each(cases)(
    "最後のコマのほかは、どのコマにも次に押すマスが1つずつあること: $name",
    ({ figure }) => {
      const pressedCounts = figure.frames.map(
        ({ pressedCells }) => pressedCells?.length ?? 0,
      );

      expect(pressedCounts.slice(0, -1).every((count) => count === 1)).toBe(
        true,
      );
      expect(pressedCounts.at(-1)).toBe(0);
    },
  );
});
