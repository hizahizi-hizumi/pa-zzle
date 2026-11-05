import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { _private } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard/IceFloorMazeTutorialLayer";

const { mergeCellRects } = _private;

describe("mergeCellRects", () => {
  const board = parseIceFloorMazeBoard(["....", "....", "....", "...."]);

  const cases = [
    {
      name: "横に続くマスを1つの長方形にまとめること",
      cells: [4, 5, 6],
      expected: [{ x: 0, y: 1, width: 3, height: 1 }],
    },
    {
      name: "縦に続くマスを1つの長方形にまとめること",
      cells: [1, 5, 9, 13],
      expected: [{ x: 1, y: 0, width: 1, height: 4 }],
    },
    {
      name: "離れたマスと、幅の違う並びは分けたままにすること",
      cells: [0, 2, 3, 6, 7, 15],
      expected: [
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 2, y: 0, width: 2, height: 2 },
        { x: 3, y: 3, width: 1, height: 1 },
      ],
    },
  ];

  test.each(cases)("$name", ({ cells, expected }) => {
    const rects = mergeCellRects(board, cells);

    expect(rects).toEqual(expected);
  });
});
