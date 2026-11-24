import { act, cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";

import {
  enterMagicSquareSessionValue,
  selectMagicSquareSessionCell,
} from "@/games/magic-square/session/session";
import type { MagicSquareBoard } from "@/games/magic-square/ui/board/MagicSquareBoard";
import { ExampleBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/ExampleBoard";
import { createMagicSquareExampleSession } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";

type MagicSquareBoardProps = ComponentProps<typeof MagicSquareBoard>;

const boardProps = vi.hoisted(() => ({ calls: [] as MagicSquareBoardProps[] }));

vi.mock("@/games/magic-square/ui/board/MagicSquareBoard", () => ({
  MagicSquareBoard: (props: MagicSquareBoardProps) => {
    boardProps.calls.push(props);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  boardProps.calls = [];
});

const wholeBoard = { row: 0, column: 0, rowCount: 4, columnCount: 4 };

/** 最後の空き（3行3列）に12を置くと解き終える盤面。 */
const unsolved = selectMagicSquareSessionCell(
  createMagicSquareExampleSession({
    region: wholeBoard,
    rows: ["14 4 5 11", "9 2 7 16", "8 13 . 1", "3 15 10 6"],
  }),
  10,
);
const solved = enterMagicSquareSessionValue(unsolved, 12, 0);

function readClearing(): boolean | undefined {
  return boardProps.calls.at(-1)?.clearing;
}

describe("ExampleBoard", () => {
  test("解き終えていない盤面では、クリア演出を流さないこと", () => {
    render(
      <ExampleBoard
        session={unsolved}
        region={wholeBoard}
        selectedCellIndex={null}
      />,
    );

    expect(readClearing()).toBe(false);
  });

  describe("解き終えた盤面を描いた場合", () => {
    test("クリア演出を流し、終わったら描き直しても流し直さないこと", () => {
      const { rerender } = render(
        <ExampleBoard
          session={solved}
          region={wholeBoard}
          selectedCellIndex={null}
        />,
      );
      const clearingAtFirst = readClearing();

      act(() => boardProps.calls.at(-1)?.onClearAnimationComplete());
      rerender(
        <ExampleBoard
          session={{ ...solved }}
          region={wholeBoard}
          selectedCellIndex={null}
        />,
      );

      expect([clearingAtFirst, readClearing()]).toEqual([true, false]);
    });

    test("描き直しても、演出の完了を知らせる関数を替えないこと", () => {
      const { rerender } = render(
        <ExampleBoard
          session={solved}
          region={wholeBoard}
          selectedCellIndex={null}
        />,
      );
      const first = boardProps.calls.at(-1)?.onClearAnimationComplete;

      rerender(
        <ExampleBoard
          session={{ ...solved }}
          region={wholeBoard}
          selectedCellIndex={null}
        />,
      );

      expect(boardProps.calls.at(-1)?.onClearAnimationComplete).toBe(first);
    });
  });
});
