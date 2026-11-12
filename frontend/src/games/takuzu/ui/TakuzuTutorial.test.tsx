import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import {
  describeTakuzuTutorialRule,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import type { TutorialMessage } from "@/games/tutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

const { intro, rules, steps, freePlay, completion } = takuzuTutorial;

type CellPlacement = readonly [row: number, column: number, tile: "A" | "B"];

/** 手順ごとに印を付けるマスと、その解。 */
const stepPlacements: readonly (readonly CellPlacement[])[] = [
  [[4, 1, "B"]],
  [[1, 3, "B"]],
  [[2, 4, "B"]],
  [
    [3, 1, "B"],
    [3, 4, "A"],
  ],
];

/** 手順を終えた後に残る上と下の行のマスと、その解。 */
const remainingPlacements: readonly CellPlacement[] = [
  [1, 1, "A"],
  [1, 2, "A"],
  [1, 4, "B"],
  [4, 2, "A"],
  [4, 3, "B"],
];

const violationReactionDelayMs = 500;

/** 手順のマスを正しい手へ向かう途中にしたまま手が止まってから、盤面にルールに合わないところを示すまでの間。 */
const towardStepRevealDelayMs = 1000;

/** ルールの手順を終えてから、置いたマスと決め手を残して見せ、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 900;

/** 2マスを自分で埋める手順で、手が止まってから指を出すまでの間。 */
const idlePointerDelayMs = 4000;

/** 手を離した後に止まっていても、手がかりを勝手に出さないことを確かめる長さ。 */
const longIdleMs = 60_000;

/** 入口の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 2000;

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

/** 演出の完了は Animation の `finished` を待つので、区切りごとに Promise も進める。 */
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

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: TAKUZU_DISPLAY_NAME });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(text.replaceAll("\n", " "));
}

function queryMessage(
  message: TutorialMessage | undefined,
): HTMLElement | null {
  return queryShownText(message?.headline ?? "");
}

/** 入口の「はじめる」を押し、始めの盤面へ替える場面を終える。 */
function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

function pressHint(): void {
  fireEvent.click(within(getScreen()).getByRole("button", { name: "ヒント" }));
}

function getBoard(): HTMLElement {
  return within(getScreen()).getByRole("group", {
    name: `${TAKUZU_DISPLAY_NAME}盤面`,
  });
}

