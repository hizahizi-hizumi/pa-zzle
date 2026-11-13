import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

type CellPlacement = readonly [row: number, column: number, tile: "A" | "B"];

/** 手順ごとに印を付けるマスと、その解。0は1回、1は2回タップして置く。 */
const stepPlacements: readonly (readonly CellPlacement[])[] = [
  [[4, 1, "A"]],
  [[1, 4, "B"]],
  [[2, 3, "A"]],
  [[1, 1, "A"]],
  [[2, 4, "A"]],
  [[3, 4, "A"]],
  [[1, 3, "B"]],
  [
    [3, 2, "A"],
    [3, 3, "B"],
  ],
];

const remainingPlacements: readonly CellPlacement[] = [
  [4, 2, "B"],
  [4, 3, "A"],
];

const violationReactionDelayMs = 500;

/** 手順のマスを正しい手へ向かう途中にしたまま手が止まってから、盤面にルールに合わないところを示すまでの間。 */
const towardStepRevealDelayMs = 1000;

const nextStepCueDelayMs = 900;

const idleHintDelayMs = 4000;

/** 名前を出してから、盤面の段に入るまでの間。 */
const introBoardStartMs = 550;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
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

/** 導入は自動では先へ進まない。 */
function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

function pressNextThroughIntroWaitingForScenes(): void {
  for (let press = 0; press < 3; press += 1) {
    advanceTime(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  advanceTime(introEnoughMs);
}

/** 場面の動きと Animation の完了を待っては「次へ」を押し、導入を最後まで進める。 */
async function goThroughIntro(): Promise<void> {
  for (let press = 0; press < 3; press += 1) {
    await advanceTimeInSlices(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  await advanceTimeInSlices(introEnoughMs);
}

/** 場面の動きを待たずに「次へ」を続けて押し、ゴールと始まりの盤面を通って最初の手順から始める。 */
function pressNextThroughIntro(): void {
  for (
    let next = screen.queryByRole("button", { name: "次へ" });
    next;
    next = screen.queryByRole("button", { name: "次へ" })
  ) {
    fireEvent.click(next);
  }
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

/** 手順の間は、置いたマスへの応えを見せてから次の印が付くまで待って進める。最後の手順を終えた後は待たない。 */
function finishSteps(count: number): void {
  stepPlacements.slice(0, count).forEach((placements, index) => {
    if (index > 0) {
      advanceTime(nextStepCueDelayMs);
    }
    placeAll(placements);
  });
}

function solveAll(): void {
  finishSteps(stepPlacements.length);
  placeAll(remainingPlacements);
}

function getCuedCellPositions(kind: "hint" | "fitted"): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(`[data-cell-cue="${kind}"]`))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[0] ?? "");
}

function getSpotlitCellPositions(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector("[data-tutorial-spotlight]"))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[0] ?? "");
}

function getHintedCellPositions(): string[] {
  return getCuedCellPositions("hint");
}

/** 本番と同じく、盤面の縁の外の両端に違反の印を付けている行・列の数。 */
function getViolatedLineCount(): number {
  return getBoard().querySelectorAll("span[data-violated]").length / 2;
}

function getRecallCue(row: number, column: number): Element | null {
  return getCell(row, column).querySelector('[data-tutorial-cue="recall"]');
}

function getRuleItems(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "ルール" })).getAllByRole(
    "listitem",
  );
}

function getRuleTexts(): string[] {
  return getRuleItems().map((item) => item.textContent ?? "");
}

function getCellLabel(row: number, column: number): string | null {
  return getCell(row, column).getAttribute("aria-label");
}

function getCurrentRuleTexts(): string[] {
  return getRuleItems()
    .filter((item) => item.querySelector('[aria-current="step"]'))
    .map((item) => item.textContent ?? "");
}

