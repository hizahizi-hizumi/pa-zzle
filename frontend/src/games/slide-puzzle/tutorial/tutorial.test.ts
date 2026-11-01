import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  isSolvableSlidePuzzleBoard,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  calculateSlidePuzzleManhattanDistance,
  findSlidePuzzleBlankIndex,
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import {
  _private,
  findSlidePuzzleTutorialHintTile,
  getSlidePuzzleTutorialStepTile,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  type SlidePuzzleTutorialStep,
  slidePuzzleTutorial,
  slidePuzzleTutorialScrambleBoards,
} from "@/games/slide-puzzle/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
  type TutorialSituation,
} from "@/games/tutorial";

const {
  startBoard,
  goalBoard,
  getTileForBlank,
  listBoardsByReading,
  findNextShortestMoveCellIndex,
} = _private;

type Progress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

const { steps } = slidePuzzleTutorial;

function slideTile(board: SlidePuzzleBoard, tile: SlidePuzzleTile) {
  const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
  return slide ? applySlidePuzzleSlide(board, slide) : null;
}

/** 盤面を、手順のタイルを順にスライドさせて進める。 */
function playSteps(count: number): SlidePuzzleBoard {
  return steps
    .slice(0, count)
    .reduce(
      (board, step) => slideTile(board, step.tile) ?? board,
      startBoard as SlidePuzzleBoard,
    );
}

/** 距離を1つずつ縮める手だけで完成までたどる道の数。最短手数が距離と同じなら、最短の解き方の数になる。 */
function countShortestPaths(board: SlidePuzzleBoard): number {
  if (isSlidePuzzleSolved(board)) {
    return 1;
  }
  const distance = calculateSlidePuzzleManhattanDistance(board);
  return listSlidePuzzleSingleMoves(board).reduce((count, cellIndex) => {
    const slide = getSlidePuzzleSlide(board, cellIndex);
    const next = slide ? applySlidePuzzleSlide(board, slide) : board;
    return calculateSlidePuzzleManhattanDistance(next) < distance
      ? count + countShortestPaths(next)
      : count;
  }, 0);
}

function getProgressAfter(
  progress: Progress,
  cellIndices: readonly number[],
): Progress {
  return cellIndices.reduce(
    (current, cellIndex) =>
      performTutorialAction(slidePuzzleTutorial, current, { cellIndex }),
    progress,
  );
}

function tapTiles(progress: Progress, tiles: readonly SlidePuzzleTile[]) {
  return tiles.reduce(
    (current, tile) =>
      performTutorialAction(slidePuzzleTutorial, current, {
        cellIndex: current.boardState.board.indexOf(tile),
      }),
    progress,
  );
}

describe("盤面", () => {
  test("始めの盤面が、崩れていて、ゴールへたどり着けること", () => {
    const solvable = isSolvableSlidePuzzleBoard(startBoard);
    const solved = isSlidePuzzleSolved(startBoard);

    expect(solvable).toBe(true);
    expect(solved).toBe(false);
  });

  test("最短で完成させる解き方が1通りだけで、8手で完成すること", () => {
    const distance = calculateSlidePuzzleManhattanDistance(startBoard);
    const pathCount = countShortestPaths(startBoard);

    expect(distance).toBe(8);
    expect(pathCount).toBe(1);
  });

  test("導入で崩していく盤面が、ゴールから1手ずつ始めの盤面へ進むこと", () => {
    const boards = slidePuzzleTutorialScrambleBoards;
    const reachable = boards.slice(1).every((board, index) => {
      const before = boards[index] ?? [];
      return listSlidePuzzleSingleMoves(before).some((cellIndex) => {
        const slide = getSlidePuzzleSlide(before, cellIndex);
        return (
          slide !== null &&
          applySlidePuzzleSlide(before, slide).join() === board.join()
        );
      });
    });

    expect(boards[0]).toEqual(goalBoard);
    expect(boards.at(-1)).toEqual(startBoard);
    expect(reachable).toBe(true);
  });
});

describe("手順", () => {
  const ruleCases = steps.map(
    (step, index) => [index + 1, step, playSteps(index)] as const,
  );

  test.each(ruleCases)(
    "%i 手目のタイルをスライドさせると、動いたタイルがすべて自分の場所に収まり、その1枚目が空白に入る番号であること",
    (_, step, board) => {
      const slide = getSlidePuzzleSlide(board, board.indexOf(step.tile));
      const next = slide ? applySlidePuzzleSlide(board, slide) : board;
      const movedTiles = (slide?.movedTileIndices ?? []).map(
        (cellIndex) => board[cellIndex],
      );
      const landed = movedTiles.every(
        (tile) => tile !== undefined && next.indexOf(tile) === tile - 1,
      );

      expect(movedTiles[0]).toBe(getTileForBlank(board));
      expect(landed).toBe(true);
    },
  );

  const introducingCases: readonly (readonly [
    SlidePuzzleTutorialRuleId,
    number,
  ])[] = [
    ["slide", 1],
    ["line", 2],
  ];

  test.each(introducingCases)(
    "%s を示す手順では、そのルールでスライドする枚数だけタイルが動くこと",
    (ruleId, movedCount) => {
      const index = steps.findIndex((step) => step.introducedRuleId === ruleId);
      const step = steps[index] as SlidePuzzleTutorialStep;
      const board = playSteps(index);
      const slide = getSlidePuzzleSlide(board, board.indexOf(step.tile));

      expect(slide?.movedTileIndices).toHaveLength(movedCount);
    },
  );

  test("手順を終えた後の残りを、空白に入る番号をスライドさせ続けるだけで完成させられること", () => {
    const boards = listBoardsByReading(playSteps(steps.length));

    const last = boards.at(-1) ?? [];

    expect(isSlidePuzzleSolved(last)).toBe(true);
    expect(boards.length - 1).toBe(4);
  });

  test("手順を終えた後の残りに、行と列それぞれでまとめてスライドさせられる所があること", () => {
    const board = playSteps(steps.length);
    const blankIndex = findSlidePuzzleBlankIndex(board);
    const rowSlide = getSlidePuzzleSlide(board, 2);
    const afterRow = rowSlide ? applySlidePuzzleSlide(board, rowSlide) : board;
    const columnSlide = getSlidePuzzleSlide(afterRow, 8);
    const afterColumn = columnSlide
      ? applySlidePuzzleSlide(afterRow, columnSlide)
      : afterRow;

    expect(blankIndex).toBe(0);
    expect(rowSlide?.movedTileIndices).toHaveLength(2);
    expect(columnSlide?.movedTileIndices).toHaveLength(2);
    expect(isSlidePuzzleSolved(afterColumn)).toBe(true);
  });
});

