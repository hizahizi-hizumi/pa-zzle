import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const stepTiles = [5, 8, 4] as const;

/** 手順を終えた後、行と列をまとめてスライドさせて完成させるタイル。 */
const remainingTiles = [2, 6] as const;

const nextStepCueDelayMs = 450;

const idleHintDelayMs = 4000;

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

function installAnimate(): void {
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          cancel: vi.fn(),
          finished: Promise.resolve(),
        }) as unknown as Animation,
    ),
  });
}

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

/** 導入は自動では先へ進まない。 */
function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

/** 場面の動きを待っては「次へ」を押し、導入を最後まで進める。 */
function goThroughIntroSync(): void {
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

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤面" });
}

function getTile(tile: number): HTMLElement {
  return within(getBoard()).getByRole("button", { name: String(tile) });
}

function tapTiles(tiles: readonly number[]): void {
  for (const tile of tiles) {
    fireEvent.click(getTile(tile));
  }
}

/** 手順のタイルを、収まったタイルを見せてから次の印が付くまで待ちながらタップする。最後のタップの後は待たない。 */
function playSteps(tiles: readonly number[]): void {
  tiles.forEach((tile, index) => {
    if (index > 0) {
      advanceTime(nextStepCueDelayMs);
    }
    tapTiles([tile]);
  });
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

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

function getTilePosition(tile: number): string {
  const match = /translate\((\d+)%, (\d+)%\)/.exec(
    getTile(tile).style.transform,
  );
  return match
    ? `${Number(match[2]) / 100 + 1}行${Number(match[1]) / 100 + 1}列`
    : "";
}

const recallSelector = '[data-tutorial-cue="recall"]';

function getCuedTiles(kind: "hint" | "landed" | "recall"): string[] {
  const selector =
    kind === "recall" ? recallSelector : `[data-tile-cue="${kind}"]`;
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector(selector))
    .map((tile) => tile.textContent ?? "");
}

function getSpotlitTiles(): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector("[data-tutorial-spotlight]"))
    .map((tile) => tile.textContent ?? "");
}

