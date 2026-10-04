import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";

type CellPlacement = readonly [row: number, column: number, tile: "A" | "B"];

/** 手順ごとに印を付けるマスと、その解。四角は1回、丸は2回タップして置く。 */
const stepPlacements: readonly (readonly CellPlacement[])[] = [
  [[1, 1, "A"]],
  [[2, 4, "B"]],
  [[1, 3, "B"]],
  [[2, 1, "A"]],
  [[1, 4, "B"]],
  [[4, 4, "A"]],
  [[4, 3, "A"]],
  [
    [2, 2, "B"],
    [2, 3, "A"],
  ],
];

/** 手順を終えた後に残るマスと、その解。 */
const remainingPlacements: readonly CellPlacement[] = [
  [3, 2, "A"],
  [3, 3, "B"],
];

/** ルールに合わない手に、揺れと違反の一言で応えるまでの間。 */
const violationReactionDelayMs = 500;

/** 手順どおりに置いてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 900;

/** 手を離した後、手が止まってから決まるマスを示すまでの間。 */
const idleHintDelayMs = 4000;

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

function placeAll(placements: readonly CellPlacement[]): void {
  for (const [row, column, tile] of placements) {
    const tapCount = tile === "A" ? 1 : 2;
    for (let tap = 0; tap < tapCount; tap += 1) {
      tapCell(row, column);
    }
  }
}

function finishSteps(count: number): void {
  for (const placements of stepPlacements.slice(0, count)) {
    placeAll(placements);
  }
}

function solveAll(): void {
  finishSteps(stepPlacements.length);
  placeAll(remainingPlacements);
}

/** 印を付けているマスの位置。 */
function getHintedCellPositions(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector('[data-cell-cue="hint"]'))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[0] ?? "");
}

function getRuleChips(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "ルール" })).getAllByRole(
    "listitem",
  );
}

function getRuleChipTexts(): string[] {
  return getRuleChips().map((item) => item.textContent ?? "");
}