describe("TakuzuTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "3", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    let rerenderTutorial: (open: boolean) => void;

    beforeEach(() => {
      const { rerender } = render(
        <TakuzuTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
      rerenderTutorial = (open) =>
        rerender(
          <TakuzuTutorial
            open={open}
            playStart={playStart}
            onClose={onClose}
          />,
        );
      pressNextThroughIntro();
    });

    test("パズルの名前と4×4の盤面を出し、最初に押すマスと操作を示して、ルールを伏せておくこと", () => {
      const title = screen.getByRole("heading", { name: "バイナリパズル" });
      const cells = within(getBoard()).getAllByRole("button");
      const headline = screen.getByText("印のマスをタップすると0が入ります");
      const hinted = getHintedCellPositions();
      const rules = getRuleTexts();

      expect(title).toBeTruthy();
      expect(cells).toHaveLength(16);
      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["4行1列"]);
      expect(rules).toEqual([
        "まだ出ていないルール",
        "まだ出ていないルール",
        "まだ出ていないルール",
      ]);
    });

    test("印のマスをタップすると0になり、そのマスに応えて、1の置き方と次のマスを示すこと", () => {
      tapCell(4, 1);
      const fitted = getCuedCellPositions("fitted");
      const spotlitRightAfter = getSpotlitCellPositions();
      advanceTime(nextStepCueDelayMs);

      const label = getCell(4, 1).getAttribute("aria-label");
      const message = screen.getByText("2回タップすると1が入ります");
      const hinted = getHintedCellPositions();

      expect(label).toBe("4行1列 0");
      expect(fitted).toEqual(["4行1列"]);
      expect(spotlitRightAfter).toEqual(["4行1列"]);
      expect(message).toBeTruthy();
      expect(hinted).toEqual(["1行4列"]);
    });

    test("操作を教える手順では、画面全体に覆いを重ね、印のマスだけを覆いから抜くこと", () => {
      const scrim = document.querySelector("[data-tutorial-focus-scrim]");
      const spotlit = getSpotlitCellPositions();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual(["4行1列"]);
    });

    test("タップで置くと本番と同じ置いた音を、固定マスを押すと本番と同じ通らない音を鳴らすこと", () => {
      tapCell(4, 1);
      tapCell(1, 2);

      const playedUrls = vi
        .mocked(playSound)
        .mock.calls.map(([sound]) => sound.url);

      expect(playedUrls).toEqual([
        expect.stringContaining("tile-a-placed"),
        expect.stringContaining("invalid"),
      ]);
    });

    const outsideCases = [
      ["印の無い空きマスをタップする", () => tapCell(1, 3)],
      [
        "印の無い空きマスにキーで置く",
        () => {
          act(() => {
            getCell(2, 3).focus();
          });
          fireEvent.keyDown(getCell(2, 3), { key: "1" });
        },
      ],
      ["固定マスをタップする", () => tapCell(1, 2)],
    ] as const;

    test.each(outsideCases)(
      "%sと、何も置かず、赤を使わずに印の線を濃くし直すこと",
      (_, operate) => {
        operate();
        const firstRecall = getRecallCue(4, 1);
        operate();
        const secondRecall = getRecallCue(4, 1);

        expect(getCell(1, 3).getAttribute("aria-label")).toBe("1行3列 空き");
        expect(getCell(2, 3).getAttribute("aria-label")).toBe("2行3列 空き");
        expect(getHintedCellPositions()).toEqual(["4行1列"]);
        expect(firstRecall).not.toBeNull();
        expect(secondRecall).not.toBeNull();
        expect(secondRecall).not.toBe(firstRecall);
        expect(screen.queryByText(/続いています|多すぎる/)).toBeNull();
      },
    );

    test("手順どおりに置いた後は、印の線を濃くし直さないこと", () => {
      tapCell(1, 3);
      tapCell(4, 1);
      advanceTime(nextStepCueDelayMs);

      const recalled = within(getBoard())
        .getAllByRole("button")
        .filter((cell) => cell.querySelector('[data-tutorial-cue="recall"]'));

      expect(getHintedCellPositions()).toEqual(["1行4列"]);
      expect(recalled).toEqual([]);
    });

    describe("3つ続かないことを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(2);
        advanceTime(nextStepCueDelayMs);
      });

      test("ルールを示してルールの並びに加え、今示しているルールとして目立たせること", () => {
        const message = screen.getByText("同じ数字は3つ続けられません");
        const rules = getRuleTexts();
        const currentRules = getCurrentRuleTexts();

        expect(message).toBeTruthy();
        expect(rules).toEqual([
          "3つ続けない",
          "まだ出ていないルール",
          "まだ出ていないルール",
        ]);
        expect(currentRules).toEqual(["3つ続けない"]);
      });

      test("キーで1を置いて違反が続くと、違反の一言を出し、タイルは揺らさず、印を付け続けること", () => {
        const animate = installAnimate();
        act(() => {
          getCell(2, 3).focus();
        });
        fireEvent.keyDown(getCell(2, 3), { key: "1" });
        const messageBeforeSettled = screen.queryByText("1が3つ続いています");
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("1が3つ続いています");
        const label = getCell(2, 3).getAttribute("aria-label");

        expect(messageBeforeSettled).toBeNull();
        expect(message).toBeTruthy();
        expect(label).toBe("2行3列 1 3連続");
        expect(animate).not.toHaveBeenCalled();
        expect(getHintedCellPositions()).toEqual(["2行3列"]);
      });

      test("印のマスと、そのマスを決める隣の2つの1だけを覆いから抜くこと", () => {
        const spotlit = getSpotlitCellPositions();

        expect(spotlit).toEqual(["2行1列", "2行2列", "2行3列"]);
      });

      test("0を置くと、そのマスに応え、置いたマスと決め手を見せたまま、次の印とその決め手に替えること", () => {
        tapCell(2, 3);
        const fitted = getCuedCellPositions("fitted");
        const hintedRightAfter = getHintedCellPositions();
        const spotlitRightAfter = getSpotlitCellPositions();
        advanceTime(nextStepCueDelayMs);

        const hinted = getHintedCellPositions();
        const spotlit = getSpotlitCellPositions();

        expect(fitted).toEqual(["2行3列"]);
        expect(hintedRightAfter).toEqual([]);
        expect(spotlitRightAfter).toEqual(["2行1列", "2行2列", "2行3列"]);
        expect(hinted).toEqual(["1行1列"]);
        expect(spotlit).toEqual(["1行1列", "2行1列", "3行1列"]);
      });

      test("置いたマスと決め手を見せている間は、一言も終えた手順のままにし、次の印と一緒に替えること", () => {
        tapCell(2, 3);
        const messageRightAfter = screen.queryByText(
          "同じ数字は3つ続けられません",
        );
        advanceTime(nextStepCueDelayMs);

        const message = screen.queryByText("縦にも3つ続けられません");

        expect(messageRightAfter).not.toBeNull();
        expect(message).not.toBeNull();
      });
    });

    describe("おさらいの手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(stepPlacements.length - 2);
        advanceTime(nextStepCueDelayMs);
      });

      test("1へ向かう途中の0では、すぐには3つ続くことを示さず、違反の一言も揺れも出さないこと", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(towardStepRevealDelayMs - 1);

        const message = screen.getByText(
          "ここまでのルールで このマスも分かります",
        );
        const label = getCell(1, 3).getAttribute("aria-label");

        expect(message).toBeTruthy();
        expect(label).toBe("1行3列 0");
        expect(animate).not.toHaveBeenCalled();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
      });

      test("1へ向かう途中の0のまま手が止まると、盤面で3つ続くマスを示し、違反の一言も揺れも出さずに印を付け続けること", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(towardStepRevealDelayMs);

        const message = screen.getByText(
          "ここまでのルールで このマスも分かります",
        );
        const labels = [getCellLabel(1, 1), getCellLabel(1, 3)];

        expect(message).toBeTruthy();
        expect(labels).toEqual([
          "1行1列 0 3連続 行の個数超過",
          "1行3列 0 3連続 行の個数超過",
        ]);
        expect(animate).not.toHaveBeenCalled();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
      });

      test("1へ向かう途中の0からすぐ1にすると、3つ続くことを示さないこと", () => {
        tapCell(1, 3);
        advanceTime(towardStepRevealDelayMs / 2);
        tapCell(1, 3);
        advanceTime(towardStepRevealDelayMs * 2);

        const labels = [getCellLabel(1, 1), getCellLabel(1, 3)];

        expect(labels).toEqual(["1行1列 0", "1行3列 1"]);
      });

      test("違反が続く前に1へ切り替えると、違反に応えず次の手順へ進むこと", () => {
        const animate = installAnimate();
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs / 2);
        tapCell(1, 3);
        advanceTime(violationReactionDelayMs * 2);

        const message = screen.getByText("同じ並びの行や列は作れません");
        const violationMessage = screen.queryByText(/続いています|多すぎ/);

        expect(message).toBeTruthy();
        expect(violationMessage).toBeNull();
        expect(animate).not.toHaveBeenCalled();
      });

      test("解と違う0では応えず、1を置くとそのマスに応えること", () => {
        tapCell(1, 3);
        const fittedOnSquare = getCuedCellPositions("fitted");
        tapCell(1, 3);

        const fittedOnCircle = getCuedCellPositions("fitted");

        expect(fittedOnSquare).toEqual([]);
        expect(fittedOnCircle).toEqual(["1行3列"]);
      });
    });

    describe("同じ数を示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(4);
        advanceTime(nextStepCueDelayMs);
      });

      test("ルールを示してルールの並びに加え、今示しているルールとして目立たせること", () => {
        const message = screen.getByText("どの行にも0と1が 同じ数ずつ入ります");
        const rules = getRuleTexts();
        const currentRules = getCurrentRuleTexts();

        expect(message).toBeTruthy();
        expect(rules).toEqual([
          "3つ続けない",
          "同じ数にする",
          "まだ出ていないルール",
        ]);
        expect(currentRules).toEqual(["同じ数にする"]);
      });

      test("1が多すぎる行を作ると、本番と同じくその行の縁の外に印を付け、違反の一言を出し、まだ伝えていない列の多すぎは見せないこと", () => {
        act(() => {
          getCell(2, 4).focus();
        });
        fireEvent.keyDown(getCell(2, 4), { key: "1" });
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("この行は1が多すぎます");
        const label = getCellLabel(2, 4);

        expect(message).toBeTruthy();
        expect(label).toBe("2行4列 1 行の個数超過");
        expect(getViolatedLineCount()).toBe(1);
      });
    });

    describe("同じ並びを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(7);
        advanceTime(nextStepCueDelayMs);
      });

      test("ルールを示してルールの並びに加え、3行目の2マスに印を付けること", () => {
        const message = screen.getByText("同じ並びの行や列は作れません");
        const detail = screen.getByText("上の行と見比べると分かります");
        const rules = getRuleTexts();
        const currentRules = getCurrentRuleTexts();
        const hinted = getHintedCellPositions();

        expect(message).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(rules).toEqual([
          "3つ続けない",
          "同じ数にする",
          "同じ並びにしない",
        ]);
        expect(currentRules).toEqual(["同じ並びにしない"]);
        expect(hinted).toEqual(["3行2列", "3行3列"]);
      });

      test("印の2マスと、見比べる上の行だけを覆いから抜くこと", () => {
        const spotlit = getSpotlitCellPositions();

        expect(spotlit).toEqual([
          "2行1列",
          "2行2列",
          "2行3列",
          "2行4列",
          "3行2列",
          "3行3列",
        ]);
      });

      test("上の行と同じ並びにすると、上の行と同じ並びになっていることを伝え、2つの行に印を付けること", () => {
        tapCell(3, 2);
        tapCell(3, 2);
        tapCell(3, 3);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("上の行と同じ並びになっています");
        const spotlit = getSpotlitCellPositions();

        expect(message).toBeTruthy();
        expect(getViolatedLineCount()).toBe(2);
        expect(spotlit).toEqual([
          "2行1列",
          "2行2列",
          "2行3列",
          "2行4列",
          "3行1列",
          "3行2列",
          "3行3列",
          "3行4列",
        ]);
      });

      test("同じ並びから1マスだけ直しても、もう片方のせいで3つ続くと、そのことを伝えて3つ続くマスと多すぎる行を示すこと", () => {
        tapCell(3, 2);
        tapCell(3, 2);
        tapCell(3, 3);
        advanceTime(violationReactionDelayMs);
        tapCell(3, 3);
        advanceTime(violationReactionDelayMs);

        const message = screen.getByText("1が3つ続いています");
        const label = getCellLabel(3, 3);

        expect(message).toBeTruthy();
        expect(label).toBe("3行3列 1 3連続 行の個数超過");
        expect(getViolatedLineCount()).toBe(1);
        expect(getHintedCellPositions()).toEqual(["3行2列"]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(stepPlacements.length);
      });

      test("覆いを重ねず、手が止まって印が出ても覆いを重ねないこと", () => {
        const scrim = document.querySelector("[data-tutorial-focus-scrim]");
        advanceTime(idleHintDelayMs);

        const scrimWithHint = document.querySelector(
          "[data-tutorial-focus-scrim]",
        );
        const spotlit = getSpotlitCellPositions();

        expect(scrim).toBeNull();
        expect(scrimWithHint).toBeNull();
        expect(spotlit).toEqual([]);
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

      test("どのマスにも置け、正しく置いても応えないこと", () => {
        tapCell(4, 3);

        const label = getCell(4, 3).getAttribute("aria-label");
        const fitted = getCuedCellPositions("fitted");

        expect(label).toBe("4行3列 0");
        expect(fitted).toEqual([]);
      });

      test("ルールに合わない手を置いて違反が続くと、違反の一言を出すこと", () => {
        tapCell(4, 2);
        advanceTime(violationReactionDelayMs);

        const label = getCell(4, 2).getAttribute("aria-label");
        const message = screen.getByText("この列は0が多すぎます");
        const freePlayMessage = screen.queryByText("残りを埋めると完成です");

        expect(label).toBe("4行2列 0 列の個数超過");
        expect(message).toBeTruthy();
        expect(freePlayMessage).toBeNull();
      });
    });

    test("解き終えると、終わりの一言を出し、ゲームのホームで開いているレベルを遊ぶ操作で本番を始めること", () => {
      solveAll();
      const message = screen.getByText("完成です");
      const detail = screen.getByText("どのレベルも 8×8 の盤面です");
      fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

      expect(message).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(playStart.onStart).toHaveBeenCalledOnce();
    });

    test("解き終えると、本番と同じクリア音を鳴らすこと", () => {
      solveAll();

      const layerUrls = vi
        .mocked(playLayeredSound)
        .mock.calls.map(([layers]) => layers.map(({ sound }) => sound.url));

      expect(layerUrls).toEqual([
        [
          expect.stringContaining("cleared-wave-1"),
          expect.stringContaining("cleared-wave-2"),
          expect.stringContaining("cleared-wave-3"),
          expect.stringContaining("cleared-wave-4"),
          expect.stringContaining("cleared-wave-5"),
          expect.stringContaining("cleared-chord"),
        ],
      ]);
    });

    test("終えた後のもう一度で、始まりの盤面を見せてから最初から始めること", () => {
      solveAll();
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
      const caption = screen.getByText("最初は一部のマスだけ埋まっています");
      pressNextThroughIntroWaitingForScenes();

      const message = screen.getByText("印のマスをタップすると0が入ります");
      const label = getCell(4, 1).getAttribute("aria-label");
      const rules = getRuleTexts();

      expect(caption).toBeTruthy();
      expect(message).toBeTruthy();
      expect(label).toBe("4行1列 空き");
      expect(rules).toEqual([
        "まだ出ていないルール",
        "まだ出ていないルール",
        "まだ出ていないルール",
      ]);
    });

    test("閉じてから開き直すと、最初から始まること", () => {
      finishSteps(3);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);
      pressNextThroughIntro();

      const message = screen.getByText("印のマスをタップすると0が入ります");

      expect(onClose).toHaveBeenCalledOnce();
      expect(message).toBeTruthy();
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <TakuzuTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
    });

    test("開くと、パズル選択と同じピクトグラムと名前、何をするパズルかを出し、解き終えた盤面を、印を付けずに見せること", () => {
      const pictograms = screen.getAllByRole("img", {
        name: "バイナリパズル",
        hidden: true,
      });
      const title = screen.getByRole("heading", { name: "バイナリパズル" });
      const purpose = screen.getByText(
        "すべてのマスを0か1で ルールどおりに埋めるパズルです",
      );
      const labels = [getCellLabel(1, 1), getCellLabel(3, 3)];
      const hinted = getHintedCellPositions();

      expect(pictograms.length).toBeGreaterThan(0);
      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(labels).toEqual(["1行1列 0", "3行3列 1"]);
      expect(hinted).toEqual([]);
    });

    test("次へで最後まで進めると、始めの盤面で最初の手順の一言と印を出すこと", async () => {
      await goThroughIntro();

      const headline = screen.getByText("印のマスをタップすると0が入ります");
      const labels = [getCellLabel(4, 1), getCellLabel(1, 2)];
      const hinted = getHintedCellPositions();
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(labels).toEqual(["4行1列 空き", "1行2列 0 固定"]);
      expect(hinted).toEqual(["4行1列"]);
      expect(rules).toEqual([
        "まだ出ていないルール",
        "まだ出ていないルール",
        "まだ出ていないルール",
      ]);
    });

    describe("盤面の段まで進んだ場合", () => {
      beforeEach(async () => {
        await advanceTimeInSlices(introBoardStartMs);
      });

      test("盤面を押しても、タイルを替えないこと", () => {
        tapCell(3, 3);

        const label = getCellLabel(3, 3);
        const hinted = getHintedCellPositions();

        expect(label).toBe("3行3列 1");
        expect(hinted).toEqual([]);
      });

      const finishMotionCases = [
        ["画面を押す", () => fireEvent.pointerDown(getBoard())],
        [
          "閉じるボタンにフォーカスがあるままキーを押す",
          () =>
            fireEvent.keyDown(screen.getByRole("button", { name: "閉じる" }), {
              key: "Enter",
            }),
        ],
      ] as const;

      test.each(finishMotionCases)(
        "%sと、ゴールの盤面を見せたまま、始まりの盤面へも最初の手順へも進まないこと",
        (_, finishMotion) => {
          finishMotion();
          advanceTime(introEnoughMs);

          const caption = screen.getByText("この盤面がゴールです");
          const label = getCellLabel(1, 1);
          const hinted = getHintedCellPositions();

          expect(caption).toBeTruthy();
          expect(label).toBe("1行1列 0");
          expect(hinted).toEqual([]);
          expect(onClose).not.toHaveBeenCalled();
        },
      );
    });

    describe("解き終えた場合", () => {
      beforeEach(async () => {
        await goThroughIntro();
        solveAll();
        await goThroughIntro();
      });

      test("もう一度で、置いたタイルを消してから最初の手順を始めること", async () => {
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const labelWhileRewinding = getCellLabel(1, 1);
        await goThroughIntro();

        const label = getCellLabel(1, 1);
        const hinted = getHintedCellPositions();

        expect(labelWhileRewinding).toBe("1行1列 0");
        expect(label).toBe("1行1列 空き");
        expect(hinted).toEqual(["4行1列"]);
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      render(<TakuzuTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "すべてのマスを0か1で ルールどおりに埋めるパズルです",
      );
      const caption = screen.getByText("この盤面がゴールです");
      const label = getCellLabel(1, 1);

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(label).toBe("1行1列 0");
    });

    test("ゴールで次へを押すと、始まりの一言を添えて始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.getByText("最初は一部のマスだけ埋まっています");
      const label = getCellLabel(1, 1);

      expect(caption).toBeTruthy();
      expect(label).toBe("1行1列 空き");
    });

    test("次へで最後まで進めると、始めの盤面の最初の手順から始めること", () => {
      pressNext();
      pressNextThroughIntroWaitingForScenes();

      const headline = screen.getByText("印のマスをタップすると0が入ります");
      const label = getCellLabel(4, 1);
      const hinted = getHintedCellPositions();

      expect(headline).toBeTruthy();
      expect(label).toBe("4行1列 空き");
      expect(hinted).toEqual(["4行1列"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
    });

    test("解き終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      solveAll();
      const detail = screen.getByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
