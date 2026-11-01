import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { createNonogramProblem } from "@/games/nonogram/problem/problem";
import { parseNonogramBoard } from "@/games/nonogram/puzzle/board";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { findNonogramMatchedLines } from "@/games/nonogram/puzzle/rules";
import type { NonogramMark } from "@/games/nonogram/session/session";
import { NonogramBoard } from "@/games/nonogram/ui/board/NonogramBoard";

const { clues } = createNonogramProblem(
  parseNonogramPattern(["#.#", "###", ".#."]),
);
const board = parseNonogramBoard(["...", "...", "..."]);
/** 盤面の要素の画面上の位置。3×3 の盤面なので、1マスは 30px 四方になる。 */
const boardRect = {
  left: 100,
  top: 200,
  right: 190,
  bottom: 290,
  width: 90,
  height: 90,
};
const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch" };

afterEach(() => {
  cleanup();
});

describe("NonogramBoard", () => {
  let onStartStroke: ReturnType<
    typeof vi.fn<(cellIndex: number, mark: NonogramMark) => void>
  >;
  let onExtendStroke: ReturnType<typeof vi.fn<(cellIndex: number) => void>>;
  let boardElement: HTMLElement;

  beforeEach(() => {
    onStartStroke = vi.fn();
    onExtendStroke = vi.fn();
    render(
      <NonogramBoard
        board={board}
        clues={clues}
        matchedLines={findNonogramMatchedLines(board, clues)}
        strokeRange={null}
        mark="filled"
        interactionDisabled={false}
        revealed={false}
        onStartStroke={onStartStroke}
        onExtendStroke={onExtendStroke}
        onEndStroke={vi.fn()}
      />,
    );
    boardElement = screen.getByRole("group", { name: "ノノグラム盤面" });
    vi.spyOn(boardElement, "getBoundingClientRect").mockReturnValue(
      boardRect as DOMRect,
    );
  });

  describe("中央のマスを押してなぞった場合", () => {
    beforeEach(() => {
      fireEvent.pointerDown(
        within(boardElement).getByRole("button", { name: "2行2列 未確定" }),
        { ...pointer, button: 0 },
      );
    });

    const cases = [
      ["盤面の中の右上のマス", 165, 215, 2],
      ["盤面の右の外", 400, 255, 5],
      ["盤面の左上の外", 0, 0, 0],
      ["盤面の下の外", 145, 500, 7],
    ] as const;

    test.each(cases)(
      "%sの位置まで動かすと、そこから最も近いマスまで入力を延ばすこと",
      (_, clientX, clientY, expectedCellIndex) => {
        fireEvent.pointerMove(boardElement, { ...pointer, clientX, clientY });

        expect(onStartStroke).toHaveBeenCalledWith(4, "filled");
        expect(onExtendStroke).toHaveBeenCalledWith(expectedCellIndex);
      },
    );

    test("押したマスの中で動かしても入力を延ばさないこと", () => {
      fireEvent.pointerMove(boardElement, {
        ...pointer,
        clientX: 140,
        clientY: 250,
      });

      expect(onExtendStroke).not.toHaveBeenCalled();
    });
  });
});
