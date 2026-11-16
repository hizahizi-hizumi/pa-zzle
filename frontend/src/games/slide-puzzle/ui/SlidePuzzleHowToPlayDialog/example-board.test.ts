import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import {
  _private,
  countSlidePuzzleExampleSlidingTiles,
  createSlidePuzzleExampleState,
  findSlidePuzzleExampleHintTile,
  judgeSlidePuzzleExampleTiles,
  type SlidePuzzleHowToPlayExample,
  tapSlidePuzzleExampleTile,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/example-board";

const { listHintedBoards } = _private;

/**
 * ```text
 * 5 1 3
 * 2 8 6
 * _ 4 7
 * ```
 */
const board: SlidePuzzleBoard = [5, 1, 3, 2, 8, 6, 0, 4, 7];
const example: SlidePuzzleHowToPlayExample = { board, hintTiles: [4, 8] };

describe("tapSlidePuzzleExampleTile", () => {
  const state = createSlidePuzzleExampleState(example);

  test.each([
    ["隣のタイル", 7],
    ["同じ行の離れたタイル", 8],
    ["同じ列の離れたタイル", 0],
  ])("%sを押すと、本番の遷移でスライドさせること", (_, cellIndex) => {
    const slide = getSlidePuzzleSlide(board, cellIndex);

    const next = tapSlidePuzzleExampleTile(state, cellIndex);

    expect(slide).not.toBeNull();
    expect(next.board).toEqual(
      slide === null ? null : applySlidePuzzleSlide(board, slide),
    );
    expect(next.lastMove).toEqual({ type: "slid", slide, boardBefore: board });
  });

  test("空白と同じ行・列にないタイルを押すと、盤面を変えずに弾いたことを残すこと", () => {
    const next = tapSlidePuzzleExampleTile(state, 1);

    expect(next.board).toBe(board);
    expect(next.lastMove).toEqual({ type: "rejected", tileIndex: 1 });
  });

  test("空白を押しても、受け取った状態を返すこと", () => {
    const next = tapSlidePuzzleExampleTile(state, 6);

    expect(next).toBe(state);
  });
});

describe("findSlidePuzzleExampleHintTile", () => {
  const start = createSlidePuzzleExampleState(example);
  const afterFirstHint = tapSlidePuzzleExampleTile(start, 7);
  const afterBothHints = tapSlidePuzzleExampleTile(afterFirstHint, 4);
  const offPath = tapSlidePuzzleExampleTile(start, 3);
  const rejected = tapSlidePuzzleExampleTile(start, 1);
  const backToStart = tapSlidePuzzleExampleTile(afterFirstHint, 6);

  test.each([
    ["最初の盤面では、1つ目の手がかりのタイル", start, 4],
    [
      "手がかりどおりに1手押した盤面では、次の手がかりのタイル",
      afterFirstHint,
      8,
    ],
    ["手がかりの手を押し終えた盤面では、付けない", afterBothHints, null],
    ["手がかりと別の手を押した盤面では、付けない", offPath, null],
    ["弾かれた後は、付けない", rejected, null],
    ["スライドさせて最初の盤面に戻ると、また付ける", backToStart, 4],
  ])("%sを返すこと", (_, state, expected) => {
    const hintTile = findSlidePuzzleExampleHintTile(example, state);

    expect(hintTile).toBe(expected);
  });
});

describe("listHintedBoards", () => {
  test("手がかりのタイルを本番の遷移で順にスライドさせた盤面を並べること", () => {
    const boards = listHintedBoards(example);

    expect(boards).toEqual([
      board,
      [5, 1, 3, 2, 8, 6, 4, 0, 7],
      [5, 1, 3, 2, 0, 6, 4, 8, 7],
    ]);
  });
});

describe("judgeSlidePuzzleExampleTiles", () => {
  test("どのタイルにも、本番の判定でスライドするかを返すこと", () => {
    const verdicts = judgeSlidePuzzleExampleTiles(board);

    expect(Object.fromEntries(verdicts)).toEqual(
      Object.fromEntries(
        board.flatMap((tile, cellIndex) =>
          tile === 0
            ? []
            : [[tile, getSlidePuzzleSlide(board, cellIndex) !== null]],
        ),
      ),
    );
    expect(
      [...verdicts].filter(([, slides]) => slides).map(([tile]) => tile),
    ).toEqual([5, 2, 4, 7]);
  });
});

describe("countSlidePuzzleExampleSlidingTiles", () => {
  test.each([
    [4, 1],
    [7, 2],
    [1, 0],
  ])("タイル %i を押すと %i 枚スライドすること", (tile, expected) => {
    const count = countSlidePuzzleExampleSlidingTiles(board, tile);

    expect(count).toBe(expected);
  });
});
