import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";

/** 手順ごとに印を付けるタイル。 */
const stepTiles = [6, 2, 1] as const;

/** 手順を終えた後に残る押し方。 */
const remainingTiles = [4, 5, 8] as const;

/** 手順どおりに滑らせてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 400;

/** 手を離した後、手が止まってから次に滑らせるタイルを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 開いてから、盤面の段に入るまでの間。 */
const introBoardStartMs = 850;

/** 解き終えた盤面を見せ終えてから、始めの盤面へ移すまでの間。 */
const introGoalHoldMs = 1500;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 7000;

/** 完成した盤面を1手ずつ崩し始めてから、始めの盤面へ崩し終えるまでの間。 */
const introStartTransitionMs = 1050;

/** 始めの盤面へ移し終えてから、名前を上部へ移すまでの間。 */
const introStartHoldMs = 900;

/** もう一度始めるときに、始めの盤面の一言を出してから盤面を戻し始めるまでの間。 */
const restartCaptionLeadMs = 500;

/** 動きを付けない導入で、名前と一文、完成した盤面、始めの盤面をそれぞれ止めて見せる間。 */
const stillIntroStageMs = 1500;

const tagline = "番号が書かれたタイルをスライドさせて、順番に並べるパズルです";
const goalCaption = "この形がゴールです";
const startCaption = "最初はこのように崩れています";
const firstHeadline = "空白の隣のタイルは、スライドできます";

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

/** 演出の完了は Animation の `finished` を待つので、細かく区切って Promise も進める。 */
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
  return screen.getByRole("group", { name: "盤面" });
}

/** 画面を押して導入を飛ばす。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
}

function getTile(tile: number): HTMLElement {
  return within(getBoard()).getByRole("button", { name: String(tile) });
}

function tapTile(tile: number): void {
  fireEvent.click(getTile(tile));
}

function tapAll(tiles: readonly number[]): void {
  for (const tile of tiles) {
    tapTile(tile);
  }
}

/** タイルの位置（1始まりの行・列）。盤面は位置をタイルの移動量で描く。 */
function getTilePosition(tile: number): string {
  const match = /translate\((\d+)%, (\d+)%\)/.exec(
    getTile(tile).style.transform,
  );
  const column = Number(match?.[1] ?? 0) / 100 + 1;
  const row = Number(match?.[2] ?? 0) / 100 + 1;
  return `${row}行${column}列`;
}

function finishSteps(count: number): void {
  for (const tile of stepTiles.slice(0, count)) {
    tapTile(tile);
    advanceTime(nextStepCueDelayMs);
  }
}

function solveAll(): void {
  finishSteps(stepTiles.length);
  tapAll(remainingTiles);
}

/** 印を付けているタイル。 */
function getHintedTiles(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector('[data-tile-cue="hint"]'))
    .map((tile) => tile.textContent ?? "");
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

