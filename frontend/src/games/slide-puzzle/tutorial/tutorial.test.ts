import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  isSolvableSlidePuzzleBoard,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  findSlidePuzzleBlankIndex,
  getSlidePuzzleBoardSize,
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";
import {
  _private,
  findSlidePuzzleTutorialHintCellIndex,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  slidePuzzleTutorial,
  slidePuzzleTutorialScrambleBoards,
} from "@/games/slide-puzzle/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { start, goal, remainingCellIndices } = _private;

type Progress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

function tap(progress: Progress, cellIndex: number): Progress {
  return performTutorialAction(slidePuzzleTutorial, progress, {
    type: "tap",
    cellIndex,
  });
}

/** 最初の `count` 個の手順を、印のタイルを押して終える。 */
function finishSteps(count: number): Progress {
  return slidePuzzleTutorial.steps
    .slice(0, count)
    .reduce(
      (progress, step) => tap(progress, step.cellIndex),
      finishTutorialIntro(startTutorial(slidePuzzleTutorial)),
    );
}

function slideTile(
  board: SlidePuzzleBoard,
  cellIndex: number,
): SlidePuzzleBoard {
  const slide = getSlidePuzzleSlide(board, cellIndex);
  if (!slide) {
    throw new Error(`cell ${cellIndex} cannot slide`);
  }
  return applySlidePuzzleSlide(board, slide);
}

function listNeighborBoards(board: SlidePuzzleBoard): SlidePuzzleBoard[] {
  return listSlidePuzzleSingleMoves(board).map((cellIndex) =>
    slideTile(board, cellIndex),
  );
}

/** 1枚ずつ滑らせる手で、解き終えるまでの最短手数と、最短の解き方の数を幅優先で数える。 */
function countShortestSolutions(board: SlidePuzzleBoard): {
  moveCount: number;
  solutionCount: number;
} {
  let layer = new Map([[board.join(","), { board, count: 1 }]]);
  const seen = new Set(layer.keys());
  for (let moveCount = 0; layer.size > 0; moveCount += 1) {
    const solved = [...layer.values()].find((entry) =>
      isSlidePuzzleSolved(entry.board),
    );
    if (solved) {
      return { moveCount, solutionCount: solved.count };
    }
    const next = new Map<string, { board: SlidePuzzleBoard; count: number }>();
    for (const entry of layer.values()) {
      for (const neighbor of listNeighborBoards(entry.board)) {
        const key = neighbor.join(",");
        if (seen.has(key) && !next.has(key)) {
          continue;
        }
        const current = next.get(key);
        next.set(key, {
          board: neighbor,
          count: (current?.count ?? 0) + entry.count,
        });
      }
    }
    for (const key of next.keys()) {
      seen.add(key);
    }
    layer = next;
  }
  throw new Error("unsolvable");
}

/** 押したタイルから空白までの、滑ったタイルがすべて番号順の場所に収まったか。 */
function settlesEveryMovedTile(
  board: SlidePuzzleBoard,
  cellIndex: number,
): boolean {
  const slide = getSlidePuzzleSlide(board, cellIndex);
  if (!slide) {
    return false;
  }
  const after = applySlidePuzzleSlide(board, slide);
  return slide.movedTileIndices.every((movedIndex) => {
    const tile = board[movedIndex];
    return after.indexOf(tile ?? -1) === (tile ?? 0) - 1;
  });
}

/** 空白の場所に番号順で入るタイルのマス。 */
function findTileForBlank(board: SlidePuzzleBoard): number {
  return board.indexOf(goal[findSlidePuzzleBlankIndex(board)] ?? -1);
}

const stepCases = slidePuzzleTutorial.steps.map(
  (step, stepIndex) =>
    [
      stepIndex + 1,
      { step, board: finishSteps(stepIndex).boardState.board },
    ] as const,
);

/** 手順と残りの押し方。 */
const solutionCellIndices = [
  ...slidePuzzleTutorial.steps.map((step) => step.cellIndex),
  ...remainingCellIndices,
];