function getCell(row: number, column: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${row}行${column}列 `),
  });
}

function getCellLabel(row: number, column: number): string | null {
  return getCell(row, column).getAttribute("aria-label");
}

function tapCell(row: number, column: number): void {
  fireEvent.click(getCell(row, column));
}

/** キーで直接置く。`1` が四角、`2` が丸。 */
function pressKeyOnCell(row: number, column: number, key: "1" | "2"): void {
  act(() => {
    getCell(row, column).focus();
  });
  fireEvent.keyDown(getCell(row, column), { key });
}

function placeAll(placements: readonly CellPlacement[]): void {
  for (const [row, column, tile] of placements) {
    const tapCount = tile === "A" ? 1 : 2;
    for (let tap = 0; tap < tapCount; tap += 1) {
      tapCell(row, column);
    }
  }
}

/** 手順の間は、終えた手順を残して見せる間を待ってから次の手順へ進める。最後の手順を終えた後は待たない。 */
function finishSteps(count: number): void {
  stepPlacements.slice(0, count).forEach((placements, index) => {
    if (index > 0) {
      advanceTime(nextStepCueDelayMs);
    }
    placeAll(placements);
  });
}

/** 残りまで埋め、本番と同じ完成の演出を終える。 */
function solveAll(): void {
  finishSteps(stepPlacements.length);
  advanceTime(nextStepCueDelayMs);
  placeAll(remainingPlacements);
  advanceTime(0);
}

function getCellPositions(selector: string): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((cell) => cell.querySelector(selector))
    .map((cell) => cell.getAttribute("aria-label")?.split(" ")[0] ?? "");
}

function getCuedCellPositions(kind: "hint" | "fitted"): string[] {
  return getCellPositions(`[data-cell-cue="${kind}"]`);
}

function getHintedCellPositions(): string[] {
  return getCuedCellPositions("hint");
}

/** 指で指しているマスの位置。 */
function getPointedCellPositions(): string[] {
  return getCellPositions('[data-tutorial-cue="pointer"]');
}

/** 盤面の覆いから抜いて、元の明るさで見せているマスの位置。 */
function getSpotlitCellPositions(): string[] {
  return getCellPositions("[data-tutorial-spotlight]");
}

/** 盤面の中を覆う覆い。覆っていなければ `null`。 */
function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

/** 本番と同じく、盤面の縁の外の両端に違反の印を付けている行・列の数。 */
function getViolatedLineCount(): number {
  return getBoard().querySelectorAll("span[data-violated]").length / 2;
}

function getRecallCue(row: number, column: number): Element | null {
  return getCell(row, column).querySelector('[data-tutorial-cue="recall"]');
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

describe("TakuzuTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "3", onStart: vi.fn<() => void>() };
  });

  describe("開いた場合", () => {
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
    });

    test("入口で、名前と、何をするパズルかとゴールの一言を、印の無い解き終えた盤面と一緒に見せ、覆わないこと", () => {
      const title = within(getScreen()).getByRole("heading", {
        name: TAKUZU_DISPLAY_NAME,
      });
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const labels = [getCellLabel(1, 1), getCellLabel(4, 1)];

      expect(title).toBeTruthy();
      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(labels).toEqual(["1行1列 四角", "4行1列 丸"]);
      expect(getHintedCellPositions()).toEqual([]);
      expect(getPointedCellPositions()).toEqual([]);
      expect(getSpotlitCellPositions()).toEqual([]);
      expect(getScrim()).toBeNull();
      expect(getProgressValue()).toBe("0");
    });

    test("入口で盤面を押しても、ゴールの盤面を見せたまま、はじめるを待つこと", () => {
      tapCell(1, 1);

      const label = getCellLabel(1, 1);
      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(label).toBe("1行1列 四角");
      expect(startButton).not.toBeNull();
    });

    test("はじめるを押すと、始めの盤面に替え、最初の手順の一言と、指で指す印のマスを見せ、決め手が無いので覆わないこと", () => {
      pressStart();

      const headline = queryMessage(steps[0]?.message);
      const labels = [getCellLabel(4, 1), getCellLabel(2, 1)];

      expect(headline).not.toBeNull();
      expect(labels).toEqual(["4行1列 空き", "2行1列 四角 固定"]);
      expect(getHintedCellPositions()).toEqual(["4行1列"]);
      expect(getPointedCellPositions()).toEqual(["4行1列"]);
      expect(getSpotlitCellPositions()).toEqual([]);
      expect(getScrim()).toBeNull();
    });

    test("入口では、ヒントを出さないこと", () => {
      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("閉じてから開き直すと、入口から始まること", () => {
      pressStart();
      finishSteps(2);
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "閉じる" }),
      );
      rerenderTutorial(false);
      rerenderTutorial(true);

      const purpose = queryShownText(intro.purpose);

      expect(onClose).toHaveBeenCalledOnce();
      expect(purpose).not.toBeNull();
      expect(getProgressValue()).toBe("0");
    });
  });

  describe("ゲームのホームから開いて始めた場合", () => {
    beforeEach(() => {
      render(
        <TakuzuTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
      pressStart();
    });

    test("印のマスを1回タップすると四角になり、もう一度タップするよう途中の一言に替えて、印を付け続けること", () => {
      tapCell(4, 1);

      const label = getCellLabel(4, 1);
      const midway = queryMessage(steps[0]?.midwayMessage ?? undefined);

      expect(label).toBe("4行1列 四角");
      expect(midway).not.toBeNull();
      expect(getHintedCellPositions()).toEqual(["4行1列"]);
    });

    test("手を引いている間は、ヒントを出さないこと", () => {
      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("1回タップした四角のまま手が止まっても、ルールに合わないところが無ければ途中の一言のままにすること", () => {
      tapCell(4, 1);
      advanceTime(towardStepRevealDelayMs);

      const midway = queryMessage(steps[0]?.midwayMessage ?? undefined);

      expect(getCellLabel(4, 1)).toBe("4行1列 四角");
      expect(midway).not.toBeNull();
    });

    test("2回タップして丸にすると、そのマスに応えて見せたまま、待たずに次の印と一言に替え、進み具合を進めること", () => {
      tapCell(4, 1);
      tapCell(4, 1);

      const fitted = getCuedCellPositions("fitted");
      const headline = queryMessage(steps[1]?.message);

      expect(getCellLabel(4, 1)).toBe("4行1列 丸");
      expect(fitted).toEqual(["4行1列"]);
      expect(headline).not.toBeNull();
      expect(getHintedCellPositions()).toEqual(["1行3列"]);
      expect(getProgressValue()).toBe("10");
    });

    test("タップで置くと本番と同じ置いた音を、固定マスを押すと本番と同じ通らない音を鳴らすこと", () => {
      tapCell(4, 1);
      tapCell(2, 1);

      const playedUrls = vi
        .mocked(playSound)
        .mock.calls.map(([sound]) => sound.url);

      expect(playedUrls).toEqual([
        expect.stringContaining("tile-a-placed"),
        expect.stringContaining("invalid"),
      ]);
    });

    const outsideCases = [
      ["印の無い空きマスをタップする", () => tapCell(1, 1)],
      ["印の無い空きマスにキーで置く", () => pressKeyOnCell(1, 2, "1")],
      ["固定マスをタップする", () => tapCell(2, 1)],
    ] as const;

    test.each(outsideCases)(
      "%sと、何も置かず、赤を使わずに、指で指したまま印の線を濃くし直すこと",
      (_, operate) => {
        operate();
        const firstRecall = getRecallCue(4, 1);
        operate();
        const secondRecall = getRecallCue(4, 1);

        expect(getCellLabel(1, 1)).toBe("1行1列 空き");
        expect(getCellLabel(1, 2)).toBe("1行2列 空き");
        expect(getHintedCellPositions()).toEqual(["4行1列"]);
        expect(getPointedCellPositions()).toEqual(["4行1列"]);
        expect(firstRecall).not.toBeNull();
        expect(secondRecall).not.toBeNull();
        expect(secondRecall).not.toBe(firstRecall);
        expect(queryShownText("四角が3つ続いています")).toBeNull();
      },
    );

    test("手順どおりに置いた後は、印の線を濃くし直さないこと", () => {
      tapCell(1, 1);
      finishSteps(1);

      const recalled = getCellPositions('[data-tutorial-cue="recall"]');

      expect(getHintedCellPositions()).toEqual(["1行3列"]);
      expect(recalled).toEqual([]);
    });

    describe("3つ続かないことを示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("ルールを示し、印のマスを指で指して、そのマスと決める縦に並んだ2つの四角だけを覆いから抜くこと", () => {
        const headline = queryMessage(steps[1]?.message);

        expect(headline).not.toBeNull();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
        expect(getPointedCellPositions()).toEqual(["1行3列"]);
        expect(getScrim()).not.toBeNull();
        expect(getSpotlitCellPositions()).toEqual([
          "1行3列",
          "2行3列",
          "3行3列",
        ]);
      });

      test("キーで四角を置いて違反が続くと、置き直し方を添えた違反の一言を出し、タイルは揺らさず、印を付け続けること", () => {
        const animate = installAnimate();
        pressKeyOnCell(1, 3, "1");
        const messageBeforeSettled = queryShownText("四角が3つ続いています");
        advanceTime(violationReactionDelayMs);

        const message = queryShownText("四角が3つ続いています");
        const detail = queryShownText("もう一度タップすると丸に変わります");

        expect(messageBeforeSettled).toBeNull();
        expect(message).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getCellLabel(1, 3)).toBe("1行3列 四角 3連続");
        expect(animate).not.toHaveBeenCalled();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
      });

      test("1回タップした四角のまま手が止まると、盤面で3つ続くマスを示し、一言をその違反に替えること", () => {
        tapCell(1, 3);
        advanceTime(towardStepRevealDelayMs - 1);
        const labelBeforeSettled = getCellLabel(1, 3);
        const headlineBeforeSettled = queryMessage(steps[1]?.message);
        advanceTime(1);

        const message = queryShownText("四角が3つ続いています");
        const detail = queryShownText("もう一度タップすると丸に変わります");

        expect(labelBeforeSettled).toBe("1行3列 四角");
        expect(headlineBeforeSettled).not.toBeNull();
        expect(getCellLabel(1, 3)).toBe("1行3列 四角 3連続");
        expect(message).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getHintedCellPositions()).toEqual(["1行3列"]);
      });

      test("丸を置くと、進み具合をすぐ進め、置いたマスと決め手と一言を残して見せてから、次の印とその決め手と一言に替えること", () => {
        tapCell(1, 3);
        tapCell(1, 3);
        const fitted = getCuedCellPositions("fitted");
        const hintedRightAfter = getHintedCellPositions();
        const spotlitRightAfter = getSpotlitCellPositions();
        const headlineRightAfter = queryMessage(steps[1]?.message);
        const progressRightAfter = getProgressValue();
        advanceTime(nextStepCueDelayMs - 1);
        const headlineBeforeNext = queryMessage(steps[1]?.message);
        advanceTime(1);

        const headline = queryMessage(steps[2]?.message);

        expect(fitted).toEqual(["1行3列"]);
        expect(hintedRightAfter).toEqual([]);
        expect(spotlitRightAfter).toEqual(["1行3列", "2行3列", "3行3列"]);
        expect(headlineRightAfter).not.toBeNull();
        expect(progressRightAfter).toBe("20");
        expect(headlineBeforeNext).not.toBeNull();
        expect(headline).not.toBeNull();
        expect(getHintedCellPositions()).toEqual(["2行4列"]);
        expect(getPointedCellPositions()).toEqual(["2行4列"]);
        expect(getSpotlitCellPositions()).toEqual([
          "2行1列",
          "2行2列",
          "2行3列",
          "2行4列",
        ]);
      });
    });

    describe("同じ数を示す手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(2);
        advanceTime(nextStepCueDelayMs);
      });

      test("四角が多すぎる行を作ると、本番と同じくその行の縁の外に印を付け、違反の一言を出すこと", () => {
        pressKeyOnCell(2, 4, "1");
        advanceTime(violationReactionDelayMs);

        const message = queryShownText("この行は四角が多すぎます");

        expect(message).not.toBeNull();
        expect(getCellLabel(2, 4)).toBe("2行4列 四角 行の個数超過");
        expect(getViolatedLineCount()).toBe(1);
      });
    });

    describe("同じ並びを示す手順に進んだ場合", () => {
      const comparedCells = [
        "2行1列",
        "2行2列",
        "2行3列",
        "2行4列",
        "3行1列",
        "3行2列",
        "3行3列",
        "3行4列",
      ];

      beforeEach(() => {
        finishSteps(3);
        advanceTime(nextStepCueDelayMs);
      });

      test("ルールと埋め方を示し、3行目の2マスに印だけを付けて指では指さず、3行目と見比べる上の行を覆いから抜くこと", () => {
        const headline = queryMessage(steps[3]?.message);
        const detail = queryShownText(steps[3]?.message.detail ?? "");

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getHintedCellPositions()).toEqual(["3行1列", "3行4列"]);
        expect(getPointedCellPositions()).toEqual([]);
        expect(getSpotlitCellPositions()).toEqual(comparedCells);
      });

      test("手が止まると、最初に埋める印のマスを指で指し、ヒントは出さないこと", () => {
        advanceTime(idlePointerDelayMs - 1);
        const pointedBeforeIdle = getPointedCellPositions();
        advanceTime(1);

        const pointed = getPointedCellPositions();
        const hintButton = queryHintButton();

        expect(pointedBeforeIdle).toEqual([]);
        expect(pointed).toEqual(["3行1列"]);
        expect(hintButton).toBeNull();
      });

      test("1マス置いても、覆いから抜くマスを替えないこと", () => {
        tapCell(3, 4);

        expect(getHintedCellPositions()).toEqual(["3行1列"]);
        expect(getSpotlitCellPositions()).toEqual(comparedCells);
      });

      describe("上の行と同じ並びにした場合", () => {
        beforeEach(() => {
          pressKeyOnCell(3, 1, "1");
          pressKeyOnCell(3, 4, "2");
          advanceTime(violationReactionDelayMs);
        });

        test("上の行と同じ並びになっていることを伝え、2つの行に印を付けること", () => {
          const message = queryShownText("上の行と同じ並びになっています");

          expect(message).not.toBeNull();
          expect(getViolatedLineCount()).toBe(2);
          expect(getSpotlitCellPositions()).toEqual(comparedCells);
        });

        test("1マスだけ直しても、もう片方のせいで多すぎると、そのことを伝えて多すぎる行を示すこと", () => {
          tapCell(3, 1);
          advanceTime(violationReactionDelayMs);

          const message = queryShownText("この行は丸が多すぎます");

          expect(message).not.toBeNull();
          expect(getCellLabel(3, 1)).toBe("3行1列 丸 行の個数超過");
          expect(getViolatedLineCount()).toBe(1);
          expect(getHintedCellPositions()).toEqual(["3行4列"]);
        });
      });

      describe("片方に解の四角を置いて、もう片方を丸へ向かう途中の四角にした場合", () => {
        let animate: ReturnType<typeof installAnimate>;

        beforeEach(() => {
          animate = installAnimate();
          tapCell(3, 4);
          tapCell(3, 1);
        });

        test("すぐには多すぎることを示さず、違反の一言も揺れも出さず、そのマスに応えないこと", () => {
          advanceTime(towardStepRevealDelayMs - 1);

          const headline = queryMessage(steps[3]?.message);

          expect(headline).not.toBeNull();
          expect(getCellLabel(3, 1)).toBe("3行1列 四角");
          expect(getCuedCellPositions("fitted")).toEqual([]);
          expect(getHintedCellPositions()).toEqual(["3行1列"]);
          expect(animate).not.toHaveBeenCalled();
        });

        test("手が止まると、盤面で多すぎる行を示し、一言をその違反に替え、揺れは出さずに印を付け続けること", () => {
          advanceTime(towardStepRevealDelayMs);

          const message = queryShownText("この行は四角が多すぎます");
          const detail = queryShownText("もう一度タップすると丸に変わります");

          expect(message).not.toBeNull();
          expect(detail).not.toBeNull();
          expect(getCellLabel(3, 1)).toBe("3行1列 四角 行の個数超過");
          expect(getHintedCellPositions()).toEqual(["3行1列"]);
          expect(animate).not.toHaveBeenCalled();
        });

        test("違反が続く前に丸にすると、多すぎることを示さず、そのマスに応え、終えた手順を残して見せてから手を離すこと", () => {
          advanceTime(violationReactionDelayMs / 2);
          tapCell(3, 1);
          const fitted = getCuedCellPositions("fitted");
          const headlineRightAfter = queryMessage(steps[3]?.message);
          const spotlitRightAfter = getSpotlitCellPositions();
          advanceTime(nextStepCueDelayMs);

          const freePlayMessage = queryMessage(freePlay);

          expect(fitted).toEqual(["3行1列"]);
          expect(getCellLabel(3, 1)).toBe("3行1列 丸");
          expect(headlineRightAfter).not.toBeNull();
          expect(spotlitRightAfter).toEqual(comparedCells);
          expect(freePlayMessage).not.toBeNull();
          expect(getSpotlitCellPositions()).toEqual([]);
          expect(getScrim()).toBeNull();
          expect(queryShownText("この行は四角が多すぎます")).toBeNull();
          expect(animate).not.toHaveBeenCalled();
        });
      });
    });

    describe("最後の手順を終えた直後", () => {
      beforeEach(() => {
        finishSteps(stepPlacements.length);
      });

      test("終えた手順を残して見せる間はヒントを出さず、その間を終えると出すこと", () => {
        advanceTime(nextStepCueDelayMs - 1);
        const hintButtonWhileLingering = queryHintButton();
        advanceTime(1);

        const hintButton = queryHintButton();

        expect(hintButtonWhileLingering).toBeNull();
        expect(hintButton).not.toBeNull();
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(stepPlacements.length);
        advanceTime(nextStepCueDelayMs);
      });

      test("残りを埋めることを伝え、印も指も付けず、覆わないこと", () => {
        const freePlayMessage = queryMessage(freePlay);

        expect(freePlayMessage).not.toBeNull();
        expect(getHintedCellPositions()).toEqual([]);
        expect(getPointedCellPositions()).toEqual([]);
        expect(getSpotlitCellPositions()).toEqual([]);
        expect(getScrim()).toBeNull();
      });

      test("手が止まっても、印を付けず、覆わずに、ヒントを出しておくこと", () => {
        advanceTime(longIdleMs);

        const freePlayMessage = queryMessage(freePlay);
        const hintButton = queryHintButton();

        expect(freePlayMessage).not.toBeNull();
        expect(getHintedCellPositions()).toEqual([]);
        expect(getScrim()).toBeNull();
        expect(hintButton).not.toBeNull();
      });

      test("ヒントを押すと、並んだ2つの隣で決まるマスに指の無い印を付け、そのマスと決め手を覆いから抜き、そのルールの一言に替え、ヒントを下げること", () => {
        pressHint();

        const ruleMessage = queryMessage(
          describeTakuzuTutorialRule("run") ?? undefined,
        );
        const freePlayMessage = queryMessage(freePlay);
        const hintButton = queryHintButton();

        expect(hintButton).toBeNull();
        expect(getHintedCellPositions()).toEqual(["1行2列"]);
        expect(getPointedCellPositions()).toEqual([]);
        expect(getScrim()).not.toBeNull();
        expect(getSpotlitCellPositions()).toEqual([
          "1行2列",
          "2行2列",
          "3行2列",
        ]);
        expect(ruleMessage).not.toBeNull();
        expect(freePlayMessage).toBeNull();
      });

      test("ヒントで示した後に次の手を入れると、印と覆いを消して残りを埋める一言に戻し、またヒントを出すこと", () => {
        pressHint();
        tapCell(4, 2);

        const freePlayMessage = queryMessage(freePlay);
        const hintButton = queryHintButton();

        expect(freePlayMessage).not.toBeNull();
        expect(getHintedCellPositions()).toEqual([]);
        expect(getScrim()).toBeNull();
        expect(hintButton).not.toBeNull();
      });

      test("ルールに合わない手を置くと、違反がある間はヒントを出さないこと", () => {
        pressKeyOnCell(1, 1, "2");
        const hintButtonBeforeSettled = queryHintButton();
        advanceTime(violationReactionDelayMs);

        const hintButton = queryHintButton();

        expect(hintButtonBeforeSettled).toBeNull();
        expect(hintButton).toBeNull();
      });

      test("どのマスにも置け、正しく置いても応えないこと", () => {
        tapCell(4, 2);

        expect(getCellLabel(4, 2)).toBe("4行2列 四角");
        expect(getCuedCellPositions("fitted")).toEqual([]);
      });

      test("ルールに合わない手を置いて違反が続くと、置き直し方を添えた違反の一言を出し、置き直すマスに印を付け、違反のマスを残して盤面を覆うこと", () => {
        pressKeyOnCell(1, 1, "2");
        const spotlitBeforeSettled = getSpotlitCellPositions();
        advanceTime(violationReactionDelayMs);

        const message = queryShownText("この列は丸が多すぎます");
        const detail = queryShownText("あと2回タップすると四角に変わります");
        const freePlayMessage = queryMessage(freePlay);

        expect(getCellLabel(1, 1)).toBe("1行1列 丸 列の個数超過");
        expect(message).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(freePlayMessage).toBeNull();
        expect(spotlitBeforeSettled).toEqual([]);
        expect(getHintedCellPositions()).toEqual(["1行1列"]);
        expect(getScrim()).not.toBeNull();
        expect(getSpotlitCellPositions()).toEqual([
          "1行1列",
          "2行1列",
          "3行1列",
          "4行1列",
        ]);
      });
    });

    describe("解き終えた場合", () => {
      beforeEach(() => {
        solveAll();
      });

      test("完成を伝え、覚えたルールを並べ、進み具合を満たすこと", () => {
        const headline = queryMessage(completion.home);
        const detail = queryShownText(completion.home.detail ?? "");
        const recap = within(
          within(getScreen()).getByRole("list", { name: "覚えたルール" }),
        )
          .getAllByRole("listitem")
          .map((item) => item.textContent);

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(recap).toEqual(rules.map(({ label }) => label));
        expect(getProgressValue()).toBe("100");
      });

      test("ヒントを出さないこと", () => {
        const hintButton = queryHintButton();

        expect(hintButton).toBeNull();
      });

      test("本番と同じクリア音を鳴らすこと", () => {
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

      test("ゲームのホームで開いているレベルを遊ぶ操作で、本番を始めること", () => {
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "レベル 3を遊ぶ" }),
        );

        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("もう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", () => {
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "もう一度" }),
        );

        const headline = queryMessage(steps[0]?.message);
        const startButton = within(getScreen()).queryByRole("button", {
          name: "はじめる",
        });

        expect(headline).not.toBeNull();
        expect(startButton).toBeNull();
        expect(getCellLabel(1, 1)).toBe("1行1列 空き");
        expect(getHintedCellPositions()).toEqual(["4行1列"]);
        expect(getProgressValue()).toBe("0");
      });
    });
  });

  describe("始めの盤面へ替える動きを見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <TakuzuTutorial open={true} playStart={playStart} onClose={onClose} />,
      );
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
    });

    test("置いたタイルを消し終えてから、始めの盤面で最初の手順の印を出すこと", async () => {
      const labelWhileRewinding = getCellLabel(1, 1);
      const hintedWhileRewinding = getHintedCellPositions();
      const spotlitWhileRewinding = getSpotlitCellPositions();
      await advanceTimeInSlices(introEnoughMs);

      const label = getCellLabel(1, 1);

      expect(labelWhileRewinding).toBe("1行1列 四角");
      expect(hintedWhileRewinding).toEqual([]);
      expect(spotlitWhileRewinding).toEqual([]);
      expect(label).toBe("1行1列 空き");
      expect(getHintedCellPositions()).toEqual(["4行1列"]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      render(<TakuzuTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    test("はじめるを押すと、動きを待たずに始めの盤面で最初の手順から始めること", () => {
      const headline = queryMessage(steps[0]?.message);

      expect(headline).not.toBeNull();
      expect(getCellLabel(4, 1)).toBe("4行1列 空き");
      expect(getHintedCellPositions()).toEqual(["4行1列"]);
    });
  });

  describe("プレイ中に開いて解き終えた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} onClose={onClose} />);
      pressStart();
      solveAll();
    });

    test("プレイ中の盤面と同じルールだと伝え、プレイに戻る操作で閉じること", () => {
      const detail = queryShownText(completion.play.detail ?? "");
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
