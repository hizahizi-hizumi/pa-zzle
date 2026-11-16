import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";
import {
  createSlidePuzzleSession,
  slideSlidePuzzleSessionTile,
} from "@/games/slide-puzzle/session/session";
import {
  carryRuleExamples,
  goalFigure,
  lineRuleExample,
  moveCountFlows,
  solvedRuleExamples,
  tapOperationExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";

/** 押したタイルを本番の遷移で順にスライドさせる。スライドしないタイルがあれば `null`。 */
function slideTiles(
  board: SlidePuzzleBoard,
  tiles: readonly number[],
): SlidePuzzleBoard | null {
  let current: SlidePuzzleBoard | null = board;
  for (const tile of tiles) {
    if (current === null) {
      return null;
    }
    const slide = getSlidePuzzleSlide(current, current.indexOf(tile));
    current = slide === null ? null : applySlidePuzzleSlide(current, slide);
  }
  return current;
}

describe("goalFigure", () => {
  test("始まりの盤面から、押すタイルを本番の遷移で順にスライドさせると完成すること", () => {
    const board = slideTiles(goalFigure.start, goalFigure.tappedTiles);

    expect(board === null ? false : isSlidePuzzleSolved(board)).toBe(true);
  });

  test("最後の手より前では完成しないこと", () => {
    const boards = goalFigure.tappedTiles
      .slice(0, -1)
      .map((_, index) =>
        slideTiles(
          goalFigure.start,
          goalFigure.tappedTiles.slice(0, index + 1),
        ),
      );

    expect(
      boards.map((board) =>
        board === null ? null : isSlidePuzzleSolved(board),
      ),
    ).toEqual(boards.map(() => false));
  });

  test("離れたタイルごとまとめてスライドする手を含むこと", () => {
    const counts: number[] = [];
    let board: SlidePuzzleBoard = goalFigure.start;
    for (const tile of goalFigure.tappedTiles) {
      const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
      counts.push(slide?.movedTileIndices.length ?? 0);
      board = slide === null ? board : applySlidePuzzleSlide(board, slide);
    }

    expect(Math.max(...counts)).toBeGreaterThan(1);
    expect(counts).not.toContain(0);
  });
});

describe("lineRuleExample", () => {
  test("手がかりのタイルは、空白の隣で1枚だけスライドすること", () => {
    const { board, hintTiles } = lineRuleExample;

    const slide = getSlidePuzzleSlide(board, board.indexOf(hintTiles[0] ?? 0));

    expect(slide?.movedTileIndices).toHaveLength(1);
  });
});

describe("carryRuleExamples", () => {
  test("同じ盤面で、手がかりのタイルを押すと1枚と2枚スライドすること", () => {
    const counts = carryRuleExamples.map(
      ({ board, hintTiles }) =>
        getSlidePuzzleSlide(board, board.indexOf(hintTiles[0] ?? 0))
          ?.movedTileIndices.length,
    );

    expect(carryRuleExamples[0].board).toEqual(carryRuleExamples[1].board);
    expect(counts).toEqual([1, 2]);
  });

  test("手がかりの手で完成しないこと", () => {
    const solved = carryRuleExamples.map(({ board, hintTiles }) => {
      const after = slideTiles(board, hintTiles);
      return after === null ? null : isSlidePuzzleSolved(after);
    });

    expect(solved).toEqual([false, false]);
  });
});

describe("solvedRuleExamples", () => {
  const [solvedExample, unsolvedExample] = solvedRuleExamples;

  test("左は完成した盤面、右は番号順のまま空白が右下にない盤面であること", () => {
    const verdicts = solvedRuleExamples.map(({ board }) =>
      isSlidePuzzleSolved(board),
    );

    expect(verdicts).toEqual([true, false]);
    expect(unsolvedExample.board.filter((tile) => tile !== 0)).toEqual(
      solvedExample.board.filter((tile) => tile !== 0),
    );
  });

  test("完成した盤面には、完成を崩す手を誘う手がかりを付けないこと", () => {
    const hintTiles = solvedExample.hintTiles;

    expect(hintTiles).toEqual([]);
  });
});

describe("tapOperationExample", () => {
  test("手がかりのタイルを順に押すと完成すること", () => {
    const after = slideTiles(
      tapOperationExample.board,
      tapOperationExample.hintTiles,
    );

    expect(after === null ? null : isSlidePuzzleSolved(after)).toBe(true);
  });
});

describe("moveCountFlows", () => {
  const flows = [moveCountFlows.adjacent, moveCountFlows.distant] as const;

  test.each(flows)(
    "流れの手数が、本番の session で同じタイルを押して数えた手数と同じこと",
    ({ frames: [start, after], movedTileCount }) => {
      const next = slideSlidePuzzleSessionTile(
        createSlidePuzzleSession({ initialBoard: start.board }, 0),
        start.board.indexOf(start.tappedTile ?? 0),
        1,
      );

      expect(next.puzzleState).toEqual(after.board);
      expect(next.moveCount).toBe(movedTileCount);
    },
  );

  test("どちらの流れも同じ始まりの盤面から、1手と2手を数えること", () => {
    const starts = flows.map(({ frames }) => frames[0].board);
    const counts = flows.map(({ movedTileCount }) => movedTileCount);

    expect(starts[0]).toEqual(starts[1]);
    expect(counts).toEqual([1, 2]);
  });
});
