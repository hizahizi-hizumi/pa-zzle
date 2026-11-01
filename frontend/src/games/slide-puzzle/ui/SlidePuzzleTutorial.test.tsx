import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/** 手順ごとに印を付けるタイル。 */
const stepTiles = [5, 8, 4] as const;

/** 手順を終えた後、行と列をまとめてスライドさせて完成させるタイル。 */
const remainingTiles = [2, 6] as const;

/** 手順どおりにスライドさせてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 450;

/** 手を離した後、手が止まってから次のタイルを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 動きを減らす設定で、ゴールの盤面を見せる間。 */
const stillGoalHoldMs = 2800;

/** 導入を最後まで見せるのに十分な間。 */
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

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
}

/** 鳴らした効果音の音声ファイル名。 */
function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

/** 盤面の上の、行・列（1始まり）。 */
function getTilePosition(tile: number): string {
  const match = /translate\((\d+)%, (\d+)%\)/.exec(
    getTile(tile).style.transform,
  );
  return match
    ? `${Number(match[2]) / 100 + 1}行${Number(match[1]) / 100 + 1}列`
    : "";
}

function getCuedTiles(kind: "hint" | "landed" | "reminder"): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector(`[data-tile-cue="${kind}"]`))
    .map((tile) => tile.textContent ?? "");
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
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
    beforeEach(() => {
      render(
        <SlidePuzzleTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
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
      expect(rules).toEqual(["空白にスライド", "？"]);
    });

    test("空白の隣でも印の無いタイルを押すと、スライドさせず音も鳴らさずに、一言を変えずに印のタイルを光らせ直すこと", () => {
      tapTiles([7]);

      const position = getTilePosition(7);
      const headline = screen.getByText(
        "空白の隣のタイルは タップするとスライドします",
      );
      const hinted = getCuedTiles("hint");
      const reminded = getCuedTiles("reminder");

      expect(position).toBe("2行1列");
      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["5"]);
      expect(reminded).toEqual(["5"]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("印の無いタイルを続けて押すたびに、印のタイルを光らせ直すこと", () => {
      tapTiles([7]);
      const firstFlash = getTile(5).querySelector('[data-tile-cue="reminder"]');
      tapTiles([3]);

      const secondFlash = getTile(5).querySelector(
        '[data-tile-cue="reminder"]',
      );

      expect(firstFlash).not.toBeNull();
      expect(secondFlash).not.toBeNull();
      expect(secondFlash).not.toBe(firstFlash);
    });

    test("印のタイルをタップすると、空白にスライドして収まり、収まってから次の印を付けること", () => {
      tapTiles([5]);
      const position = getTilePosition(5);
      const landed = getCuedTiles("landed");
      const headline = screen.getByText("この空白には 8 が収まります");
      const hintedBeforeDelay = getCuedTiles("hint");
      advanceTime(nextStepCueDelayMs);

      const hinted = getCuedTiles("hint");

      expect(position).toBe("2行2列");
      expect(landed).toEqual(["5"]);
      expect(headline).toBeTruthy();
      expect(hintedBeforeDelay).toEqual([]);
      expect(hinted).toEqual(["8"]);
    });

    test("印のタイルをタップすると、本番と同じスライドの音を鳴らすこと", () => {
      tapTiles([5]);

      const sounds = getPlayedSoundNames();

      expect(sounds).toEqual(["slid.flac"]);
    });

    describe("同じ行・列のルールを示す手順に進んだ場合", () => {
      beforeEach(() => {
        tapTiles(stepTiles.slice(0, 2));
        advanceTime(nextStepCueDelayMs);
      });

      test("離れたタイルもスライドすることと、印のタイルをタップすると何が起きるかを伝えること", () => {
        const headline = screen.getByText(
          "空白と同じ行・列なら 離れたタイルもスライドします",
        );
        const detail = screen.getByText("4 をタップすると 7 もスライドします");

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
      });

      test("隣にある 7 をタップしても、スライドさせずに、手順の一言のまま印のタイルを光らせ直すこと", () => {
        tapTiles([7]);

        const position = getTilePosition(7);
        const detail = screen.getByText("4 をタップすると 7 もスライドします");
        const reminded = getCuedTiles("reminder");

        expect(position).toBe("2行1列");
        expect(detail).toBeTruthy();
        expect(reminded).toEqual(["4"]);
      });

      describe("タイルを揺らせる環境の場合", () => {
        beforeEach(() => {
          installAnimate();
        });

        test("空白と同じ行・列にないタイルをタップすると、本番と同じく揺らして音を鳴らし、スライドさせずにわけを伝えること", () => {
          tapTiles([5]);

          const position = getTilePosition(5);
          const headline = screen.getByText(
            "5 は空白と同じ行にも列にもありません",
          );
          const shakeCount = vi.mocked(HTMLElement.prototype.animate).mock.calls
            .length;
          const sounds = getPlayedSoundNames();
          const reminded = getCuedTiles("reminder");

          expect(position).toBe("2行2列");
          expect(headline).toBeTruthy();
          expect(shakeCount).toBe(1);
          expect(sounds).toEqual(["slid.flac", "slid.flac", "invalid.flac"]);
          expect(reminded).toEqual([]);
        });
      });

      test("わけを伝えた後に印の無い 7 をタップすると、印のタイルを光らせ直して、手順の一言に戻すこと", () => {
        tapTiles([5, 7]);

        const detail = screen.getByText("4 をタップすると 7 もスライドします");
        const reminded = getCuedTiles("reminder");

        expect(detail).toBeTruthy();
        expect(reminded).toEqual(["4"]);
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
        tapTiles(stepTiles);
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

      test("並べ終えると、レベル1とのつながりを伝え、レベル1を遊ぶでレベル1を始めること", () => {
        tapTiles(remainingTiles);
        const detail = screen.getByText(
          "レベル1では じゃまなタイルをどかしながら並べます",
        );
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

        expect(detail).toBeTruthy();
        expect(onStartPlay).toHaveBeenCalledOnce();
      });

      test("並べ終えた後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        tapTiles(remainingTiles);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("最初はこのように崩れています");
        advanceTime(introEnoughMs);

        const position = getTilePosition(5);
        const hinted = getCuedTiles("hint");
        const rules = getRuleTexts();

        expect(caption).toBeTruthy();
        expect(position).toBe("3行2列");
        expect(hinted).toEqual(["5"]);
        expect(rules).toEqual(["空白にスライド", "？"]);
      });
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

    test("ゴールを見せた後に、始まりの一言を添えて崩れた始めの盤面を見せること", () => {
      advanceTime(stillGoalHoldMs);

      const caption = screen.getByText("最初はこのように崩れています");
      const position = getTilePosition(1);

      expect(caption).toBeTruthy();
      expect(position).toBe("1行2列");
    });

    test("最後まで見せると、最初の手順の一言と印を出すこと", () => {
      advanceTime(stillGoalHoldMs);
      advanceTime(introEnoughMs);

      const headline = screen.getByText(
        "空白の隣のタイルは タップするとスライドします",
      );
      const hinted = getCuedTiles("hint");

      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["5"]);
    });

    test("印の無いタイルを押すと、動きを減らす設定でも印のタイルを光らせ直すこと", () => {
      skipIntro();
      tapTiles([7]);

      const reminded = getCuedTiles("reminder");

      expect(reminded).toEqual(["5"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("並べ終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      tapTiles([...stepTiles, ...remainingTiles]);
      const detail = screen.getByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
