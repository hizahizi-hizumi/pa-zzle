import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import {
  HITOFUDE_PUZZLE_TUTORIAL_RECAP,
  hitofudePuzzleTutorial,
} from "@/games/hitofude-puzzle/tutorial/tutorial";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { intro, steps, freePlay } = hitofudePuzzleTutorial;

const BOARD_SIZE = 5;

/**
 * 盤面のマス番号（5×5、`#` は穴、S は始点）
 * ```text
 *  S  1  2  3  4
 *  #  #  7  8  #
 * 10 11 12 13 14
 * 15 16 17 18 19
 *  # 21 22 23 24
 * ```
 */
const stepRoutes = steps.map((step) => step.route);

/** 手順を終えた後、自分で延ばして完成させるマス。 */
const remainingCells = [18, 23, 24, 19, 14, 13, 8, 3, 4] as const;

/** 手順の最後のマスまで延ばしてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 700;

/** ルールに合わない道に、違反の一言と直す所の印で応えるまでの間。 */
const violationMessageDelayMs = 500;

/** 入口の場面の動き（ゴールの道を始点まで巻き戻す動き）と完成の演出を見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: HITOFUDE_PUZZLE_DISPLAY_NAME });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(text.replaceAll("\n", " "));
}

function queryStartButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "はじめる" });
}

/** 入口の「はじめる」を押し、ゴールの道を始点まで巻き戻す場面を終える。 */
function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(introEnoughMs);
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function getBoard(): HTMLElement {
  return within(getScreen()).getByRole("group", {
    name: `${HITOFUDE_PUZZLE_DISPLAY_NAME}盤面 ${BOARD_SIZE}行${BOARD_SIZE}列`,
  });
}

function getCellName(cell: number): string {
  return `${Math.floor(cell / BOARD_SIZE) + 1}行${(cell % BOARD_SIZE) + 1}列`;
}

