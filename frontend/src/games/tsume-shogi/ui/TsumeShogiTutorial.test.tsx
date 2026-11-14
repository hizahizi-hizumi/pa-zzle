import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { TsumeShogiTutorial } from "@/games/tsume-shogi/ui/TsumeShogiTutorial";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const defenderReplyDelayMs = 600;

const nextStepCueDelayMs = 450;

const idleHintDelayMs = 4000;

/** 詰みの演出を見せ終えるのに十分な間。 */
const clearEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function advanceThroughReply(): void {
  advanceTime(defenderReplyDelayMs);
  advanceTime(nextStepCueDelayMs);
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

function getSquare(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "盤" })).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
}

function getHandGold(): HTMLElement {
  return within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
    "button",
    { name: /^金/ },
  );
}

function getUndo(): HTMLElement {
  return screen.getByRole("button", { name: "待った" });
}

/** 升の名前（例: `2三`）を順に押す。 */
function tapSquares(...names: readonly string[]): void {
  for (const name of names) {
    fireEvent.click(getSquare(name));
  }
}

function getMarked(): string[] {
  return Array.from(
    document.querySelectorAll('[data-tutorial-cue="mark"]'),
    (mark) => mark.parentElement?.getAttribute("aria-label") ?? "待った",
  );
}

function getRecalled(): string[] {
  return Array.from(
    document.querySelectorAll('[data-tutorial-cue="recall"]'),
    (mark) => mark.parentElement?.getAttribute("aria-label") ?? "待った",
  );
}

