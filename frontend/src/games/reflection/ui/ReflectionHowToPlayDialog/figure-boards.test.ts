import {
  computeReflectionClues,
  getReflectionEntryIndex,
  isSameReflectionClue,
  type ReflectionEntry,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import { getReflectionSessionStock } from "@/games/reflection/session/session";
import {
  createReflectionExampleBoard,
  type ReflectionExampleBoard,
  tapReflectionExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/example-board";
import {
  blackHoleRuleExamples,
  completionRuleExample,
  countRuleExamples,
  doubleMirrorRuleExamples,
  exitRuleExamples,
  goalFigure,
  laserOperationExample,
  mirrorRuleExamples,
  moveOperationExample,
  placeOperationExample,
  type ReflectionHowToPlayExample,
  reflectorRuleExamples,
  swapOperationExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";

/** `entry` の数字が、例の始まりの盤面の光で合っているか。 */
function isMatchedAtStart(
  example: ReflectionHowToPlayExample,
  entry: ReflectionEntry,
): boolean {
  const matches = listReflectionClueMatches(
    example.board,
    computeReflectionClues(example.solution),
  );
  return matches[getReflectionEntryIndex(example.board.size, entry)] ?? false;
}

function getFocusEntry(example: ReflectionHowToPlayExample): ReflectionEntry {
  if (example.focusEntry === undefined) {
    throw new Error("例に判定する数字が無い");
  }
  return example.focusEntry;
}

/** 例が見せる手を押すたびの姿。 */
function listHandBoards(
  example: ReflectionHowToPlayExample,
): ReflectionExampleBoard[] {
  const boards = [createReflectionExampleBoard(example)];
  for (const target of example.hand) {
    const previous = boards.at(-1) ?? createReflectionExampleBoard(example);
    boards.push(tapReflectionExample(previous, example, target));
  }
  return boards;
}

const allExamples: readonly [string, ReflectionHowToPlayExample][] = [
  ["数と行き先の合う例", countRuleExamples[0]],
  ["数と行き先の合わない例", countRuleExamples[1]],
  ["出た先の合う例", exitRuleExamples[0]],
  ["出た先の合わない例", exitRuleExamples[1]],
  ["右上がりの鏡の例", mirrorRuleExamples[0]],
  ["右下がりの鏡の例", mirrorRuleExamples[1]],
  ["中央の反射鏡の例", reflectorRuleExamples[0]],
  ["端の反射鏡の例", reflectorRuleExamples[1]],
  ["縦の両面鏡の例", doubleMirrorRuleExamples[0]],
  ["横の両面鏡の例", doubleMirrorRuleExamples[1]],
  ["中央のブラックホールの例", blackHoleRuleExamples[0]],
  ["端のブラックホールの例", blackHoleRuleExamples[1]],
  ["完成の例", completionRuleExample],
  ["置き方の例", placeOperationExample],
  ["移し方の例", moveOperationExample],
  ["置き換えと戻し方の例", swapOperationExample],
  ["光路の例", laserOperationExample],
];

describe("allExamples", () => {
  test.each(allExamples)(
    "始まりの盤面のピースが手持ちに収まること: %s",
    (_, example) => {
      const stock = getReflectionSessionStock(
        createReflectionExampleBoard(example).session,
      );

      expect(Object.values(stock).every((count) => count >= 0)).toBe(true);
    },
  );

  test.each(allExamples)(
    "例が見せる手のどの手も、本番の操作で姿を変えること: %s",
    (_, example) => {
      const boards = listHandBoards(example);

      const unchanged = boards
        .slice(1)
        .filter((board, index) => board === boards[index]);

      expect(unchanged).toEqual([]);
    },
  );
});

/** 始まりの盤面の最初のピースを、空いたマスへ移してから元のマスへ戻した姿。 */
function moveFirstPieceAwayAndBack(
  example: ReflectionHowToPlayExample,
): ReflectionExampleBoard {
  const cells = example.board.cells;
  const from = cells.findIndex((cell) => cell !== null);
  const to = cells.indexOf(null);
  const targets = [from, to, to, from].map((cellIndex) => ({
    type: "cell" as const,
    cellIndex,
  }));
  return targets.reduce(
    (board, target) => tapReflectionExample(board, example, target),
    createReflectionExampleBoard(example),
  );
}

describe("完成を見せない例の場合", () => {
  const examples = allExamples.filter(
    ([, example]) => example !== completionRuleExample,
  );
  const withPieces = examples.filter(([, example]) =>
    example.board.cells.some((cell) => cell !== null),
  );

  test.each(examples)(
    "例が見せる手を打ち終えても完成に入らないこと: %s",
    (_, example) => {
      const statuses = listHandBoards(example).map(
        ({ session }) => session.status,
      );

      expect(statuses.every((status) => status === "playing")).toBe(true);
    },
  );

  test.each(withPieces)(
    "ピースを動かして元へ戻し、揃っても完成に入らないこと: %s",
    (_, example) => {
      const board = moveFirstPieceAwayAndBack(example);

      expect(board.session.puzzleState).toEqual(example.board);
      expect(board.session.status).toBe("playing");
    },
  );
});

describe("countRuleExamples", () => {
  const [allowed, disallowed] = countRuleExamples;
  const allowedEntry = getFocusEntry(allowed);
  const disallowedEntry = getFocusEntry(disallowed);
  const disallowedClue = computeReflectionClues(disallowed.solution)[
    getReflectionEntryIndex(disallowed.board.size, disallowedEntry)
  ];

  test("合う例は、判定する数字が始まりの盤面の光と合うこと", () => {
    const matched = isMatchedAtStart(allowed, allowedEntry);

    expect(matched).toBe(true);
  });

  test("合わない例は、判定する数字の光が通るマスの数が違って合わないこと", () => {
    const trace = traceReflectionLaser(disallowed.board, disallowedEntry);
    const matched = isMatchedAtStart(disallowed, disallowedEntry);

    expect(trace.distance).not.toBe(disallowedClue?.distance);
    expect(matched).toBe(false);
  });
});

describe("exitRuleExamples", () => {
  const [allowed, disallowed] = exitRuleExamples;
  const allowedEntry = getFocusEntry(allowed);
  const disallowedEntry = getFocusEntry(disallowed);
  const clues = computeReflectionClues(disallowed.solution);
  const { size } = disallowed.board;
  const disallowedClue = clues[getReflectionEntryIndex(size, disallowedEntry)];

  test("合う例は、判定する数字が始まりの盤面の光と合うこと", () => {
    const matched = isMatchedAtStart(allowed, allowedEntry);

    expect(matched).toBe(true);
  });

  test("合わない例は、数と印は同じでも出た先の数字が違うので合わないこと", () => {
    const trace = traceReflectionLaser(disallowed.board, disallowedEntry);
    const exitClue =
      trace.exit === null
        ? undefined
        : clues[getReflectionEntryIndex(size, trace.exit)];
    const matched = isMatchedAtStart(disallowed, disallowedEntry);

    expect(disallowedClue && isSameReflectionClue(trace, disallowedClue)).toBe(
      true,
    );
    expect(exitClue && isSameReflectionClue(exitClue, trace)).toBe(false);
    expect(matched).toBe(false);
  });
});

describe("ピースの働きの例の場合", () => {
  const pairs = [
    ["斜め鏡", mirrorRuleExamples],
    ["反射鏡", reflectorRuleExamples],
    ["両面鏡", doubleMirrorRuleExamples],
    ["ブラックホール", blackHoleRuleExamples],
  ] as const;

  test.each(pairs)(
    "対の2つで、判定する数字の光の進み方が違うこと: %s",
    (_, [left, right]) => {
      const leftTrace = traceReflectionLaser(left.board, getFocusEntry(left));
      const rightTrace = traceReflectionLaser(
        right.board,
        getFocusEntry(right),
      );

      expect([
        leftTrace.outcome,
        leftTrace.distance,
        leftTrace.exit,
      ]).not.toEqual([
        rightTrace.outcome,
        rightTrace.distance,
        rightTrace.exit,
      ]);
    },
  );

  test.each(pairs)("描く数字がどれも合っていること: %s", (_, examples) => {
    const unmatched = examples.flatMap((example) =>
      (example.visibleEntries ?? []).filter(
        (entry) => !isMatchedAtStart(example, entry),
      ),
    );

    expect(unmatched).toEqual([]);
  });
});

describe("completionRuleExample", () => {
  const boards = listHandBoards(completionRuleExample);

  test("例が見せる手を打ち終えると、本番の判定で完成すること", () => {
    const status = boards.at(-1)?.session.status;

    expect(status).toBe("cleared");
  });

  test("例が見せる手の途中では完成しないこと", () => {
    const statuses = boards.slice(0, -1).map(({ session }) => session.status);

    expect(statuses.every((status) => status === "playing")).toBe(true);
  });
});

describe("swapOperationExample", () => {
  const boards = listHandBoards(swapOperationExample);

  test("置き換えた後に戻すと、置いたピースがすべてストックに戻ること", () => {
    const cells = boards.at(-1)?.session.puzzleState.cells ?? [];

    expect(boards[2]?.session.puzzleState.cells[4]).toBe("backslash");
    expect(cells.every((cell) => cell === null)).toBe(true);
  });
});

describe("goalFigure", () => {
  const pieceCells = goalFigure.solution.cells.flatMap((cell, index) =>
    cell === null ? [] : [index],
  );

  test("置く順に、解き終えた盤面のピースのマスをすべて1回ずつ並べること", () => {
    const ordered = [...goalFigure.order].sort((left, right) => left - right);

    expect(ordered).toEqual(pieceCells);
  });
});
