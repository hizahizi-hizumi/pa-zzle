import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";

/** ステージごとの最初の盤面と解。`.` が空きマス。`guided` は手を引いている間に示すマスの順（1始まりの行・列）。 */
const stageBoards: readonly {
  givens: readonly string[];
  solution: readonly string[];
  guided: readonly (readonly [number, number])[];
}[] = [
  {
    givens: [".."],
    solution: ["AB"],
    guided: [
      [1, 1],
      [1, 2],
    ],
  },
  { givens: ["AA."], solution: ["AAB"], guided: [] },
  { givens: ["B.B"], solution: ["BAB"], guided: [] },
  { givens: ["ABA."], solution: ["ABAB"], guided: [] },
  {
    givens: ["ABAB", "BABA", "BA..", "AB.."],
    solution: ["ABAB", "BABA", "BAAB", "ABBA"],
    guided: [],
  },
  {
    givens: [".A.B", "..A.", "B...", ".B.B"],
    solution: ["AABB", "BBAA", "BABA", "ABAB"],
    guided: [
      [4, 3],
      [1, 3],
    ],
  },
  {
    givens: ["..A.", "A.BB", "B...", "...B"],
    solution: ["BBAA", "AABB", "BABA", "ABAB"],
    guided: [],
  },
];

/** 解けた盤面の波と、解けたときの一言を読む間を待ち切る長さ。 */
const stageTransitionMs = 2000;

/** ルールに合わない手に、揺れと違反の一言で応えるまでの間。 */
const violationReactionDelayMs = 500;

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.useRealTimers();
});

function installAnimate() {
  const animate = vi.fn(
    () =>
      ({
        cancel: vi.fn(),
        finished: Promise.resolve(),
      }) as unknown as Animation,
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  return animate;
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "バイナリパズル盤面" });
}