/** 画面全体の覆いから抜いている所の数。タイルのほか、タイルが収まる空白と一言の面を含む。 */
function getSpotlightCount(): number {
  return document.querySelectorAll("[data-tutorial-spotlight]").length;
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("SlidePuzzleTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <SlidePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
    });

    test("崩れた始めの盤面で、空白の隣のタイルのタップを示し、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.getByText(
        "空白の隣のタイルは タップするとスライドします",
      );
      const positions = [getTilePosition(4), getTilePosition(5)];
      const hinted = getCuedTiles("hint");
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(positions).toEqual(["1行1列", "3行2列"]);
      expect(hinted).toEqual(["5"]);
      expect(rules).toEqual(["空白にスライド", "まだ出ていないルール"]);
    });

    test("画面全体に覆いを重ね、印のタイルと、タイルが収まる空白と、一言の面だけを覆いから抜くこと", () => {
      const scrim = getScrim();
      const spotlit = getSpotlitTiles();
      const spotlightCount = getSpotlightCount();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual(["5"]);
      expect(spotlightCount).toBe(3);
    });

    test("空白の隣でも印の無いタイルを押すと、スライドさせず音も鳴らさずに、一言を変えずに印のタイルの線を濃くし直すこと", () => {
      tapTiles([7]);

      const position = getTilePosition(7);
      const headline = screen.getByText(
        "空白の隣のタイルは タップするとスライドします",
      );
      const hinted = getCuedTiles("hint");
      const recalled = getCuedTiles("recall");

      expect(position).toBe("2行1列");
      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["5"]);
      expect(recalled).toEqual(["5"]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("印の無いタイルを続けて押すたびに、印のタイルの線を濃くし直すこと", () => {
      tapTiles([7]);
      const firstFlash = getTile(5).querySelector(recallSelector);
      tapTiles([3]);

      const secondFlash = getTile(5).querySelector(recallSelector);

      expect(firstFlash).not.toBeNull();
      expect(secondFlash).not.toBeNull();
      expect(secondFlash).not.toBe(firstFlash);
    });

    test("覆いから抜いた空白を押すと、何も動かさずに印のタイルの線を濃くし直すこと", () => {
      const blank = Array.from(
        getBoard().querySelectorAll("[data-tutorial-spotlight]"),
      ).find((spotlight) => !spotlight.closest("button"));
      fireEvent.click(blank ?? getBoard());

      const recalled = getCuedTiles("recall");

      expect(blank).toBeDefined();
      expect(recalled).toEqual(["5"]);
    });

    test("印のタイルをタップすると、空白にスライドして収まり、収まってから次の印と一言を出すこと", () => {
      tapTiles([5]);
      const position = getTilePosition(5);
      const landed = getCuedTiles("landed");
      const headlineBeforeDelay = screen.queryByText(
        "この空白には 8 が収まります",
      );
      const hintedBeforeDelay = getCuedTiles("hint");
      advanceTime(nextStepCueDelayMs);

      const headline = screen.queryByText("この空白には 8 が収まります");
      const hinted = getCuedTiles("hint");

      expect(position).toBe("2行2列");
      expect(landed).toEqual(["5"]);
      expect(headlineBeforeDelay).toBeNull();
      expect(hintedBeforeDelay).toEqual([]);
      expect(headline).not.toBeNull();
      expect(hinted).toEqual(["8"]);
    });

    test("収まったタイルを見せている間に次のタイルをタップしても、スライドさせずに、次の手順の一言と印を出すこと", () => {
      tapTiles([5]);
      const positionBefore = getTilePosition(8);
      tapTiles([8]);

      const position = getTilePosition(8);
      const headline = screen.queryByText("この空白には 8 が収まります");
      const hinted = getCuedTiles("hint");

      expect(position).toBe(positionBefore);
      expect(headline).not.toBeNull();
      expect(hinted).toEqual(["8"]);
    });

    test("印のタイルをタップすると、本番と同じスライドの音を鳴らすこと", () => {
      tapTiles([5]);

      const sounds = getPlayedSoundNames();

      expect(sounds).toEqual(["slid.flac"]);
    });

    describe("同じ行・列のルールを示す手順に進んだ場合", () => {
      beforeEach(() => {
        playSteps(stepTiles.slice(0, 2));
        advanceTime(nextStepCueDelayMs);
        advanceTime(nextStepCueDelayMs);
      });

      test("離れたタイルもスライドすることと、印のタイルをタップすると何が起きるかを伝えること", () => {
        const headline = screen.getByText(
          "空白と同じ行や列なら 離れたタイルもスライドします",
        );
        const detail = screen.getByText("4 をタップすると 7 もスライドします");

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
      });

      test("隣にある 7 をタップしても、スライドさせずに、手順の一言のまま印のタイルの線を濃くし直すこと", () => {
        tapTiles([7]);

        const position = getTilePosition(7);
        const detail = screen.getByText("4 をタップすると 7 もスライドします");
        const recalled = getCuedTiles("recall");

        expect(position).toBe("2行1列");
        expect(detail).toBeTruthy();
        expect(recalled).toEqual(["4"]);
      });

      describe("タイルを揺らせる環境の場合", () => {
        beforeEach(() => {
          installAnimate();
        });

        test("空白と同じ行・列にないタイルをタップすると、本番と同じく揺らして音を鳴らし、スライドさせずにわけを伝え、揺らしたタイルを覆いから抜くこと", () => {
          tapTiles([5]);

          const position = getTilePosition(5);
          const headline = screen.getByText(
            "5 は空白と同じ行にも列にもありません",
          );
          const shakeCount = vi.mocked(HTMLElement.prototype.animate).mock.calls
            .length;
          const sounds = getPlayedSoundNames();
          const recalled = getCuedTiles("recall");
          const spotlit = getSpotlitTiles();

          expect(position).toBe("2行2列");
          expect(headline).toBeTruthy();
          expect(shakeCount).toBe(1);
          expect(sounds).toEqual(["slid.flac", "slid.flac", "invalid.flac"]);
          expect(recalled).toEqual([]);
          expect(spotlit).toEqual(["4", "5", "7"]);
        });
      });

      test("わけを伝えた後に印の無い 7 をタップすると、印のタイルの線を濃くし直して、手順の一言に戻すこと", () => {
        tapTiles([5, 7]);

        const detail = screen.getByText("4 をタップすると 7 もスライドします");
        const recalled = getCuedTiles("recall");

        expect(detail).toBeTruthy();
        expect(recalled).toEqual(["4"]);
      });

      test("印のタイルと、一緒にスライドするタイルを覆いから抜くこと", () => {
        const spotlit = getSpotlitTiles();

        expect(spotlit).toEqual(["4", "7"]);
      });

      test("ルールをルールの並びに加え、離れたタイルをタップすると間のタイルもまとめてスライドさせること", () => {
        const rules = getRuleTexts();
        tapTiles([4]);

        const positions = [getTilePosition(4), getTilePosition(7)];
        const landed = getCuedTiles("landed");

        expect(rules).toEqual(["空白にスライド", "まとめてスライド"]);
        expect(positions).toEqual(["2行1列", "3行1列"]);
        expect(landed).toEqual(["4", "7"]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        playSteps(stepTiles);
      });

      test("タイルが自分の場所に収まっても、本番に無い合図は返さないこと", () => {
        tapTiles([2]);

        const landed = getCuedTiles("landed");

        expect(landed).toEqual([]);
      });

      test("覆いを重ねず、手が止まって印が出ても覆いを重ねないこと", () => {
        const scrim = getScrim();
        advanceTime(idleHintDelayMs);

        const scrimWithHint = getScrim();
        const spotlit = getSpotlitTiles();

        expect(scrim).toBeNull();
        expect(scrimWithHint).toBeNull();
        expect(spotlit).toEqual([]);
      });

      test("残りを並べることを伝え、手が止まったときだけ次にスライドさせるタイルを示すこと", () => {
        const headline = screen.getByText("残りを収めると完成です");
        const hintedBeforeIdle = getCuedTiles("hint");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedTiles("hint");

        expect(headline).toBeTruthy();
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toEqual(["1"]);
      });

      test("空白と同じ行・列にないタイルをタップすると、スライドさせずにわけを伝え、次にスライドさせると一言を戻すこと", () => {
        tapTiles([3]);
        const position = getTilePosition(3);
        const headline = screen.getByText(
          "3 は空白と同じ行にも列にもありません",
        );
        tapTiles([1]);

        const restored = screen.getByText("残りを収めると完成です");

        expect(position).toBe("2行3列");
        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
      });

      test("空白と同じ行・列にないタイルをタップした後に止まると、印を出して、残りを収める一言に戻すこと", () => {
        tapTiles([3]);
        advanceTime(idleHintDelayMs);

        const headline = screen.getByText("残りを収めると完成です");
        const hinted = getCuedTiles("hint");

        expect(headline).toBeTruthy();
        expect(hinted).toEqual(["1"]);
      });

      test("並べ終えると、本番と同じ完成の音を、完成の波に合わせて鳴らすこと", () => {
        tapTiles(remainingTiles);

        const clearSounds = vi.mocked(playLayeredSound).mock.calls.length;

        expect(clearSounds).toBe(1);
      });

      test("空白と同じ行・列にないタイルをタップすると、本番と同じく、スライドしなかった音を鳴らすこと", () => {
        tapTiles([3]);

        const lastSound = getPlayedSoundNames().at(-1);

        expect(lastSound).toBe("invalid.flac");
      });

      test("並べ終えると、どのレベルも同じルールだと伝え、ゲームのホームで開いているレベルを遊ぶ操作でそのレベルを始めること", () => {
        tapTiles(remainingTiles);
        const detail = screen.getByText("どのレベルも同じルールです");
        fireEvent.click(screen.getByRole("button", { name: "レベル 2を遊ぶ" }));

        expect(detail).toBeTruthy();
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("並べ終えた後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        tapTiles(remainingTiles);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("最初はこのように崩れています");
        goThroughIntroSync();

        const position = getTilePosition(5);
        const hinted = getCuedTiles("hint");
        const rules = getRuleTexts();

        expect(caption).toBeTruthy();
        expect(position).toBe("3行2列");
        expect(hinted).toEqual(["5"]);
        expect(rules).toEqual(["空白にスライド", "まだ出ていないルール"]);
      });
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <SlidePuzzleTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、名前と何をするパズルか、ゴールの盤面を見せること", () => {
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const purpose = screen.getByText(
        "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
      );
      const positions = [getTilePosition(1), getTilePosition(8)];

      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(positions).toEqual(["1行1列", "3行2列"]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
      );
      const caption = screen.getByText("この形がゴールです");
      const position = getTilePosition(1);

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(position).toBe("1行1列");
    });

    test("ゴールで次へを押すと、始まりの一言を添えて崩れた始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.getByText("最初はこのように崩れています");
      const position = getTilePosition(1);

      expect(caption).toBeTruthy();
      expect(position).toBe("1行2列");
    });

    test("次へで最後まで進めると、最初の手順の一言と印を出すこと", () => {
      pressNext();
      goThroughIntroSync();

      const headline = screen.getByText(
        "空白の隣のタイルは タップするとスライドします",
      );
      const hinted = getCuedTiles("hint");

      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["5"]);
    });

    test("印の無いタイルを押すと、動きを減らす設定でも印のタイルの線を濃くし直すこと", () => {
      pressNextThroughIntro();
      tapTiles([7]);

      const recalled = getCuedTiles("recall");

      expect(recalled).toEqual(["5"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
    });

    test("並べ終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      playSteps(stepTiles);
      tapTiles(remainingTiles);
      const detail = screen.getByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