function getSpotlit(): string[] {
  return Array.from(
    document.querySelectorAll("[data-tutorial-spotlight]"),
    (spotlight) => spotlight.parentElement?.getAttribute("aria-label") ?? "",
  ).filter((label) => label !== "");
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

/** 手順の4手（金を打つ・金を下げる・飛を上げる・待った）を指す。 */
function playAllSteps(): void {
  fireEvent.click(getHandGold());
  tapSquares("2三");
  advanceThroughReply();
  tapSquares("2三", "2四");
  advanceThroughReply();
  tapSquares("2六", "2五");
  advanceThroughReply();
  fireEvent.click(getUndo());
}

describe("TsumeShogiTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "3", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <TsumeShogiTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
    });

    test("始めの盤面で、持駒の金に印を付け、打ち方を伝えること", () => {
      const headline = screen.getByText("持駒は、空いた升に打てます");
      const marked = getMarked();

      expect(headline).toBeTruthy();
      expect(marked).toEqual(["金 1枚"]);
    });

    test("印の持駒と、王手をかける玉を覆いから抜くこと", () => {
      const spotlit = getSpotlit();

      expect(spotlit).toEqual(["1三 玉方の玉", "金 1枚"]);
    });

    test("印の無い飛を押しても選ばず、音も鳴らさずに、印の線を濃くし直すこと", () => {
      tapSquares("2六");

      const rook = getSquare("2六");
      const recalled = getRecalled();

      expect(rook.getAttribute("aria-pressed")).toBe("false");
      expect(recalled).toEqual(["金 1枚"]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("持駒の金を選ぶと、打つ升へ印を移すこと", () => {
      fireEvent.click(getHandGold());

      const marked = getMarked();

      expect(marked).toEqual(["2三"]);
    });

    test("印の升へ打つと、本番と同じ音で指し、間を置いて玉が逃げてから、王手を伝えて次の印を付けること", () => {
      fireEvent.click(getHandGold());
      tapSquares("2三");
      const markedBeforeReply = getMarked();
      advanceThroughReply();

      const king = getSquare("1四");
      const headline = screen.getByText(
        "金を打った手は、王手でした 自分の番では、必ず王手をかけます",
      );
      const marked = getMarked();
      const sounds = getPlayedSoundNames();

      expect(markedBeforeReply).toEqual([]);
      expect(king.getAttribute("aria-label")).toBe("1四 玉方の玉");
      expect(headline).toBeTruthy();
      expect(marked).toEqual(["2三 攻方の金"]);
      expect(sounds).toHaveLength(2);
    });

    describe("王手を伝えた手順に進んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandGold());
        tapSquares("2三");
        advanceThroughReply();
        vi.mocked(playSound).mockClear();
      });

      test("印の金を王手にならない升へ動かそうとすると、本番と同じく着手させずに音を鳴らし、わけを伝えること", () => {
        tapSquares("2三", "3三");

        const headline = screen.getByText("王手にならない手は指せません");
        const gold = getSquare("2三");
        const sounds = getPlayedSoundNames();

        expect(headline).toBeTruthy();
        expect(gold.getAttribute("aria-label")).toBe("2三 攻方の金");
        expect(sounds).toEqual(["rejected.flac"]);
      });
    });

    describe("逃げ道を伝える手順に進んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandGold());
        tapSquares("2三");
        advanceThroughReply();
        tapSquares("2三", "2四");
        advanceThroughReply();
      });

      test("印の飛車と、王手をかける玉と、飛車が守っている逃げ道の升を覆いから抜くこと", () => {
        const spotlit = getSpotlit();
        const detail = screen.getByText(
          "空いた升と、守られていない駒の升が逃げ道です 飛車を動かして、逃げ道を開けてみてください",
        );

        expect(new Set(spotlit)).toEqual(
          new Set(["1五 玉方の玉", "1六", "2六 攻方の飛車"]),
        );
        expect(detail).toBeTruthy();
      });
    });

    describe("逃げ道のある王手を指した場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandGold());
        tapSquares("2三");
        advanceThroughReply();
        tapSquares("2三", "2四");
        advanceThroughReply();
        tapSquares("2六", "2五");
        advanceThroughReply();
      });

      test("玉が逃げ、この手数では詰まないことを盤の下に出して、待ったに印を付けること", () => {
        const king = getSquare("1六");
        const status = screen.getByRole("status");
        const headline = screen.getByText(
          "「5手では詰みません」と出たら 待ったを押して戻しましょう",
        );
        const marked = getMarked();

        expect(king.getAttribute("aria-label")).toBe("1六 玉方の玉");
        expect(status.textContent).toContain("5手では詰みません");
        expect(headline).toBeTruthy();
        expect(marked).toEqual(["待った"]);
      });

      test("待ったを押すと、王手の前に戻して手を離すこと", () => {
        fireEvent.click(getUndo());

        const king = getSquare("1五");
        const headline = screen.getByText(
          "逃げ道をふさぐ王手で 詰ませてください",
        );
        const marked = getMarked();

        expect(king.getAttribute("aria-label")).toBe("1五 玉方の玉");
        expect(headline).toBeTruthy();
        expect(marked).toEqual([]);
      });
    });

    describe("手を離した場合", () => {
      beforeEach(() => {
        playAllSteps();
      });

      test("手が止まると、詰ませる手の駒に印を付けること", () => {
        advanceTime(idleHintDelayMs);

        const marked = getMarked();

        expect(marked).toEqual(["2四 攻方の金"]);
      });

      test("覆いを外し、盤のどの升も覆いから抜かないこと", () => {
        const spotlit = getSpotlit();

        expect(spotlit).toEqual([]);
      });

      test("逃げ道のある王手を指すと、玉が逃げてから、待ったで戻せることを伝えること", () => {
        tapSquares("2六", "2五");
        advanceThroughReply();

        const headline = screen.getByText("逃げ道が残っていました");
        const detail = screen.getByText(
          "待ったを押すと、その王手の前に戻せます",
        );

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
      });

      test("金を下げて詰ませると、詰みの演出の後に、ゲームのホームで開いているレベルを遊ぶ操作を出し、押すとそのレベルを始めること", () => {
        tapSquares("2四", "2五");
        advanceTime(clearEnoughMs);
        const headline = screen.getByText("詰みです");
        const detail = screen.getByText("どのレベルも、3手か5手で詰む問題です");
        fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(playLayeredSound).toHaveBeenCalled();
        expect(playStart.onStart).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TsumeShogiTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
      playAllSteps();
    });

    test("詰ませると、プレイに戻る操作を出し、押すと閉じること", () => {
      tapSquares("2四", "2五");
      advanceTime(clearEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
