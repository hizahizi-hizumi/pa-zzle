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

/** 名前を出してから、盤面の段に入るまでの間。 */
const introBoardStartMs = 550;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 3500;

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

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤面" });
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

/** 番号の場所に収まっているとして示しているタイル。 */
function getInPlaceTiles(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.hasAttribute("data-in-place"))
    .map((tile) => tile.textContent ?? "")
    .sort();
}

/** 各マスに薄く出している、そこへ入る番号。 */
function getGoalSlotNumbers(): string[] {
  return Array.from(
    getBoard().querySelectorAll("[data-goal-slot]"),
    (slot) => slot.textContent ?? "",
  );
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
    });

    test("パズルの名前と3×3の盤面を出し、何を目指すかと最初に押すタイルを示すこと", () => {
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const tiles = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("左上から1〜8と並べ、右下を空けます");
      const detail = screen.getByText(
        "空白の隣のタイルは、タップで空白へ滑ります",
      );
      const hinted = getHintedTiles();
      const chips = getRuleChipTexts();
      const currentChips = getCurrentRuleChipTexts();

      expect(title).toBeTruthy();
      expect(tiles).toHaveLength(8);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(hinted).toEqual(["6"]);
      expect(chips).toEqual(["空白へ滑る", "？"]);
      expect(currentChips).toEqual(["空白へ滑る"]);
    });

    test("各マスにそこへ入る番号を薄く出し、番号の場所にあるタイルを収まったとして示すこと", () => {
      const slotNumbers = getGoalSlotNumbers();
      const inPlaceBefore = getInPlaceTiles();
      tapTile(6);

      const inPlaceAfter = getInPlaceTiles();

      expect(slotNumbers).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
      expect(inPlaceBefore).toEqual(["7"]);
      expect(inPlaceAfter).toEqual(["6", "7"]);
    });

    test("印のタイルを押すと空白へ滑り、滑り終えてから次のタイルに印を付けること", () => {
      tapTile(6);
      const hintedRightAfter = getHintedTiles();
      advanceTime(nextStepCueDelayMs);

      const position = getTilePosition(6);
      const message = screen.getByText("空白と同じ行なら、遠くても滑ります");
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

    test("動かないタイルを押すと、滑らせずに揺らし、空白の隣のタイルだけが滑ることを伝えること", () => {
      const animate = installAnimate();
      tapTile(5);

      const position = getTilePosition(5);
      const headline = screen.getByText("このタイルは、空白の隣にありません");
      const detail = screen.getByText("空白の隣のタイルが、空白へ滑ります");

      expect(position).toBe("3行2列");
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(animate).toHaveBeenCalledOnce();
      expect(getHintedTiles()).toEqual(["6"]);
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

        expect(chips).toEqual(["空白へ滑る", "まとめて滑る"]);
        expect(currentChips).toEqual(["まとめて滑る"]);
        expect(positions).toEqual(["1行2列", "1行3列"]);
      });
    });

    describe("知っているルールで決まる手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(2);
      });

      test("空白に入る番号のことを伝えて、その番号のタイルに印を付けること", () => {
        const message = screen.getByText("空白には、その場所の番号が入ります");
        const currentChips = getCurrentRuleChipTexts();
        const hinted = getHintedTiles();

        expect(message).toBeTruthy();
        expect(currentChips).toEqual([]);
        expect(hinted).toEqual(["1"]);
      });

      test("動かないタイルを押すと、空白と同じ行・列のタイルだけが滑ることを伝えること", () => {
        tapTile(8);

        const headline = screen.getByText("空白と同じ行にも列にもありません");
        const detail = screen.getByText(
          "空白と同じ行・列のタイルだけが滑ります",
        );

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
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

      const message = screen.getByText("左上から1〜8と並べ、右下を空けます");
      const position = getTilePosition(6);
      const chips = getRuleChipTexts();

      expect(message).toBeTruthy();
      expect(position).toBe("1行3列");
      expect(chips).toEqual(["空白へ滑る", "？"]);
    });

    test("閉じてから開き直すと、最初から始まること", () => {
      finishSteps(2);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const message = screen.getByText("左上から1〜8と並べ、右下を空けます");

      expect(onClose).toHaveBeenCalledOnce();
      expect(message).toBeTruthy();
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

    test("開くと、パズル選択と同じピクトグラムと名前を出し、各マスに入る番号と完成した盤面を、印を付けずに見せること", () => {
      const pictogram = screen.getByRole("img", {
        name: "スライドパズル",
        hidden: true,
      });
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const slotNumbers = getGoalSlotNumbers();
      const positions = [getTilePosition(1), getTilePosition(6)];
      const inPlace = getInPlaceTiles();
      const hinted = getHintedTiles();

      expect(pictogram).toBeTruthy();
      expect(title).toBeTruthy();
      expect(slotNumbers).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
      expect(positions).toEqual(["1行1列", "2行3列"]);
      expect(inPlace).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
      expect(hinted).toEqual([]);
    });

    test("最後まで見せると、始めの盤面で最初の手順の一言と印を出すこと", async () => {
      await advanceTimeInSlices(introEnoughMs);

      const headline = screen.getByText("左上から1〜8と並べ、右下を空けます");
      const positions = [getTilePosition(1), getTilePosition(6)];
      const hinted = getHintedTiles();

      expect(headline).toBeTruthy();
      expect(positions).toEqual(["2行1列", "1行3列"]);
      expect(hinted).toEqual(["6"]);
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
            "左上から1〜8と並べ、右下を空けます",
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

      test("もう一度で、完成した盤面を崩してから最初の手順を始めること", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const positionWhileScrambling = getTilePosition(6);
        await advanceTimeInSlices(introEnoughMs);

        const position = getTilePosition(6);
        const hinted = getHintedTiles();

        expect(positionWhileScrambling).toBe("2行3列");
        expect(position).toBe("1行3列");
        expect(hinted).toEqual(["6"]);
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("導入を見せずに、始めの盤面の最初の手順から始めること", () => {
      const headline = screen.getByText("左上から1〜8と並べ、右下を空けます");
      const position = getTilePosition(6);
      const hinted = getHintedTiles();

      expect(headline).toBeTruthy();
      expect(position).toBe("1行3列");
      expect(hinted).toEqual(["6"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("解き終えると、プレイに戻る操作で閉じること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