/** 今の手順で示しているルールとして目立たせているチップ。 */
function getCurrentRuleChipTexts(): string[] {
  return getRuleChips()
    .filter((item) => item.querySelector('[aria-current="step"]'))
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

    test("パズルの名前と4×4の盤面を出し、何をするかと最初に押すマスを示して、ルールを伏せておくこと", () => {
      const title = screen.getByRole("heading", { name: "バイナリパズル" });
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("四角と丸で、盤面を埋めていきます");
      const detail = screen.getByText("印のマスをタップしてください");
      const hinted = getHintedCellPositions();
      const chips = getRuleChipTexts();

      expect(title).toBeTruthy();
      expect(cells).toHaveLength(16);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(hinted).toEqual(["1行1列"]);
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("印のマスをタップすると四角になり、丸の置き方と次のマスを示すこと", () => {
      tapCell(1, 1);

      const label = getCell(1, 1).getAttribute("aria-label");
      const message = screen.getByText("2回タップすると、丸になります");
      const hinted = getHintedCellPositions();

      expect(label).toBe("1行1列 四角");
      expect(message).toBeTruthy();
      expect(hinted).toEqual(["2行4列"]);
    });

    test("印の無いマスを押しても、何も置かず、印を付け直すこと", () => {
      const hintCueBefore = getCell(1, 1).querySelector(
        '[data-cell-cue="hint"]',
      );
      tapCell(1, 3);
      act(() => {
        getCell(2, 2).focus();
      });
      fireEvent.keyDown(getCell(2, 2), { key: "1" });

      const hintCueAfter = getCell(1, 1).querySelector(
        '[data-cell-cue="hint"]',
      );

      expect(getCell(1, 3).getAttribute("aria-label")).toBe("1行3列 空き");
      expect(getCell(2, 2).getAttribute("aria-label")).toBe("2行2列 空き");
      expect(getHintedCellPositions()).toEqual(["1行1列"]);
      expect(hintCueAfter).not.toBe(hintCueBefore);
    });

    describe("3つ続かないことを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(2);
      });

      test("ルールを示してチップに加え、今示しているルールとして目立たせること", () => {
        const message = screen.getByText("同じものは、3つ続けて並べられません");
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();

        expect(message).toBeTruthy();
        expect(chips).toEqual(["3つ続かない", "？", "？"]);
        expect(currentChips).toEqual(["3つ続かない"]);
      });

      test("違反が続くまでは、違反の一言も揺れも出さないこと", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs - 1);

        const message = screen.queryByText("四角が3つ続いています");

        expect(message).toBeNull();
        expect(animate).not.toHaveBeenCalled();
      });

      test("四角を置いて違反が続くと、違反の一言を出して置いたタイルを揺らし、印を付け続けること", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("四角が3つ続いています");
        const label = getCell(1, 3).getAttribute("aria-label");

        expect(message).toBeTruthy();
        expect(label).toBe("1行3列 四角 3連続");
        expect(animate).toHaveBeenCalledOnce();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
      });

      test("違反が続く前に丸へ切り替えると、違反に応えず次の手順へ進むこと", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs / 2);
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs * 2);

        const message = screen.getByText("縦にも、3つ続けて並べられません");
        const currentChips = getCurrentRuleChipTexts();

        expect(message).toBeTruthy();
        expect(currentChips).toEqual([]);
        expect(animate).not.toHaveBeenCalled();
      });

      test("丸を置くと、決め手が光った後に次の印を付けること", () => {
        tapCell(1, 3);
        tapCell(1, 3);
        const hintedRightAfter = getHintedCellPositions();
        advanceTime(nextStepCueDelayMs);

        const hinted = getHintedCellPositions();

        expect(hintedRightAfter).toEqual([]);
        expect(hinted).toEqual(["2行1列"]);
      });
    });

    describe("同じ数を示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(4);
      });

      test("ルールを示してチップに加え、今示しているルールとして目立たせること", () => {
        const message = screen.getByText("行の四角と丸は、同じ数ずつです");
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();

        expect(message).toBeTruthy();
        expect(chips).toEqual(["3つ続かない", "同じ数", "？"]);
        expect(currentChips).toEqual(["同じ数"]);
      });
    });

    describe("同じ並びを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(7);
        advanceTime(nextStepCueDelayMs);
      });

      test("ルールを示してチップに加え、2行目の2マスに印を付けること", () => {
        const message = screen.getByText("同じ並びの行・列は作れません");
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(chips).toEqual(["3つ続かない", "同じ数", "同じ並びなし"]);
        expect(currentChips).toEqual(["同じ並びなし"]);
        expect(hinted).toEqual(["2行2列", "2行3列"]);
      });

      test("上の行と同じ並びにすると、上の行と同じ並びになっていることを伝えること", () => {
        tapCell(2, 2);
        tapCell(2, 3);
        tapCell(2, 3);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("上の行と同じ並びになっています");

        expect(message).toBeTruthy();
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(stepPlacements.length);
      });

      test("残りを埋めることを伝え、手が止まったときだけ決まるマスを示すこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const hintedBeforeIdle = getHintedCellPositions();
        advanceTime(1);

        const message = screen.getByText("残りを埋めると完成です");
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toHaveLength(1);
      });

      test("どのマスにも置けること", () => {
        tapCell(3, 2);

        const label = getCell(3, 2).getAttribute("aria-label");

        expect(label).toBe("3行2列 四角");
      });
    });

    test("解き終えると、終わりの一言を出し、レベル1を遊ぶで本番を始めること", () => {
      solveAll();
      const message = screen.getByText("完成です");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(message).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("終えた後のもう一度で、最初から始めること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

      const message = screen.getByText("四角と丸で、盤面を埋めていきます");
      const label = getCell(1, 1).getAttribute("aria-label");
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(label).toBe("1行1列 空き");
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("閉じてから開き直すと、最初から始まること", () => {
      finishSteps(3);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const message = screen.getByText("四角と丸で、盤面を埋めていきます");

      expect(onClose).toHaveBeenCalledOnce();
      expect(message).toBeTruthy();
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
    });

    test("解き終えると、プレイに戻る操作で閉じること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