describe("SlidePuzzleTutorial", () => {
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
        <SlidePuzzleTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      rerenderTutorial = (open) =>
        rerender(
          <SlidePuzzleTutorial
            open={open}
            onStartPlay={onStartPlay}
            onClose={onClose}
          />,
        );
      skipIntro();
    });

    test("パズルの名前と3×3の盤面を出し、タイルの滑り方と最初に押すタイルを示すこと", () => {
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const tiles = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("空白の隣のタイルは、スライドできます");
      const detail = screen.getByText("印のタイルをタップしてください");
      const hinted = getHintedTiles();
      const chips = getRuleChipTexts();
      const currentChips = getCurrentRuleChipTexts();

      expect(title).toBeTruthy();
      expect(tiles).toHaveLength(8);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(hinted).toEqual(["6"]);
      expect(chips).toEqual(["空白にスライド", "？"]);
      expect(currentChips).toEqual(["空白にスライド"]);
    });

    test("印のタイルを押すと空白へ滑り、滑り終えてから次のタイルに印を付けること", () => {
      tapTile(6);
      const hintedRightAfter = getHintedTiles();
      advanceTime(nextStepCueDelayMs);

      const position = getTilePosition(6);
      const message = screen.getByText(
        "空白の行なら、まとめてスライドできます",
      );
      const hinted = getHintedTiles();

      expect(position).toBe("2行3列");
      expect(hintedRightAfter).toEqual([]);
      expect(message).toBeTruthy();
      expect(hinted).toEqual(["2"]);
    });

    test("印の無い動くタイルを押しても滑らせず、印を付け直すこと", () => {
      const hintCueBefore = getTile(6).querySelector('[data-tile-cue="hint"]');
      tapTile(4);

      const position = getTilePosition(4);
      const hintCueAfter = getTile(6).querySelector('[data-tile-cue="hint"]');

      expect(position).toBe("2行2列");
      expect(getHintedTiles()).toEqual(["6"]);
      expect(hintCueAfter).not.toBe(hintCueBefore);
    });

    test("動かないタイルを押すと、滑らせずに揺らし、空白の隣のタイルが滑ることを伝えること", () => {
      const animate = installAnimate();
      tapTile(5);

      const position = getTilePosition(5);
      const headline = screen.getByText("このタイルは、空白の隣にありません");
      const detail = screen.getByText(
        "空白の隣のタイルが、空白にスライドします",
      );

      expect(position).toBe("3行2列");
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(animate).toHaveBeenCalledOnce();
      expect(getHintedTiles()).toEqual(["6"]);
    });

    test("動かないタイルを押した後に印の無い動くタイルを押すと、違反の一言を下げて手順の一言に戻し、印を付け直すこと", () => {
      tapTile(5);
      const hintCueBefore = getTile(6).querySelector('[data-tile-cue="hint"]');
      tapTile(4);

      const headline = screen.getByText(firstHeadline);
      const violation = screen.queryByText(
        "このタイルは、空白の隣にありません",
      );
      const hintCueAfter = getTile(6).querySelector('[data-tile-cue="hint"]');

      expect(headline).toBeTruthy();
      expect(violation).toBeNull();
      expect(getHintedTiles()).toEqual(["6"]);
      expect(hintCueAfter).not.toBe(hintCueBefore);
    });

    describe("まとめて滑ることを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("ルールをチップに加えて目立たせ、遠いタイルを押すと間のタイルごと滑ること", () => {
        const chips = getRuleChipTexts();
        const currentChips = getCurrentRuleChipTexts();
        tapTile(2);

        const positions = [getTilePosition(2), getTilePosition(3)];

        expect(chips).toEqual(["空白にスライド", "まとめてスライド"]);
        expect(currentChips).toEqual(["まとめてスライド"]);
        expect(positions).toEqual(["1行2列", "1行3列"]);
      });
    });

    describe("知っているルールで決まる手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(2);
      });

      test("空白に入るタイルをゴールの形から読ませ、手が止まるまで印を付けないこと", () => {
        const headline = screen.getByText(
          "空白に入る番号を、ゴールの形で探します",
        );
        const detail = screen.getByText("迷ったら、少し待つと印が出ます");
        const currentChips = getCurrentRuleChipTexts();
        // 前の手順を終えてから、次の印を付けるまでの間はもう進めてある。
        advanceTime(idleHintDelayMs - nextStepCueDelayMs - 1);
        const hintedBeforeIdle = getHintedTiles();
        advanceTime(1);

        const hinted = getHintedTiles();

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(currentChips).toEqual([]);
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toEqual(["1"]);
      });

      test("印の無い動くタイルを押すと、滑らせずに空白に入るタイルに印を付けること", () => {
        tapTile(2);

        const position = getTilePosition(2);
        const hinted = getHintedTiles();

        expect(position).toBe("1行2列");
        expect(hinted).toEqual(["1"]);
      });

      test("読んだタイルを押すと、印が無くても空白に滑らせて手を離すこと", () => {
        tapTile(1);

        const position = getTilePosition(1);
        const message = screen.getByText("残りを並べると完成です");

        expect(position).toBe("1行1列");
        expect(message).toBeTruthy();
      });

      test("動かないタイルを押すと、空白と同じ行・列のタイルが滑ることを伝え、手が止まるのを待たずに空白に入るタイルに印を付けること", () => {
        tapTile(8);

        const headline = screen.getByText("空白の行にも列にもないタイルです");
        const detail = screen.getByText(
          "空白と同じ行・列のタイルがスライドします",
        );
        const hinted = getHintedTiles();

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(hinted).toEqual(["1"]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(stepTiles.length);
      });

      test("残りを並べることを伝え、手が止まったときだけ次に滑らせるタイルを示すこと", () => {
        // 最後の手順を終えてから、次の印を付けるまでの間はもう進めてある。
        advanceTime(idleHintDelayMs - nextStepCueDelayMs - 1);
        const hintedBeforeIdle = getHintedTiles();
        advanceTime(1);

        const message = screen.getByText("残りを並べると完成です");
        const hinted = getHintedTiles();

        expect(message).toBeTruthy();
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toEqual(["4"]);
      });

      test("印の無いタイルも滑らせられること", () => {
        tapTile(7);

        const position = getTilePosition(7);

        expect(position).toBe("2行1列");
      });
    });

    test("解き終えると、レベル1につなぐ一言を出し、レベル1を遊ぶで本番を始めること", () => {
      solveAll();
      const headline = screen.getByText("完成です");
      const detail = screen.getByText("レベル1は、少し回り道が要る盤面です");
      fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(onStartPlay).toHaveBeenCalledOnce();
    });

    test("終えた後のもう一度で、始めの盤面を一言と一緒に止めて見せてから、最初から始めること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      const captionWhileStill = screen.getByText(startCaption);
      const positionWhileStill = getTilePosition(6);
      const hintedWhileStill = getHintedTiles();
      advanceTime(stillIntroStageMs);

      const message = screen.getByText(firstHeadline);
      const hinted = getHintedTiles();
      const chips = getRuleChipTexts();

      expect(captionWhileStill).toBeTruthy();
      expect(positionWhileStill).toBe("1行3列");
      expect(hintedWhileStill).toEqual([]);
      expect(message).toBeTruthy();
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["6"]);
      expect(chips).toEqual(["空白にスライド", "？"]);
    });

    test("閉じてから開き直すと、導入から始まること", () => {
      finishSteps(2);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const shownTagline = screen.getByText(tagline);
      skipIntro();
      const position = getTilePosition(6);

      expect(onClose).toHaveBeenCalledOnce();
      expect(shownTagline).toBeTruthy();
      expect(position).toBe("1行3列");
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <SlidePuzzleTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
    });

    test("開くと、パズル選択と同じピクトグラムと名前に何をするパズルかを添え、完成した盤面を、印を付けずに見せること", () => {
      const pictogram = screen.getByRole("img", {
        name: "スライドパズル",
        hidden: true,
      });
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const tagline = screen.getByText(
        "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
      );
      const positions = [getTilePosition(1), getTilePosition(6)];
      const hinted = getHintedTiles();

      expect(pictogram).toBeTruthy();
      expect(title).toBeTruthy();
      expect(tagline).toBeTruthy();
      expect(positions).toEqual(["1行1列", "2行3列"]);
      expect(hinted).toEqual([]);
    });

    test("最後まで見せると、始めの盤面で最初の手順の一言と印を出すこと", async () => {
      await advanceTimeInSlices(introEnoughMs);

      const headline = screen.getByText("空白の隣のタイルは、スライドできます");
      const positions = [getTilePosition(1), getTilePosition(6)];
      const hinted = getHintedTiles();

      expect(headline).toBeTruthy();
      expect(positions).toEqual(["2行1列", "1行3列"]);
      expect(hinted).toEqual(["6"]);
      expect(
        screen.queryByText(
          "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
        ),
      ).toBeNull();
      expect(screen.queryByText("最初はこのように崩れています")).toBeNull();
    });

    test("完成した盤面を見せ終えると、それが完成だと添えてから、崩した盤面から始めると添えて崩すこと", async () => {
      await advanceTimeInSlices(introBoardStartMs + 100);
      const goalCaption = screen.getByText("この形がゴールです");
      const positionWhileGoal = getTilePosition(6);
      await advanceTimeInSlices(introGoalHoldMs);

      const startCaption = screen.getByText("最初はこのように崩れています");
      const goalCaptionAfter = screen.queryByText("この形がゴールです");

      expect(goalCaption).toBeTruthy();
      expect(positionWhileGoal).toBe("2行3列");
      expect(startCaption).toBeTruthy();
      expect(goalCaptionAfter).toBeNull();
    });

    test("始めの盤面へ崩し終えた後も、始めの一言を読める間は名前を中央に置いたままにすること", async () => {
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

      test("タイルを押しても滑らせないこと", () => {
        tapTile(8);

        const position = getTilePosition(8);
        const hinted = getHintedTiles();

        expect(position).toBe("3行2列");
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

          const headline = screen.getByText(
            "空白の隣のタイルは、スライドできます",
          );
          const position = getTilePosition(6);
          const hinted = getHintedTiles();

          expect(headline).toBeTruthy();
          expect(position).toBe("1行3列");
          expect(hinted).toEqual(["6"]);
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

      test("もう一度で、始めの一言を先に出してから完成した盤面を崩し、最初の手順を始めること", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const captionAtFirst = screen.queryByText(startCaption);
        await advanceTimeInSlices(restartCaptionLeadMs - 50);
        // 崩すときに最初に動くタイル。
        const positionBeforeScramble = getTilePosition(8);
        await advanceTimeInSlices(introEnoughMs);

        const position = getTilePosition(6);
        const hinted = getHintedTiles();

        expect(captionAtFirst).not.toBeNull();
        expect(positionBeforeScramble).toBe("3行2列");
        expect(position).toBe("1行3列");
        expect(hinted).toEqual(["6"]);
      });

      test("もう一度で崩し終えた後も、始めの一言を読める間だけ残すこと", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        await advanceTimeInSlices(
          restartCaptionLeadMs +
            introStartTransitionMs +
            introStartHoldMs -
            100,
        );
        const captionWhileHolding = screen.queryByText(startCaption);
        const hintedWhileHolding = getHintedTiles();
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
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("名前と一文、完成した盤面、始めの盤面を、それぞれ一言と一緒に止めて順に見せてから、最初の手順を始めること", () => {
      const nameStage = {
        tagline: screen.queryByText(tagline) !== null,
        caption:
          screen.queryByText(goalCaption) ?? screen.queryByText(startCaption),
      };
      advanceTime(stillIntroStageMs);
      const goalStage = {
        caption: screen.queryByText(goalCaption) !== null,
        position: getTilePosition(6),
      };
      advanceTime(stillIntroStageMs);
      const startStage = {
        caption: screen.queryByText(startCaption) !== null,
        position: getTilePosition(6),
        hinted: getHintedTiles(),
      };
      advanceTime(stillIntroStageMs);

      const headline = screen.getByText(firstHeadline);
      const hinted = getHintedTiles();

      expect(nameStage).toEqual({ tagline: true, caption: null });
      expect(goalStage).toEqual({ caption: true, position: "2行3列" });
      expect(startStage).toEqual({
        caption: true,
        position: "1行3列",
        hinted: [],
      });
      expect(headline).toBeTruthy();
      expect(screen.queryByText(tagline)).toBeNull();
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["6"]);
    });

    test("画面を押すと、止めて見せている途中でも導入を飛ばすこと", () => {
      advanceTime(stillIntroStageMs);
      skipIntro();

      const position = getTilePosition(6);
      const hinted = getHintedTiles();

      expect(screen.queryByText(goalCaption)).toBeNull();
      expect(position).toBe("1行3列");
      expect(hinted).toEqual(["6"]);
    });

    test("解き終えた後のもう一度で、始めの盤面を一言と一緒に止めて見せてから、最初の手順を始めること", () => {
      skipIntro();
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      const captionWhileStill = screen.getByText(startCaption);
      const positionWhileStill = getTilePosition(6);
      advanceTime(stillIntroStageMs);

      const hinted = getHintedTiles();

      expect(captionWhileStill).toBeTruthy();
      expect(positionWhileStill).toBe("1行3列");
      expect(screen.queryByText(startCaption)).toBeNull();
      expect(hinted).toEqual(["6"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("解き終えると、プレイ中の盤面につなぐ一言を出し、プレイに戻る操作で閉じること", () => {
      solveAll();
      const detail = screen.getByText(
        "プレイ中の盤面も、同じ動かし方で並べます",
      );
      const levelDetail = screen.queryByText(
        "レベル1は、少し回り道が要る盤面です",
      );
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(levelDetail).toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
