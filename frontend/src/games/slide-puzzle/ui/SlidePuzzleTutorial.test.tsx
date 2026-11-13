import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { slidePuzzleTutorial } from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { intro, steps, freePlay, completion, rules } = slidePuzzleTutorial;

const operationTiles = [4] as const;

/** 行・列のルールを示す手順で、空白を動かしてから入れるタイル。 */
const lineTiles = [7, 2] as const;

/** 2を3の場所へずらし、3をその下に並べるタイル。 */
const arrangeTiles = [2, 7, 5, 3] as const;

/** 空白を2の左へ回し、2と3を続けて入れるタイル。7 をタップすると 5 と 7 がまとめて下りる。 */
const insertTiles = [6, 7, 2, 3] as const;

/** 手を離した後、4と7を組にして入れ、残りを回して完成させるタイル。 */
const solvingTiles = [7, 5, 8, 4, 5, 7, 6, 8, 7, 5, 4, 7, 8] as const;

const nextCueDelayMs = 450;

const searchIdleCueDelayMs = 4000;

/** 手を離した後に止まっていても、手がかりを勝手に出さないことを確かめる長さ。 */
const longIdleMs = 60_000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
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
  return screen.getByRole("dialog", { name: "スライドパズル" });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(text.replaceAll("\n", " "));
}

function getBoard(): HTMLElement {
  return within(getScreen()).getByRole("group", { name: "盤面" });
}

function getTile(tile: number): HTMLElement {
  return within(getBoard()).getByRole("button", { name: String(tile) });
}

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

/** タイルを順にタップし、タップごとにスライドが収まって次の印が出るまで待つ。 */
function playTiles(tiles: readonly number[]): void {
  for (const tile of tiles) {
    fireEvent.click(getTile(tile));
    advanceTime(nextCueDelayMs);
  }
}

function playGuidedSteps(): void {
  playTiles([...operationTiles, ...lineTiles, ...arrangeTiles, ...insertTiles]);
}

function getTilePosition(tile: number): string {
  const match = /translate\((\d+)%, (\d+)%\)/.exec(
    getTile(tile).style.transform,
  );
  return match
    ? `${Number(match[2]) / 100 + 1}行${Number(match[1]) / 100 + 1}列`
    : "";
}

const pointerSelector = '[data-tile-cue="hint"] [data-tutorial-cue="pointer"]';
const markSelector = '[data-tile-cue="hint"]';
const recallSelector = '[data-tutorial-cue="recall"]';
const landedSelector = '[data-tile-cue="landed"]';

function getCuedTiles(selector: string = pointerSelector): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector(selector))
    .map((tile) => tile.textContent ?? "");
}

function getSpotlitTiles(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector("[data-tutorial-spotlight]"))
    .map((tile) => tile.textContent ?? "")
    .sort();
}