describe("performTutorialAction", () => {
  const started = finishTutorialIntro(startTutorial(slidePuzzleTutorial));
  const firstStepCellIndex = startBoard.indexOf(steps[0]?.tile ?? 0);
  // 1手目の 5 の隣にあり、空白と同じ行にあるタイル。
  const otherSlidableCellIndex = startBoard.indexOf(7);
  const released = tapTiles(
    started,
    steps.map((step) => step.tile),
  );

  test("手を引いている間は、印のタイルだけをスライドさせて次の手順へ進むこと", () => {
    const ignored = getProgressAfter(started, [otherSlidableCellIndex]);
    const stepped = getProgressAfter(started, [firstStepCellIndex]);

    expect(ignored).toBe(started);
    expect(stepped.stepIndex).toBe(1);
    expect(stepped.boardState.lastMove).toMatchObject({
      type: "slid",
      landedTiles: [5],
    });
  });

  test("手順を進めるたびに、示したルールを手に入れること", () => {
    const earned = released.earnedRuleIds;

    expect(earned).toEqual(["slide", "line"]);
  });

  describe("手を離した後の場合", () => {
    // 空白は左上。3 は同じ行・列にない。
    const rejected = tapTiles(released, [3]);
    const slidAfterRejection = tapTiles(rejected, [1]);

    test("空白と同じ行・列にないタイルをタップすると、盤面を変えずにルールに合わない手として応えること", () => {
      const situation = getTutorialSituation(slidePuzzleTutorial, rejected);
      const message = getTutorialMessage(slidePuzzleTutorial, rejected, {
        entry: "selection",
        violationSettled: true,
      });

      expect(situation.step).toBeNull();
      expect(rejected.violated).toBe(true);
      expect(rejected.boardState.board).toEqual(released.boardState.board);
      expect(message).toEqual({
        headline: "3 のタイルは、\n空白と同じ行・列にありません",
        detail: "空白と同じ行・列のタイルだけがスライドします",
      });
    });

    test("次にスライドさせると、違反の一言を下げて残りを並べる一言に戻すこと", () => {
      const message = getTutorialMessage(
        slidePuzzleTutorial,
        slidAfterRejection,
        { entry: "selection", violationSettled: true },
      );

      expect(slidAfterRejection.violated).toBe(false);
      expect(message).toBe(slidePuzzleTutorial.freePlay);
    });

    test("行と列をまとめてスライドさせると完成すること", () => {
      const solved = tapTiles(released, [2, 6]);

      expect(solved.phase).toBe("solved");
    });
  });
});

describe("getSlidePuzzleTutorialStepTile", () => {
  const started = finishTutorialIntro(startTutorial(slidePuzzleTutorial));
  const situation: TutorialSituation<
    SlidePuzzleTutorialRuleId,
    SlidePuzzleTutorialStep
  > = getTutorialSituation(slidePuzzleTutorial, started);

  test("今の手順で印を付けるタイルを返すこと", () => {
    const tile = getSlidePuzzleTutorialStepTile(situation);

    expect(tile).toBe(5);
  });
});

describe("findSlidePuzzleTutorialHintTile", () => {
  const releasedBoard = playSteps(steps.length);
  // 空白を左上から右へ1つ動かし、1 を遠ざけた盤面。
  const detouredBoard = slideTile(releasedBoard, 1) ?? releasedBoard;
  const strayedBoard = slideTile(detouredBoard, 5) ?? detouredBoard;

  const cases = [
    ["手順を終えた盤面", releasedBoard, 1],
    ["1 を入れた後に 5 を動かして遠回りした盤面", strayedBoard, 5],
  ] as const;

  test.each(cases)(
    "%sで、最短で完成させるために次にスライドさせるタイルを返すこと",
    (_, board, expected) => {
      const tile = findSlidePuzzleTutorialHintTile({
        board,
        moveCount: 0,
        lastMove: null,
      });

      expect(tile).toBe(expected);
    },
  );

  test("完成した盤面では何も示さないこと", () => {
    const cellIndex = findNextShortestMoveCellIndex(goalBoard);

    expect(cellIndex).toBeNull();
  });
});