/** 手順と残りを押すごとの、押す前の盤面。 */
const solutionBoardsBeforeTap = solutionCellIndices.reduce<SlidePuzzleBoard[]>(
  (boards, cellIndex) => {
    boards.push(slideTile(boards.at(-1) ?? start, cellIndex));
    return boards;
  },
  [start],
);

/** 手順と残りの押し方で滑るタイルの枚数の合計。 */
const solutionMovedTileCount = solutionCellIndices.reduce(
  (count, cellIndex, index) =>
    count +
    (getSlidePuzzleSlide(solutionBoardsBeforeTap[index] ?? [], cellIndex)
      ?.movedTileIndices.length ?? 0),
  0,
);

describe("slidePuzzleTutorial", () => {
  describe("盤面", () => {
    test("レベル1と同じ 3×3 で、解ける盤面であること", () => {
      const size = getSlidePuzzleBoardSize(start);
      const solvable = isSolvableSlidePuzzleBoard(start);

      expect(size).toBe(3);
      expect(solvable).toBe(true);
    });

    test("最短の解き方が1通りで、手順と残りの押し方がその解き方をたどること", () => {
      const { moveCount, solutionCount } = countShortestSolutions(start);
      const solved = solutionCellIndices.reduce(
        (progress, cellIndex) => tap(progress, cellIndex),
        finishTutorialIntro(startTutorial(slidePuzzleTutorial)),
      );

      expect(solutionCount).toBe(1);
      expect(solutionMovedTileCount).toBe(moveCount);
      expect(solved.phase).toBe("solved");
    });

    test("導入で崩していく盤面が、完成した盤面から1回押すごとに始めの盤面へ至ること", () => {
      const boards = slidePuzzleTutorialScrambleBoards;

      expect(boards).toEqual([...solutionBoardsBeforeTap].reverse());
      expect(boards[0]).toEqual(goal);
      expect(boards.at(-1)).toEqual(start);
    });
  });

  describe("手順", () => {
    test.each(stepCases)(
      "%i番目の手順の印は、空白の場所に入る番号のタイルで、押すと滑ったタイルがすべて番号順の場所に収まること",
      (_, { step, board }) => {
        const tileForBlank = findTileForBlank(board);
        const slide = getSlidePuzzleSlide(board, step.cellIndex);
        const settles = settlesEveryMovedTile(board, step.cellIndex);

        expect(slide?.movedTileIndices.at(0)).toBe(tileForBlank);
        expect(settles).toBe(true);
      },
    );

    test("ルールを示す手順はすぐ印を付け、知っているルールだけで読む手順は手が止まるまで印を付けないこと", () => {
      const cues = slidePuzzleTutorial.steps.map((step) => ({
        introducesRule: step.introducedRuleId !== null,
        cue: step.cue,
      }));

      expect(cues).toEqual([
        { introducesRule: true, cue: "immediate" },
        { introducesRule: true, cue: "immediate" },
        { introducesRule: false, cue: "whenStuck" },
      ]);
    });

    const lineStepIndex = slidePuzzleTutorial.steps.findIndex(
      (step) => step.introducedRuleId === "line",
    );

    test("まとめて滑ることを示す手順だけが、空白から離れたタイルを押す手であること", () => {
      const movedCounts = stepCases.map(
        ([, { step, board }]) =>
          getSlidePuzzleSlide(board, step.cellIndex)?.movedTileIndices.length,
      );

      expect(movedCounts).toEqual(
        slidePuzzleTutorial.steps.map((_, index) =>
          index === lineStepIndex ? 2 : 1,
        ),
      );
    });

    const lineStep = stepCases.find(
      ([, { step }]) => step.introducedRuleId === "line",
    );
    const lineCellIndex = lineStep?.[1].step.cellIndex ?? -1;
    const lineBoard = lineStep?.[1].board ?? [];

    test("1手目で空白が動いたことで、まとめて滑らせるタイルが空白と同じ行に入ること", () => {
      const beforeFirstMove = getSlidePuzzleSlide(start, lineCellIndex);
      const afterFirstMove = getSlidePuzzleSlide(lineBoard, lineCellIndex);

      expect(beforeFirstMove).toBeNull();
      expect(afterFirstMove?.direction).toBe("right");
    });

    const firstStepProgress = finishSteps(0);
    const ignoredCases = [
      [
        "印の無い動くタイル",
        listSlidePuzzleSingleMoves(start).find(
          (cellIndex) => cellIndex !== slidePuzzleTutorial.steps[0]?.cellIndex,
        ) ?? -1,
      ],
      ["空白", findSlidePuzzleBlankIndex(start)],
    ] as const;

    test.each(ignoredCases)(
      "%sを押しても、盤面を変えないこと",
      (_, cellIndex) => {
        const next = tap(firstStepProgress, cellIndex);

        expect(next).toBe(firstStepProgress);
      },
    );

    function createRejectedCase(stepCount: number) {
      const progress = finishSteps(stepCount);
      const board = progress.boardState.board;
      const immovable = board.findIndex(
        (tile, cellIndex) =>
          tile !== 0 && getSlidePuzzleSlide(board, cellIndex) === null,
      );
      return { progress, board, immovable };
    }

    const rejectedCases = [
      [
        "まとめて滑ることを示す前",
        createRejectedCase(0),
        "このタイルは、空白の隣にありません",
        "空白の隣のタイルが、空白にスライドします",
      ],
      [
        "まとめて滑ることを示した後",
        createRejectedCase(2),
        "空白の行にも列にもないタイルです",
        "空白と同じ行・列のタイルがスライドします",
      ],
    ] as const;

    test.each(rejectedCases)(
      "%sに動かないタイルを押すと、盤面を変えずに違反とし、動くタイルの決まりを言うこと",
      (_, { progress, board, immovable }, headline, detail) => {
        const next = tap(progress, immovable);
        const message = slidePuzzleTutorial.describeViolation(
          getTutorialSituation(slidePuzzleTutorial, next),
          next.boardState,
        );

        expect(next.violated).toBe(true);
        expect(next.boardState.board).toEqual(board);
        expect(next.boardState.lastMove).toEqual({
          type: "rejected",
          cellIndex: immovable,
        });
        expect(message).toEqual({ headline, detail });
      },
    );
  });

  describe("手を離した後", () => {
    const freeProgress = finishSteps(slidePuzzleTutorial.steps.length);
    const freeSituation = getTutorialSituation(
      slidePuzzleTutorial,
      freeProgress,
    );
    const remainingCases = remainingCellIndices.map(
      (cellIndex, index) =>
        [
          index + 1,
          {
            cellIndex,
            board:
              solutionBoardsBeforeTap[
                slidePuzzleTutorial.steps.length + index
              ] ?? [],
          },
        ] as const,
    );

    test.each(remainingCases)(
      "残りの%i手目は、空白の場所に入る番号のタイルで、押すとそのタイルが収まり、手が止まったときにそのタイルを示すこと",
      (_, { cellIndex, board }) => {
        const settles = settlesEveryMovedTile(board, cellIndex);
        const tileForBlank = findTileForBlank(board);
        const hint = findSlidePuzzleTutorialHintCellIndex(freeSituation, {
          board,
          moveCount: 0,
          lastMove: null,
        });

        expect(tileForBlank).toBe(cellIndex);
        expect(settles).toBe(true);
        expect(hint).toBe(cellIndex);
      },
    );

    const freeBoard = freeProgress.boardState.board;
    const offPathCellIndex =
      listSlidePuzzleSingleMoves(freeBoard).find(
        (cellIndex) => cellIndex !== remainingCellIndices[0],
      ) ?? -1;
    const wandered = slideTile(freeBoard, offPathCellIndex);

    test("印の無いタイルも滑らせられること", () => {
      const next = tap(freeProgress, offPathCellIndex);

      expect(next.phase).toBe("playing");
      expect(next.boardState.board).toEqual(wandered);
    });

    test("解き方から外れても、手が止まったときに最短で戻る1枚を示すこと", () => {
      const hint = findSlidePuzzleTutorialHintCellIndex(freeSituation, {
        board: wandered,
        moveCount: 0,
        lastMove: null,
      });
      const after = slideTile(wandered, hint ?? -1);

      expect(countShortestSolutions(after).moveCount).toBe(
        countShortestSolutions(wandered).moveCount - 1,
      );
    });
  });
});
