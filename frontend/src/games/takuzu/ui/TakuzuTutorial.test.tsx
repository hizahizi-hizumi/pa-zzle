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

/** 開いてから、盤面の段に入るまでの間。 */
const introBoardStartMs = 850;

/** 解き終えた盤面を見せ終えてから、始めの盤面へ移すまでの間。 */
const introGoalHoldMs = 1500;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 7000;

/** 置いたタイルを消し始めてから、始めの盤面へ戻し終えるまでの間。演出を描けるように差し替えた環境では、消す動きはすぐ終わる。 */
const introStartTransitionMs = 80;

/** 始めの盤面へ移し終えてから、名前を上部へ移すまでの間。 */
const introStartHoldMs = 900;

/** もう一度始めるときに、始めの盤面の一言を出してから盤面を戻し始めるまでの間。 */
const restartCaptionLeadMs = 500;

/** 動きを付けない導入で、名前と一文、解き終えた盤面、始めの盤面をそれぞれ止めて見せる間。 */
const stillIntroStageMs = 1500;

const tagline = "マスを四角か丸で埋めるパズルです";
const goalCaption = "この形がゴールです";
const startCaption = "最初はいくつかのマスが空いています";
const firstHeadline = "1回タップすると、四角になります";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
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

/**
 * 導入の段ごとに次の段の時計を掛け直すので、細かく区切って進める。
 * 演出の完了は Animation の `finished` を待つので、区切りごとに Promise も進める。
 */
async function advanceTimeInSlices(ms: number): Promise<void> {
  const sliceMs = 50;
  for (let elapsed = 0; elapsed < ms; elapsed += sliceMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(sliceMs);
    });
  }
}

/** 文言が出るまで、細かく区切って時間を進める。 */
async function advanceTimeUntilShown(text: string): Promise<void> {
  for (
    let elapsed = 0;
    elapsed < introEnoughMs && screen.queryByText(text) === null;
    elapsed += 50
  ) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
  }
}

/** 名前を上部の外の中央で大きく見せているか。導入の間だけ、名前に変形を付けて動かす。 */
function isTitleCentered(): boolean {
  return screen.getByRole("heading").style.transform !== "";
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "バイナリパズル盤面" });
}

