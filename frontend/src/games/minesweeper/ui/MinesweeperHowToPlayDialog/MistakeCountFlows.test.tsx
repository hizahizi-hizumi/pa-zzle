import { cleanup, render, screen } from "@testing-library/react";

import { MistakeCountFlows } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/MistakeCountFlows";

afterEach(cleanup);

/** 流れの図のコマの盤面。押せない図は読み上げから外してあるので、隠れた要素も含めて探す。左の流れから順に、コマを並べた順。 */
function listFrames(): HTMLElement[] {
  return screen.getAllByRole("group", { name: /盤面$/, hidden: true });
}

function countStepped(frame: HTMLElement | undefined): number {
  return frame?.querySelectorAll('[data-cell-state="steppedMine"]').length ?? 0;
}

/** コマの中で、前の操作で押したマスとして無彩の枠で囲んだマスの番号（0から数える）。 */
function listPressedCells(frame: HTMLElement | undefined): number[] {
  return Array.from(
    frame?.querySelectorAll<HTMLElement>("[data-cell-index]") ?? [],
  ).flatMap((cell) =>
    cell.querySelector("[data-pressed]") === null
      ? []
      : [Number(cell.dataset.cellIndex)],
  );
}

describe("MistakeCountFlows", () => {
  beforeEach(() => {
    render(<MistakeCountFlows measure="踏んだ地雷" />);
  });

  test("同じ始まりの盤面から、地雷のマスを開くと1個、旗の違う数字を押すと2個踏むことを、本番の関数で打った姿で見せること", () => {
    const frames = listFrames();

    expect(frames).toHaveLength(4);
    expect(frames[0]?.innerHTML).toBe(frames[2]?.innerHTML);
    expect(frames.map(countStepped)).toEqual([0, 1, 0, 2]);
  });

  test("手の後のコマで、押したマスを囲むこと", () => {
    const frames = listFrames();

    expect(frames.map(listPressedCells)).toEqual([[], [0], [], [4]]);
  });

  test("図の下に、本番の数え方で数えた踏んだ地雷の数を添えること", () => {
    const counts = [screen.getByText("1個"), screen.getByText("2個")];

    expect(counts.map((count) => count.parentElement?.textContent)).toEqual([
      "→ 踏んだ地雷 1個",
      "→ 踏んだ地雷 2個",
    ]);
  });
});
