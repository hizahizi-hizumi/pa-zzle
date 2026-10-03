import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";

/** ステージごとの最初の盤面と解。`.` が空きマス。 */
const stageBoards = [
  { givens: ["AA."], solution: ["AAB"] },
  { givens: ["B.B"], solution: ["BAB"] },
  { givens: ["ABA."], solution: ["ABAB"] },
  {
    givens: [".A.B", "..A.", "B...", ".B.B"],
    solution: ["AABB", "BBAA", "BABA", "ABAB"],
  },
  {
    givens: ["..A.", "A.BB", "B...", "...B"],
    solution: ["BBAA", "AABB", "BABA", "ABAB"],
  },
] as const;

/** 解けた盤面の波と、解けたときの一言を読む間を待ち切る長さ。 */
const stageTransitionMs = 2000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "バイナリパズル盤面" });
}

function tapCell(row: number, column: number): void {
  fireEvent.click(
    within(getBoard()).getByRole("button", {
      name: new RegExp(`^${row}行${column}列 `),
    }),
  );
}

/** 空きマスを解のとおりに埋める。四角は1回、丸は2回タップする。 */
function solveStage(stageIndex: number): void {
  const { givens, solution } = stageBoards[stageIndex] ?? stageBoards[0];
  givens.forEach((givenRow, rowIndex) => {
    Array.from(givenRow).forEach((given, columnIndex) => {
      if (given !== ".") {
        return;
      }
      const tapCount = solution[rowIndex]?.[columnIndex] === "A" ? 1 : 2;
      for (let tap = 0; tap < tapCount; tap += 1) {
        tapCell(rowIndex + 1, columnIndex + 1);
      }
    });
  });
}

function waitForNextStage(): void {
  act(() => {
    vi.advanceTimersByTime(stageTransitionMs);
  });
}

function solveStages(count: number): void {
  for (let stageIndex = 0; stageIndex < count; stageIndex += 1) {
    solveStage(stageIndex);
    waitForNextStage();
  }
}

function getRuleChipTexts(): string[] {
  return within(screen.getByRole("list", { name: "見つけたルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("TakuzuTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
  });

  describe("難易度選択から開いた場合", () => {
    let rerenderTutorial: (open: boolean) => void;

    beforeEach(() => {
      const { rerender } = render(
        <TakuzuTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      rerenderTutorial = (open) =>
        rerender(
          <TakuzuTutorial
            open={open}
            onStartPlay={onStartPlay}
            onClose={onClose}
          />,
        );
    });

    test("1行3マスの盤面と最初の一言を出し、ルールを伏せておくこと", () => {
      const cells = within(getBoard()).getAllByRole("button");
      const message = screen.getByText("マスをタップしてみよう");
      const chips = getRuleChipTexts();

      expect(cells).toHaveLength(3);
      expect(message).toBeTruthy();
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("最初のタップで四角が3つ続くと、3つ続かないことを伝えること", () => {
      tapCell(1, 3);

      const cell = within(getBoard()).getByRole("button", {
        name: /^1行3列 /,
      });
      const message = screen.getByText("同じものは3つ続かない");

      expect(cell.getAttribute("aria-label")).toBe("1行3列 四角 3連続");
      expect(message).toBeTruthy();
    });

    test("丸に切り替えて解くと、1つ目のルールを手に入れること", () => {
      tapCell(1, 3);
      tapCell(1, 3);

      const message = screen.getByText("そう。3つは続かない");
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(chips).toEqual(["3つ続かない", "？", "？"]);
    });

    test("解いた後に、次の盤面へ移ること", () => {
      solveStages(1);

      const cells = within(getBoard()).getAllByRole("button");
      const message = screen.getByText("ここに入るのは？");

      expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
        "1行1列 丸 固定",
        "1行2列 空き",
        "1行3列 丸 固定",
      ]);
      expect(message).toBeTruthy();
    });

    test("最後の盤面で行き詰まると、3つ目のルールを明かすこと", () => {
      solveStages(4);
      // 3つ続かないことと同じ数で決まる6マスを埋めると、残りはそれだけでは決まらない。
      tapCell(1, 4);
      tapCell(1, 1);
      tapCell(1, 1);
      tapCell(1, 2);
      tapCell(1, 2);
      tapCell(2, 2);
      tapCell(3, 4);
      tapCell(4, 1);

      const message = screen.getByText("最後のルール");
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(chips).toEqual(["3つ続かない", "同じ数", "同じ並びなし"]);
    });

    test("すべての盤面を解くと終わりの一言を出し、レベル1を遊ぶで本番を始めること", () => {
      solveStages(5);
      const message = screen.getByText("ルールはこれで全部");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(message).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("終えた後のもう一度で最初の盤面から始めること", () => {
      solveStages(5);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

      const message = screen.getByText("マスをタップしてみよう");
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("閉じてから開き直すと最初の盤面から始まること", () => {
      solveStages(1);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const message = screen.getByText("マスをタップしてみよう");

      expect(onClose).toHaveBeenCalledOnce();
      expect(message).toBeTruthy();
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
    });

    test("すべての盤面を解くと、プレイに戻る操作で閉じること", () => {
      solveStages(5);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
