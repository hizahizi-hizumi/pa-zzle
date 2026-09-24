import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { MinesweeperDifficultyReviewView } from "./MinesweeperDifficultyReviewView";

afterEach(cleanup);

describe("MinesweeperDifficultyReviewView", () => {
  const groupNames = ["代表（難易度1〜5）", "境界", "異常"] as const;

  beforeEach(() => {
    render(
      <MemoryRouter>
        <MinesweeperDifficultyReviewView />
      </MemoryRouter>,
    );
  });

  test.each(groupNames)("%sの問題を一覧に並べること", (groupName) => {
    const group = screen.getByRole("region", { name: groupName });

    const rows = within(group).getAllByRole("link");

    expect(rows.length).toBeGreaterThan(0);
  });

  test("問題ごとに判定結果とプレイへの導線を表示すること", () => {
    const representatives = screen.getByRole("region", {
      name: "代表（難易度1〜5）",
    });

    const firstRow = within(representatives).getAllByRole("link")[0]!;

    expect(within(firstRow).getByText("難易度 1")).toBeTruthy();
    expect(within(firstRow).getByText("10×10・地雷15")).toBeTruthy();
    expect(firstRow.getAttribute("href")).toBe(
      "/puzzles/minesweeper/difficulty-review/play?seed=ms-10x10-15-125&rows=10&columns=10&mines=15&start=random&attempt=1",
    );
  });

  test("提供範囲外の問題を判定結果として表示すること", () => {
    const boundaries = screen.getByRole("region", { name: "境界" });

    const outOfRangeLabels = within(boundaries).getAllByText(
      "提供範囲外（軽すぎ）",
    );

    expect(outOfRangeLabels).toHaveLength(2);
  });
});