function getCell(row: number, column: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${row}行${column}列 `),
  });
}

function tapCell(row: number, column: number): void {
  fireEvent.click(getCell(row, column));
}

/** 案内や手が止まったときに、決まるマスとして示しているマスの位置。 */
function getHintedCellPositions(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector('[data-cell-cue="hint"]'))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[0] ?? "");
}

/** 空きマスを解のとおりに埋める。四角は1回、丸は2回タップする。手を引くマスから先に埋める。 */
function solveStage(stageIndex: number): void {
  const { givens, solution, guided } = stageBoards[stageIndex] ?? {
    givens: [],
    solution: [],
    guided: [],
  };
  const emptyCells = givens.flatMap((givenRow, rowIndex) =>
    Array.from(givenRow).flatMap((given, columnIndex) =>
      given === "." ? [[rowIndex + 1, columnIndex + 1] as const] : [],
    ),
  );
  const unguidedCells = emptyCells.filter(
    ([row, column]) =>
      !guided.some(([guidedRow, guidedColumn]) => {
        return guidedRow === row && guidedColumn === column;
      }),
  );
  for (const [row, column] of [...guided, ...unguidedCells]) {
    const tapCount = solution[row - 1]?.[column - 1] === "A" ? 1 : 2;
    for (let tap = 0; tap < tapCount; tap += 1) {
      tapCell(row, column);
    }
  }
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

/** 今のステージで示したルールとして目立たせているチップ。 */
function getCurrentRuleChipTexts(): string[] {
  return within(screen.getByRole("list", { name: "見つけたルール" }))
    .getAllByRole("listitem")
    .filter((item) => item.querySelector('[aria-current="step"]'))
    .map((item) => item.textContent ?? "");
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

    test("1行2マスの盤面で、何をするパズルかと最初に押すマスを示し、ルールを伏せておくこと", () => {
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("マスを四角か丸で全部埋めるパズル");
      const detail = screen.getByText("まず、左のマスをタップ");
      const hinted = getHintedCellPositions();
      const chips = getRuleChipTexts();

      expect(cells).toHaveLength(2);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(hinted).toEqual(["1行1列"]);
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("左のマスをタップすると四角になり、タップで切り替わることと次に押すマスを示すこと", () => {
      tapCell(1, 1);

      const label = getCell(1, 1).getAttribute("aria-label");
      const message = screen.getByText("タップするたび 四角 → 丸 → 空き");
      const hinted = getHintedCellPositions();

      expect(label).toBe("1行1列 四角");
      expect(message).toBeTruthy();
      expect(hinted).toEqual(["1行2列"]);
    });

    test("右のマスを丸にすると、全部埋まったことを伝えること", () => {
      solveStage(0);

      const message = screen.getByText("全部埋まった！");

      expect(message).toBeTruthy();
    });

    describe("1×3の盤面に進んだ場合", () => {
      beforeEach(() => {
        solveStages(1);
      });

      test("1つ目のルールを示してチップに加え、それから問うこと", () => {
        const cells = within(getBoard()).getAllByRole("button");
        const rule = screen.getByText("同じものは3つ続けて置けない");
        const question = screen.getByText("では、空いているマスに入るのは？");
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();

        expect(cells).toHaveLength(3);
        expect(rule).toBeTruthy();
        expect(question).toBeTruthy();
        expect(chips).toEqual(["3つ続かない", "？", "？"]);
        expect(currentChips).toEqual(["3つ続かない"]);
      });

      test("最初のタップで四角が3つ続くと、四角が3つ続いていることを伝えること", () => {
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs);

        const cell = within(getBoard()).getByRole("button", {
          name: /^1行3列 /,
        });
        const message = screen.getByText("四角が3つ続いている");

        expect(cell.getAttribute("aria-label")).toBe("1行3列 四角 3連続");
        expect(message).toBeTruthy();
      });

      test("丸に切り替えると解けること", () => {
        tapCell(1, 3);
        tapCell(1, 3);

        const message = screen.getByText("そう。ここは丸");

        expect(message).toBeTruthy();
      });

      test("解いた後に、次の盤面へ移ること", () => {
        solveStage(1);
        waitForNextStage();

        const cells = within(getBoard()).getAllByRole("button");
        const message = screen.getByText("ここに入るのは？");

        expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
          "1行1列 丸 固定",
          "1行2列 空き",
          "1行3列 丸 固定",
        ]);
        expect(message).toBeTruthy();
      });

      describe("ルールに合わない手を置いた場合", () => {
        test("違反が続くまでは、違反の一言も揺れも出さないこと", () => {
          const animate = installAnimate();
          tapCell(1, 3);
          advanceTime(violationReactionDelayMs - 1);

          const message = screen.queryByText("四角が3つ続いている");

          expect(message).toBeNull();
          expect(animate).not.toHaveBeenCalled();
        });

        test("違反が続くと、違反の一言を出して置いたタイルを揺らすこと", () => {
          const animate = installAnimate();
          tapCell(1, 3);
          advanceTime(violationReactionDelayMs);

          const message = screen.getByText("四角が3つ続いている");

          expect(message).toBeTruthy();
          expect(animate).toHaveBeenCalledOnce();
        });

        test("違反が続く前に次の手で違反が無くなると、違反に応えないこと", () => {
          const animate = installAnimate();
          tapCell(1, 3);
          advanceTime(violationReactionDelayMs / 2);
          fireEvent.contextMenu(getCell(1, 3));
          advanceTime(violationReactionDelayMs * 2);

          const message = screen.getByText("同じものは3つ続けて置けない");

          expect(message).toBeTruthy();
          expect(animate).not.toHaveBeenCalled();
        });
      });
    });

    test("1×4の盤面では、2つ目のルールを示してチップに加え、それから問うこと", () => {
      solveStages(3);

      const rule = screen.getByText("行も列も、四角と丸は同じ数");
      const chips = getRuleChipTexts();
      const currentChips = getCurrentRuleChipTexts();

      expect(rule).toBeTruthy();
      expect(chips).toEqual(["3つ続かない", "同じ数", "？"]);
      expect(currentChips).toEqual(["同じ数"]);
    });

    describe("3つ目のルールの盤面に進んだ場合", () => {
      beforeEach(() => {
        solveStages(4);
      });

      test("3つ目のルールを示してチップに加え、それから問うこと", () => {
        const rule = screen.getByText("同じ並びの行・列は作れない");
        const question = screen.getByText("では、空いているマスに入るのは？");
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();

        expect(rule).toBeTruthy();
        expect(question).toBeTruthy();
        expect(chips).toEqual(["3つ続かない", "同じ数", "同じ並びなし"]);
        expect(currentChips).toEqual(["同じ並びなし"]);
      });

      test("上の行と同じ並びにすると、上の行と同じ並びになっていることを伝えること", () => {
        // 3行目を2行目と同じ BABA にする。
        tapCell(3, 3);
        tapCell(3, 3);
        tapCell(3, 4);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("上の行と同じ並びになっている");

        expect(message).toBeTruthy();
      });

      test("同じ並びにならない方を入れて解くと、見比べると決まることを伝えること", () => {
        solveStage(4);

        const message = screen.getByText("そう。上の行と見比べると決まる");

        expect(message).toBeTruthy();
      });
    });

    describe("4×4の最初の盤面に進んだ場合", () => {
      beforeEach(() => {
        solveStages(5);
      });

      test("最初から、3つ続かないことで決まるマスを示すこと", () => {
        const message = screen.getByText("4×4 も同じ2つのルールで解ける");
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(hinted).toEqual(["4行3列"]);
      });

      test("示したマスに置くと、決め手が光った後に同じ数で決まるマスを示すこと", () => {
        tapCell(4, 3);
        const hintedRightAfter = getHintedCellPositions();
        advanceTime(900);

        const message = screen.getByText("次の印のマスは、縦の列を見よう");
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(hintedRightAfter).toEqual([]);
        expect(hinted).toEqual(["1行3列"]);
      });

      test("2手置くと手を離し、手が止まったときだけ決まるマスを示すこと", () => {
        tapCell(4, 3);
        tapCell(1, 3);
        tapCell(1, 3);
        advanceTime(3999);
        const hintedBeforeIdle = getHintedCellPositions();
        advanceTime(1);

        const message = screen.getByText("その調子。残りも埋めよう");
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toHaveLength(1);
      });

      test("示していないマスを押しても、何も置かず、案内を進めず、示したマスを示し直すこと", () => {
        const hintCueBefore = getCell(4, 3).querySelector(
          '[data-cell-cue="hint"]',
        );
        // 4列目は丸が2つそろっていて、2行目は四角に決まるが、示していない。
        tapCell(2, 4);
        tapCell(3, 3);
        act(() => {
          getCell(3, 3).focus();
        });
        fireEvent.keyDown(getCell(3, 3), { key: "1" });

        const message = screen.getByText("4×4 も同じ2つのルールで解ける");
        const hinted = getHintedCellPositions();
        const hintCueAfter = getCell(4, 3).querySelector(
          '[data-cell-cue="hint"]',
        );

        expect(message).toBeTruthy();
        expect(getCell(2, 4).getAttribute("aria-label")).toBe("2行4列 空き");
        expect(getCell(3, 3).getAttribute("aria-label")).toBe("3行3列 空き");
        expect(hinted).toEqual(["4行3列"]);
        expect(hintCueAfter).not.toBe(hintCueBefore);
      });

      test("示したマスに違う方を置くと、案内を進めず、同じマスを示し続けること", () => {
        tapCell(4, 3);
        advanceTime(900);
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("四角が多すぎる列がある");
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(hinted).toEqual(["1行3列"]);
      });

      test("手を離した後は、示していないマスにも置けること", () => {
        tapCell(4, 3);
        tapCell(1, 3);
        tapCell(1, 3);
        tapCell(3, 3);

        const label = getCell(3, 3).getAttribute("aria-label");

        expect(label).not.toBe("3行3列 空き");
      });
    });

    test("最後の盤面は、3つのルールを手に入れたまま、どれも目立たせずに始めること", () => {
      solveStages(6);

      const message = screen.getByText("3つのルールで解いてみよう");
      const chips = getRuleChipTexts();
      const currentChips = getCurrentRuleChipTexts();

      expect(message).toBeTruthy();
      expect(chips).toEqual(["3つ続かない", "同じ数", "同じ並びなし"]);
      expect(currentChips).toEqual([]);
    });

    test("すべての盤面を解くと終わりの一言を出し、レベル1を遊ぶで本番を始めること", () => {
      solveStages(7);
      const message = screen.getByText("ルールはこれで全部");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(message).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("終えた後のもう一度で最初の盤面から始めること", () => {
      solveStages(7);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

      const message = screen.getByText("マスを四角か丸で全部埋めるパズル");
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("閉じてから開き直すと最初の盤面から始まること", () => {
      solveStages(1);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const message = screen.getByText("マスを四角か丸で全部埋めるパズル");

      expect(onClose).toHaveBeenCalledOnce();
      expect(message).toBeTruthy();
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
    });

    test("すべての盤面を解くと、プレイに戻る操作で閉じること", () => {
      solveStages(7);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