function getCell(cell: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${getCellName(cell)} `),
  });
}

function pressCells(cells: readonly number[]): void {
  for (const cell of cells) {
    fireEvent.click(getCell(cell));
  }
}

function getCellNumber(button: HTMLElement): number {
  const [, row, column] =
    /^(\d+)行(\d+)列/.exec(button.getAttribute("aria-label") ?? "") ?? [];
  return (Number(row) - 1) * BOARD_SIZE + (Number(column) - 1);
}

/** 道が通ったマス。始点と先端を含む。 */
function getVisitedCells(): number[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter(
      (button) =>
        !/ (未通過|穴)$/.test(button.getAttribute("aria-label") ?? ""),
    )
    .map(getCellNumber);
}

function getCuedCells(
  kind: "mark" | "pointer" | "extended" | "recall",
): number[] {
  const selector = {
    mark: '[data-cell-cue="mark"]',
    pointer: '[data-tutorial-cue="pointer"]',
    extended: '[data-cell-cue="extended"]',
    recall: '[data-tutorial-cue="recall"]',
  }[kind];
  return within(getBoard())
    .getAllByRole("button")
    .filter((button) => button.querySelector(selector))
    .map(getCellNumber);
}

/** 盤面の覆いから抜くマス。盤面を覆っていなければ `null`。 */
function getSpotlitCells(): number[] | null {
  if (!getBoard().hasAttribute(TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE)) {
    return null;
  }
  return within(getBoard())
    .getAllByRole("button")
    .filter((button) => button.querySelector("[data-tutorial-spotlight]"))
    .map(getCellNumber);
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

/** 手順を `count` 個、道筋のマスを順に押して終える。手順のたびに次の印が出るまで待つ。 */
function playSteps(count: number): void {
  for (const route of stepRoutes.slice(0, count)) {
    pressCells(route);
    advanceTime(nextStepCueDelayMs);
  }
}

function getHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

describe("HitofudePuzzleTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
  });

  describe("開いた場合", () => {
    let rerenderTutorial: (open: boolean) => void;

    beforeEach(() => {
      const { rerender } = render(
        <HitofudePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      rerenderTutorial = (open) =>
        rerender(
          <HitofudePuzzleTutorial
            open={open}
            playStart={playStart}
            onClose={onClose}
          />,
        );
    });

    test("入口で、名前と、何をするパズルかとゴールの一言を、全マスを通ったゴールの道と一緒に見せること", () => {
      const title = within(getScreen()).getByRole("heading", {
        name: HITOFUDE_PUZZLE_DISPLAY_NAME,
      });
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const visitedCount = getVisitedCells().length;

      expect(title).toBeTruthy();
      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(visitedCount).toBe(21);
      expect(getCuedCells("mark")).toEqual([]);
      expect(getProgressValue()).toBe("0");
    });

    test("はじめるを押すと、ゴールの道を始点まで巻き戻してから、最初の手順の一言と印を出すこと", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
      const markedWhileRewinding = getCuedCells("mark");
      advanceTime(introEnoughMs);

      const headline = queryShownText(steps[0]!.message.headline);
      const visited = getVisitedCells();
      const marked = getCuedCells("mark");

      expect(markedWhileRewinding).toEqual([]);
      expect(headline).not.toBeNull();
      expect(visited).toEqual([0]);
      expect(marked).toEqual([1]);
    });

    test("閉じてから開き直すと、入口から始まること", () => {
      pressStart();
      playSteps(2);
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "閉じる" }),
      );
      rerenderTutorial(false);
      rerenderTutorial(true);

      const purpose = queryShownText(intro.purpose);
      const startButton = queryStartButton();

      expect(onClose).toHaveBeenCalledOnce();
      expect(purpose).not.toBeNull();
      expect(startButton).not.toBeNull();
      expect(getProgressValue()).toBe("0");
    });
  });

  describe("ゲームのホームから開いて始めた場合", () => {
    beforeEach(() => {
      render(
        <HitofudePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("操作を教える手順では、印のマスを指で指し、盤面を覆わないこと", () => {
      const pointed = getCuedCells("pointer");
      const spotlit = getSpotlitCells();

      expect(pointed).toEqual([1]);
      expect(spotlit).toBeNull();
      expect(getHintButton()).toBeNull();
    });

    test("印の無いマスを押すと、道を延ばさず音も鳴らさずに、印のマスの線を濃くし直すこと", () => {
      pressCells([5]);

      const visited = getVisitedCells();
      const recalled = getCuedCells("recall");

      expect(visited).toEqual([0]);
      expect(recalled).toEqual([1]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("先端を押しても、印のマスの線を濃くし直さないこと", () => {
      pressCells([0]);

      const recalled = getCuedCells("recall");

      expect(recalled).toEqual([]);
    });

    test("印のマスまで延ばすと、本番と同じ音を鳴らし、延ばしたマスに応えて一言を残してから次の一言と印に替え、進み具合を延ばしたマスの分だけ進めること", () => {
      pressCells([1]);
      const sounds = getPlayedSoundNames();
      const acknowledged = getCuedCells("extended");
      const markedBeforeDelay = getCuedCells("mark");
      const headlineBeforeDelay = queryShownText(steps[0]!.message.headline);
      advanceTime(nextStepCueDelayMs);

      const marked = getCuedCells("mark");
      const headline = queryShownText(steps[1]!.message.headline);

      expect(sounds).toEqual(["path-extended.flac"]);
      expect(acknowledged).toEqual([1]);
      expect(markedBeforeDelay).toEqual([]);
      expect(headlineBeforeDelay).not.toBeNull();
      expect(headline).not.toBeNull();
      expect(marked).toEqual([11]);
      // 始点の後に通る20マスのうち1マス。
      expect(getProgressValue()).toBe("5");
    });

    describe("穴を伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(1);
      });

      test("穴を通れるマスと紛れさせないよう、盤面を覆わないこと", () => {
        const spotlit = getSpotlitCells();

        expect(spotlit).toBeNull();
      });

      test("穴へ進もうとすると、本番と同じく阻まれた音を鳴らし、道を延ばさず、穴だと言うこと", () => {
        fireEvent.keyDown(getBoard(), { key: "ArrowDown" });
        advanceTime(violationMessageDelayMs);

        const visited = getVisitedCells();
        const lastSound = getPlayedSoundNames().at(-1);
        const headline = queryShownText("そこは通れません");

        expect(visited).toEqual([0, 1]);
        expect(lastSound).toBe("blocked.flac");
        expect(headline).not.toBeNull();
      });

      test("穴をよけて印のマスまで回り込むと、次の手順へ進むこと", () => {
        pressCells([2, 7, 12, 11]);
        advanceTime(nextStepCueDelayMs);

        const headline = queryShownText(steps[2]!.message.headline);

        expect(headline).not.toBeNull();
      });
    });

    describe("すべてのマスを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(2);
      });

      test("印のマスとそこまでの道筋と、通らずに残してはいけない左の2マスを、盤面の覆いから抜くこと", () => {
        const spotlit = getSpotlitCells();

        expect(spotlit).toEqual([10, 11, 15, 16, 21]);
      });

      test("印へまっすぐ進むと、本番と同じく道を延ばし、少し置いてから入れなくなったマスと戻り先の印を示すこと", () => {
        pressCells([16, 21]);
        const visited = getVisitedCells();
        advanceTime(violationMessageDelayMs);

        const headline = queryShownText("入れなくなったマスがあります");
        const marked = getCuedCells("mark");
        const spotlit = getSpotlitCells();

        expect(visited).toContain(21);
        expect(headline).not.toBeNull();
        expect(marked).toEqual([11]);
        expect(spotlit).toEqual(expect.arrayContaining([10, 11, 15]));
      });

      test("戻り先の印まで戻すと、手順の一言と印に戻ること", () => {
        pressCells([16, 21]);
        advanceTime(violationMessageDelayMs);
        pressCells([11]);

        const headline = queryShownText(steps[2]!.message.headline);
        const marked = getCuedCells("mark");

        expect(headline).not.toBeNull();
        expect(marked).toEqual([21]);
      });
    });

    describe("通れる隣が少ないマスを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(3);
      });

      test("2つの行き先に指を出さずに印を付け、そこまでの道筋と、通れる隣の残りのマスと道の終わりのマスを決め手として覆いから抜くこと", () => {
        const marked = getCuedCells("mark");
        const pointed = getCuedCells("pointer");
        const spotlit = getSpotlitCells();

        expect(marked).toEqual([17, 23]);
        expect(pointed).toEqual([]);
        expect(spotlit).toEqual([4, 17, 18, 21, 22, 23]);
      });

      test("通れる隣が1つのマスを増やす向きへ進むと、そのことと戻り先の印を示すこと", () => {
        pressCells([22, 23]);
        advanceTime(violationMessageDelayMs);

        const headline = queryShownText("ゴールになるマスが2つできました");
        const marked = getCuedCells("mark");

        expect(headline).not.toBeNull();
        expect(marked).toEqual([22]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        playSteps(steps.length);
      });

      test("覆いを外し、残りを通すことを伝え、ヒントを押すまで印を付けないこと", () => {
        const spotlit = getSpotlitCells();
        const marked = getCuedCells("mark");
        const headline = queryShownText(freePlay.headline);

        expect(spotlit).toBeNull();
        expect(marked).toEqual([]);
        expect(headline).not.toBeNull();
        expect(getHintButton()).not.toBeNull();
      });

      test("一本道でヒントを押すと、一言は替えずに、手を引く間と同じく次に延ばすマスを印と指で示すこと", () => {
        fireEvent.click(getHintButton()!);

        const marked = getCuedCells("mark");
        const headline = queryShownText(freePlay.headline);

        expect(marked).toEqual([18]);
        expect(getCuedCells("pointer")).toEqual([18]);
        expect(headline).not.toBeNull();
      });

      test("分かれ道でヒントを押すと、次に延ばすマスと道の終わりのマスを覆いから抜き、通れる隣が少ないマスの読みを伝えること", () => {
        pressCells([18]);
        fireEvent.click(getHintButton()!);

        const marked = getCuedCells("mark");
        const spotlit = getSpotlitCells();
        const headline = queryShownText(steps[3]!.message.headline);

        expect(marked).toEqual([23]);
        expect(spotlit).toEqual([4, 18, 23]);
        expect(headline).not.toBeNull();
      });

      test("ヒントの印は、次の手で消えること", () => {
        fireEvent.click(getHintButton()!);
        pressCells([18]);

        const marked = getCuedCells("mark");

        expect(marked).toEqual([]);
      });

      test("通れる隣が1つのマスを増やす向きへ進むと、本番と同じく道を延ばし、少し置いてからわけと戻り先の印を示し、進み具合を外れる前の所に留めること", () => {
        pressCells([18]);
        const progressBefore = getProgressValue();
        pressCells([13]);
        advanceTime(violationMessageDelayMs);

        const visited = getVisitedCells();
        const headline = queryShownText("ゴールになるマスが2つできました");
        const marked = getCuedCells("mark");

        expect(visited).toContain(13);
        expect(headline).not.toBeNull();
        expect(marked).toEqual([18]);
        expect(getProgressValue()).toBe(progressBefore);
        expect(getHintButton()).toBeNull();
      });

      test("手順の道を戻して引き直しても、手順を終えたときの応えを出さないこと", () => {
        pressCells([22, 17]);

        const acknowledged = getCuedCells("extended");

        expect(acknowledged).toEqual([]);
      });
    });

    describe("解き終えた場合", () => {
      beforeEach(() => {
        playSteps(steps.length);
        pressCells(remainingCells);
      });

      test("本番と同じ完成の音を鳴らし、完成を伝え、覚えたルールと読みを並べ、進み具合を満たすこと", () => {
        const clearSounds = vi.mocked(playLayeredSound).mock.calls.length;
        advanceTime(introEnoughMs);

        const detail = queryShownText(
          hitofudePuzzleTutorial.completion.home.detail ?? "",
        );
        const recap = within(
          within(getScreen()).getByRole("list", { name: "覚えたルール" }),
        )
          .getAllByRole("listitem")
          .map((item) => item.textContent);

        expect(clearSounds).toBe(1);
        expect(detail).not.toBeNull();
        expect(recap).toEqual(HITOFUDE_PUZZLE_TUTORIAL_RECAP);
        expect(getProgressValue()).toBe("100");
      });

      test("ゲームのホームで開いているレベルを遊ぶ操作で、そのレベルを始めること", () => {
        advanceTime(introEnoughMs);
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "レベル 1を遊ぶ" }),
        );

        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("もう一度を押すと、入口を通さずに、始点だけの道で最初の手順から始めること", () => {
        advanceTime(introEnoughMs);
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "もう一度" }),
        );

        const startButton = queryStartButton();
        const visited = getVisitedCells();
        const marked = getCuedCells("mark");

        expect(startButton).toBeNull();
        expect(visited).toEqual([0]);
        expect(marked).toEqual([1]);
        expect(getProgressValue()).toBe("0");
      });
    });

    test("矢印キーでも、印のマスへ先端を動かせること", () => {
      fireEvent.keyDown(getBoard(), { key: "ArrowRight" });

      const visited = getVisitedCells();

      expect(visited).toEqual([0, 1]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<HitofudePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、ゴールの道をゴールの一言と一緒に見せること", () => {
      const caption = queryShownText(intro.goalCaption);
      const visitedCount = getVisitedCells().length;

      expect(caption).not.toBeNull();
      expect(visitedCount).toBe(21);
    });

    test("はじめるを押すと、動きを待たずに始点だけの道で最初の手順の一言と印を出すこと", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
      advanceTime(0);

      const headline = queryShownText(steps[0]!.message.headline);
      const visited = getVisitedCells();
      const marked = getCuedCells("mark");

      expect(headline).not.toBeNull();
      expect(visited).toEqual([0]);
      expect(marked).toEqual([1]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<HitofudePuzzleTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    test("通し終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      playSteps(steps.length);
      pressCells(remainingCells);
      advanceTime(introEnoughMs);
      const detail = queryShownText(
        hitofudePuzzleTutorial.completion.play.detail ?? "",
      );
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