/** 画面を押して導入を飛ばす。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
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

function getCellLabel(row: number, column: number): string | null {
  return getCell(row, column).getAttribute("aria-label");
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
      skipIntro();
    });

    test("パズルの名前と4×4の盤面を出し、四角の置き方と最初に押すマスを示して、ルールを伏せておくこと", () => {
      const title = screen.getByRole("heading", { name: "バイナリパズル" });
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("1回タップすると、四角になります");
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

    test("解き終えると、本番につなぐ一言を出し、レベル1を遊ぶで本番を始めること", () => {
      solveAll();
      const headline = screen.getByText("完成です");
      const detail = screen.getByText("本番は 8×8 で、ルールは同じです");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("終えた後のもう一度で、始めの盤面を一言と一緒に止めて見せてから、最初から始めること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      const captionWhileStill = screen.getByText(startCaption);
      const labelWhileStill = getCellLabel(1, 1);
      const hintedWhileStill = getHintedCellPositions();
      advanceTime(stillIntroStageMs);

      const message = screen.getByText(firstHeadline);
      const hinted = getHintedCellPositions();
      const chips = getRuleChipTexts();

      expect(captionWhileStill).toBeTruthy();
      expect(labelWhileStill).toBe("1行1列 空き");
      expect(hintedWhileStill).toEqual([]);
      expect(message).toBeTruthy();
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["1行1列"]);
      expect(chips).toEqual(["？", "？", "？"]);
    });

    test("閉じてから開き直すと、導入から始まること", () => {
      finishSteps(3);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const shownTagline = screen.getByText(tagline);
      skipIntro();
      const label = getCellLabel(1, 1);

      expect(onClose).toHaveBeenCalledOnce();
      expect(shownTagline).toBeTruthy();
      expect(label).toBe("1行1列 空き");
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <TakuzuTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
    });

    test("開くと、パズル選択と同じピクトグラムと名前に何をするパズルかを添え、解き終えた盤面を、印を付けずに見せること", () => {
      const pictogram = screen.getByRole("img", {
        name: "バイナリパズル",
        hidden: true,
      });
      const title = screen.getByRole("heading", { name: "バイナリパズル" });
      const tagline = screen.getByText("マスを四角か丸で埋めるパズルです");
      const labels = [getCellLabel(1, 1), getCellLabel(2, 2)];
      const hinted = getHintedCellPositions();

      expect(pictogram).toBeTruthy();
      expect(title).toBeTruthy();
      expect(tagline).toBeTruthy();
      expect(labels).toEqual(["1行1列 四角", "2行2列 丸"]);
      expect(hinted).toEqual([]);
    });

    test("最後まで見せると、始めの盤面で最初の手順の一言と印を出すこと", async () => {
      await advanceTimeInSlices(introEnoughMs);

      const headline = screen.getByText("1回タップすると、四角になります");
      const labels = [getCellLabel(1, 1), getCellLabel(1, 2)];
      const hinted = getHintedCellPositions();
      const chips = getRuleChipTexts();

      expect(headline).toBeTruthy();
      expect(labels).toEqual(["1行1列 空き", "1行2列 四角 固定"]);
      expect(hinted).toEqual(["1行1列"]);
      expect(chips).toEqual(["？", "？", "？"]);
      expect(screen.queryByText("マスを四角か丸で埋めるパズルです")).toBeNull();
      expect(
        screen.queryByText("最初はいくつかのマスが空いています"),
      ).toBeNull();
    });

    test("解き終えた盤面を見せ終えると、それが完成だと添えてから、マスを空けて始めると添えて戻すこと", async () => {
      await advanceTimeInSlices(introBoardStartMs + 400);
      const goalCaption = screen.getByText("この形がゴールです");
      const labelWhileGoal = getCellLabel(1, 1);
      await advanceTimeInSlices(introGoalHoldMs);

      const startCaption = screen.getByText(
        "最初はいくつかのマスが空いています",
      );
      const goalCaptionAfter = screen.queryByText("この形がゴールです");

      expect(goalCaption).toBeTruthy();
      expect(labelWhileGoal).toBe("1行1列 四角");
      expect(startCaption).toBeTruthy();
      expect(goalCaptionAfter).toBeNull();
    });

    test("始めの盤面へ戻し終えた後も、始めの一言を読める間は名前を中央に置いたままにすること", async () => {
      await advanceTimeUntilShown(startCaption);
      await advanceTimeInSlices(
        introStartTransitionMs + introStartHoldMs - 100,
      );
      const centeredWhileHolding = isTitleCentered();
      const captionWhileHolding = screen.queryByText(startCaption);
      await advanceTimeInSlices(200);

      const centeredAfterHolding = isTitleCentered();

      expect(centeredWhileHolding).toBe(true);
      expect(captionWhileHolding).not.toBeNull();
      expect(centeredAfterHolding).toBe(false);
    });

    describe("盤面の段まで進んだ場合", () => {
      beforeEach(async () => {
        await advanceTimeInSlices(introBoardStartMs);
      });

      test("盤面を押しても、タイルを替えないこと", () => {
        tapCell(2, 2);

        const label = getCellLabel(2, 2);
        const hinted = getHintedCellPositions();

        expect(label).toBe("2行2列 丸");
        expect(hinted).toEqual([]);
      });

      const skipCases = [
        ["画面を押す", () => fireEvent.pointerDown(getBoard())],
        [
          "閉じるボタンにフォーカスがあるままキーを押す",
          () =>
            fireEvent.keyDown(screen.getByRole("button", { name: "閉じる" }), {
              key: "Enter",
            }),
        ],
      ] as const;

      test.each(skipCases)(
        "%sと、導入を飛ばして始めの盤面の最初の手順から始めること",
        (_, skip) => {
          skip();

          const headline = screen.getByText("1回タップすると、四角になります");
          const label = getCellLabel(1, 1);
          const hinted = getHintedCellPositions();

          expect(headline).toBeTruthy();
          expect(label).toBe("1行1列 空き");
          expect(hinted).toEqual(["1行1列"]);
          expect(onClose).not.toHaveBeenCalled();
        },
      );
    });

    describe("解き終えた場合", () => {
      beforeEach(async () => {
        await advanceTimeInSlices(introEnoughMs);
        solveAll();
        await advanceTimeInSlices(introEnoughMs);
      });

      test("もう一度で、始めの一言を先に出してから置いたタイルを消し、最初の手順を始めること", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const captionAtFirst = screen.queryByText(startCaption);
        await advanceTimeInSlices(restartCaptionLeadMs - 50);
        const labelBeforeRewind = getCellLabel(1, 1);
        await advanceTimeInSlices(introEnoughMs);

        const label = getCellLabel(1, 1);
        const hinted = getHintedCellPositions();

        expect(captionAtFirst).not.toBeNull();
        expect(labelBeforeRewind).toBe("1行1列 四角");
        expect(label).toBe("1行1列 空き");
        expect(hinted).toEqual(["1行1列"]);
      });

      test("もう一度で戻し終えた後も、始めの一言を読める間だけ残すこと", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        await advanceTimeInSlices(
          restartCaptionLeadMs +
            introStartTransitionMs +
            introStartHoldMs -
            100,
        );
        const captionWhileHolding = screen.queryByText(startCaption);
        const hintedWhileHolding = getHintedCellPositions();
        await advanceTimeInSlices(introEnoughMs);

        expect(captionWhileHolding).not.toBeNull();
        expect(hintedWhileHolding).toEqual([]);
        expect(screen.queryByText(startCaption)).toBeNull();
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      render(<TakuzuTutorial open={true} onClose={onClose} />);
    });

    test("名前と一文、解き終えた盤面、始めの盤面を、それぞれ一言と一緒に止めて順に見せてから、最初の手順を始めること", () => {
      const nameStage = {
        tagline: screen.queryByText(tagline) !== null,
        caption:
          screen.queryByText(goalCaption) ?? screen.queryByText(startCaption),
      };
      advanceTime(stillIntroStageMs);
      const goalStage = {
        caption: screen.queryByText(goalCaption) !== null,
        label: getCellLabel(1, 1),
      };
      advanceTime(stillIntroStageMs);
      const startStage = {
        caption: screen.queryByText(startCaption) !== null,
        label: getCellLabel(1, 1),
        hinted: getHintedCellPositions(),
      };
      advanceTime(stillIntroStageMs);

      const headline = screen.getByText(firstHeadline);
      const hinted = getHintedCellPositions();

      expect(nameStage).toEqual({ tagline: true, caption: null });
      expect(goalStage).toEqual({ caption: true, label: "1行1列 四角" });
      expect(startStage).toEqual({
        caption: true,
        label: "1行1列 空き",
        hinted: [],
      });
      expect(headline).toBeTruthy();
      expect(screen.queryByText(tagline)).toBeNull();
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["1行1列"]);
    });

    test("画面を押すと、止めて見せている途中でも導入を飛ばすこと", () => {
      advanceTime(stillIntroStageMs);
      skipIntro();

      const label = getCellLabel(1, 1);
      const hinted = getHintedCellPositions();

      expect(screen.queryByText(goalCaption)).toBeNull();
      expect(label).toBe("1行1列 空き");
      expect(hinted).toEqual(["1行1列"]);
    });

    test("解き終えた後のもう一度で、始めの盤面を一言と一緒に止めて見せてから、最初の手順を始めること", async () => {
      skipIntro();
      solveAll();
      await advanceTimeInSlices(introEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      const captionWhileStill = screen.getByText(startCaption);
      const labelWhileStill = getCellLabel(1, 1);
      advanceTime(stillIntroStageMs);

      const hinted = getHintedCellPositions();

      expect(captionWhileStill).toBeTruthy();
      expect(labelWhileStill).toBe("1行1列 空き");
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["1行1列"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("解き終えると、プレイ中の盤面につなぐ一言を出し、プレイに戻る操作で閉じること", () => {
      solveAll();
      const detail = screen.getByText(
        "このルールで、プレイ中の盤面も埋められます",
      );
      const selectionDetail = screen.queryByText(
        "本番は 8×8 で、ルールは同じです",
      );
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(selectionDetail).toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