function isBoardSpotlightArea(): boolean {
  return getBoard().hasAttribute("data-tutorial-spotlight-area");
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

describe("SlidePuzzleTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
  });

  describe("開いた場合", () => {
    beforeEach(() => {
      render(
        <SlidePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("入口で、名前と、何をするパズルかとゴールの一言を、ゴールの盤面と一緒に見せること", () => {
      const title = within(getScreen()).getByRole("heading", {
        name: "スライドパズル",
      });
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const positions = [getTilePosition(1), getTilePosition(8)];

      expect(title).toBeTruthy();
      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(positions).toEqual(["1行1列", "3行2列"]);
      expect(getProgressValue()).toBe("0");
      expect(queryHintButton()).toBeNull();
    });

    test("はじめるを押すと、始めの盤面に替え、すぐ最初の手順の一言と指さしを出し、盤面を覆わないこと", () => {
      pressStart();

      const headline = queryShownText(steps[0]?.message.headline ?? "");
      const positions = [getTilePosition(4), getTilePosition(2)];

      expect(headline).not.toBeNull();
      expect(positions).toEqual(["2行2列", "1行3列"]);
      expect(getCuedTiles()).toEqual(["4"]);
      expect(isBoardSpotlightArea()).toBe(false);
    });
  });

  describe("ゲームのホームから開いて始めた場合", () => {
    beforeEach(() => {
      render(
        <SlidePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("手順に無いタイルを押すたびに、スライドさせず鳴らさずに、一言を変えずに印の線を濃くし直すこと", () => {
      fireEvent.click(getTile(8));
      const firstRecall = getTile(4).querySelector(recallSelector);
      fireEvent.click(getTile(1));

      const secondRecall = getTile(4).querySelector(recallSelector);
      const headline = queryShownText(steps[0]?.message.headline ?? "");

      expect(getTilePosition(8)).toBe("3行1列");
      expect(firstRecall).not.toBeNull();
      expect(secondRecall).not.toBe(firstRecall);
      expect(headline).not.toBeNull();
      expect(playSound).not.toHaveBeenCalled();
    });

    test("印のタイルをタップすると、本番と同じ音でスライドして収まった合図を返し、収まってから次の手順の一言と印を出すこと", () => {
      fireEvent.click(getTile(4));
      const landed = getCuedTiles(landedSelector);
      const heldHeadline = queryShownText(steps[0]?.message.headline ?? "");
      advanceTime(nextCueDelayMs);

      const headline = queryShownText(steps[1]?.message.headline ?? "");

      expect(getTilePosition(4)).toBe("2行1列");
      expect(getPlayedSoundNames()).toEqual(["slid.flac"]);
      expect(landed).toEqual(["4"]);
      expect(heldHeadline).not.toBeNull();
      expect(headline).not.toBeNull();
      expect(getCuedTiles(markSelector)).toEqual(["2"]);
      expect(getCuedTiles()).toEqual([]);
      expect(Number(getProgressValue())).toBeGreaterThan(0);
    });

    describe("行・列のルールを示す手順の場合", () => {
      beforeEach(() => {
        playTiles(operationTiles);
      });

      test("印のタイルと決め手の2を、盤面の中だけの覆いから抜くこと", () => {
        const spotlit = getSpotlitTiles();

        expect(isBoardSpotlightArea()).toBe(true);
        expect(spotlit).toEqual(["2"]);
      });

      test("空白と同じ行・列にない印のタイルを押すと、本番と同じく揺らして鳴らし、わけと直し方を伝え、空白を動かすタイルに印を移すこと", () => {
        fireEvent.click(getTile(2));

        const headline = queryShownText(
          "2は空白と同じ行にも\n列にもありません",
        );
        const detail = queryShownText("空白を2と同じ行か列へ動かします");

        expect(getPlayedSoundNames().at(-1)).toBe("invalid.flac");
        expect(getTilePosition(2)).toBe("1行3列");
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(getCuedTiles()).toEqual(["7"]);
        expect(getSpotlitTiles()).toEqual(["2", "7"]);
      });

      test("空白を動かしてから2をタップすると、自分の場所へ入れて、組にして入れる読みの手順へ進むこと", () => {
        playTiles(lineTiles);

        const headline = queryShownText(steps[2]?.message.headline ?? "");
        const detail = queryShownText(steps[2]?.message.detail ?? "");

        expect(getTilePosition(2)).toBe("1行2列");
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
      });
    });

    describe("組にして入れる読みの手順の場合", () => {
      beforeEach(() => {
        playTiles([...operationTiles, ...lineTiles]);
      });

      test("印を付けずに、決め手の2と3と、いまスライドできるタイルを覆いから抜いて、自分で探させること", () => {
        const spotlit = getSpotlitTiles();

        expect(getCuedTiles(markSelector)).toEqual([]);
        expect(spotlit).toEqual(["1", "2", "3", "5"]);
      });

      test("手順を終えた直後に押した手も、次の手順の手として受けること", () => {
        playTiles(arrangeTiles.slice(0, 3));
        fireEvent.click(getTile(3));
        fireEvent.click(getTile(6));

        const position = getTilePosition(6);

        expect(position).toBe("3行3列");
      });

      test("手が止まると、次に押すタイルを指さすこと", () => {
        advanceTime(searchIdleCueDelayMs);

        const cued = getCuedTiles();

        expect(cued).toEqual(["2"]);
      });

      test("手順に無いタイルを押すと、スライドさせずに、次に押すタイルを指さすこと", () => {
        fireEvent.click(getTile(5));

        const cued = getCuedTiles();

        expect(getTilePosition(5)).toBe("2行3列");
        expect(cued).toEqual(["2"]);
      });

      test("組に並べた後は、空白を回すタイルを指さし、離れた7を指して5と7をまとめてスライドさせること", () => {
        playTiles(arrangeTiles);
        const first = getCuedTiles();
        playTiles([6]);
        const second = getCuedTiles();
        playTiles([7]);

        const positions = [getTilePosition(5), getTilePosition(7)];

        expect(first).toEqual(["6"]);
        expect(second).toEqual(["7"]);
        expect(positions).toEqual(["3行2列", "2行2列"]);
      });

      test("2と3を組に並べると、空白を回して続けて入れる一言に替えること", () => {
        playTiles(arrangeTiles);

        const headline = queryShownText(steps[3]?.message.headline ?? "");

        expect(headline).not.toBeNull();
        expect(getTilePosition(2)).toBe("1行3列");
        expect(getTilePosition(3)).toBe("2行3列");
      });
    });

    describe("手を引く手順をすべて終えた場合", () => {
      beforeEach(() => {
        playGuidedSteps();
      });

      test("残りを並べる一言を出し、覆わず、手が止まっても手がかりを勝手に出さずに、ヒントを出すこと", () => {
        advanceTime(longIdleMs);

        const headline = queryShownText(freePlay.headline);

        expect(headline).not.toBeNull();
        expect(isBoardSpotlightArea()).toBe(false);
        expect(getCuedTiles()).toEqual([]);
        expect(queryHintButton()).not.toBeNull();
      });

      test("ヒントを押すと、次にスライドさせるタイルを指さし、次の手で消すこと", () => {
        fireEvent.click(queryHintButton() as HTMLElement);
        const hinted = getCuedTiles();
        playTiles([7]);

        const afterMove = getCuedTiles();

        expect(hinted).toEqual(["7"]);
        expect(afterMove).toEqual([]);
      });

      test("収まっても、本番に無い合図は返さないこと", () => {
        playTiles([7, 5, 8, 4, 5, 7, 6, 8, 7, 5, 4]);

        const landed = getCuedTiles(landedSelector);

        expect(landed).toEqual([]);
      });

      test("空白と同じ行・列にないタイルを押すと、本番と同じく鳴らし、スライドさせずにわけを伝えること", () => {
        fireEvent.click(getTile(8));

        const headline = queryShownText(
          "8は空白と同じ行にも\n列にもありません",
        );

        expect(getPlayedSoundNames().at(-1)).toBe("invalid.flac");
        expect(getTilePosition(8)).toBe("3行1列");
        expect(headline).not.toBeNull();
        expect(getCuedTiles()).toEqual([]);
      });

      test("並べ終えると、本番と同じ完成の音を鳴らし、完成の一言と覚えたことを見せて、そのレベルを始める操作で始めること", () => {
        playTiles(solvingTiles);
        advanceTime(longIdleMs);
        const headline = queryShownText(completion.home.detail ?? "");
        const recap = rules.map((rule) => queryShownText(rule.label));
        const progress = getProgressValue();
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "レベル 2を遊ぶ" }),
        );

        expect(playLayeredSound).toHaveBeenCalledOnce();
        expect(headline).not.toBeNull();
        expect(recap.every((item) => item !== null)).toBe(true);
        expect(progress).toBe("100");
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("並べ終えた後のもう一度で、入口を通さずに始めの盤面の最初の手順から始めること", () => {
        playTiles(solvingTiles);
        advanceTime(longIdleMs);
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "もう一度" }),
        );

        const headline = queryShownText(steps[0]?.message.headline ?? "");

        expect(headline).not.toBeNull();
        expect(getTilePosition(4)).toBe("2行2列");
        expect(getCuedTiles()).toEqual(["4"]);
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    test("はじめるを押すと、すぐ最初の手順の一言と印を出し、印の無いタイルを押すと印の線を濃くし直すこと", () => {
      fireEvent.click(getTile(8));

      const headline = queryShownText(steps[0]?.message.headline ?? "");
      const recalled = getCuedTiles(recallSelector);

      expect(headline).not.toBeNull();
      expect(recalled).toEqual(["4"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      pressStart();
      playGuidedSteps();
      playTiles(solvingTiles);
      advanceTime(longIdleMs);
    });

    test("並べ終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      const detail = queryShownText(completion.play.detail ?? "");
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
