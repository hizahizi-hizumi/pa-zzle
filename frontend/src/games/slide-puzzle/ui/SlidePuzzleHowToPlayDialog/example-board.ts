import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  type SlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleHowToPlayExample = {
  board: SlidePuzzleBoard;
  /** 例が見せる手として、手がかりで順に示すタイル。 */
  hintTiles: readonly SlidePuzzleTile[];
};

/** 手がかりのタイルを1つ以上持つ例。 */
export type SlidePuzzleHintedExample = SlidePuzzleHowToPlayExample & {
  hintTiles: readonly [SlidePuzzleTile, ...SlidePuzzleTile[]];
};

type SlidePuzzleExampleMove =
  | { type: "slid"; slide: SlidePuzzleSlide; boardBefore: SlidePuzzleBoard }
  | { type: "rejected"; tileIndex: number };

export type SlidePuzzleExampleState = {
  board: SlidePuzzleBoard;
  lastMove: SlidePuzzleExampleMove | null;
};

export function createSlidePuzzleExampleState(
  example: SlidePuzzleHowToPlayExample,
): SlidePuzzleExampleState {
  return { board: example.board, lastMove: null };
}

/** 本番の盤面と同じく、押したタイルをスライドさせるか弾く。空白を押したときは何も変えず、受け取った状態を返す。 */
export function tapSlidePuzzleExampleTile(
  state: SlidePuzzleExampleState,
  cellIndex: number,
): SlidePuzzleExampleState {
  const tile = state.board[cellIndex];
  if (tile === undefined || tile === SLIDE_PUZZLE_BLANK) {
    return state;
  }
  const slide = getSlidePuzzleSlide(state.board, cellIndex);
  if (slide === null) {
    return {
      board: state.board,
      lastMove: { type: "rejected", tileIndex: cellIndex },
    };
  }
  return {
    board: applySlidePuzzleSlide(state.board, slide),
    lastMove: { type: "slid", slide, boardBefore: state.board },
  };
}

export function isSameSlidePuzzleBoard(
  left: SlidePuzzleBoard,
  right: SlidePuzzleBoard,
): boolean {
  return (
    left.length === right.length &&
    left.every((tile, cellIndex) => tile === right[cellIndex])
  );
}

/** 手がかりのタイルを最初から順にスライドさせていった盤面。最初の盤面から始まる。 */
function listHintedBoards(
  example: SlidePuzzleHowToPlayExample,
): SlidePuzzleBoard[] {
  const boards = [example.board];
  for (const tile of example.hintTiles) {
    const board = boards.at(-1) ?? example.board;
    const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
    if (slide === null) {
      break;
    }
    boards.push(applySlidePuzzleSlide(board, slide));
  }
  return boards;
}

/**
 * 次に押す所の手がかりを付けるタイル。手がかりどおりに押していく途中の盤面でだけ付け、手の続きが無ければ付けない。
 * 弾かれた後は、盤面が変わるまで付けない。
 */
export function findSlidePuzzleExampleHintTile(
  example: SlidePuzzleHowToPlayExample,
  state: SlidePuzzleExampleState,
): SlidePuzzleTile | null {
  if (state.lastMove?.type === "rejected") {
    return null;
  }
  const step = listHintedBoards(example).findIndex((board) =>
    isSameSlidePuzzleBoard(board, state.board),
  );
  return step < 0 ? null : (example.hintTiles[step] ?? null);
}

/** 盤面のタイルごとに、今押すとスライドするか。 */
export function judgeSlidePuzzleExampleTiles(
  board: SlidePuzzleBoard,
): ReadonlyMap<SlidePuzzleTile, boolean> {
  return new Map(
    board.flatMap((tile, cellIndex) =>
      tile === SLIDE_PUZZLE_BLANK
        ? []
        : [[tile, getSlidePuzzleSlide(board, cellIndex) !== null] as const],
    ),
  );
}

/** タイルを押したときにスライドする枚数。スライドしなければ 0。 */
export function countSlidePuzzleExampleSlidingTiles(
  board: SlidePuzzleBoard,
  tile: SlidePuzzleTile,
): number {
  return (
    getSlidePuzzleSlide(board, board.indexOf(tile))?.movedTileIndices.length ??
    0
  );
}

export const _private = { listHintedBoards };
