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
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/** 攻方が指してから、玉方の応手を盤面に指すまでの間。 */
const defenderReplyDelayMs = 600;

/** 玉方が応じて次の手順へ進んでから、次の所を指すまでの間。 */
const nextStepCueDelayMs = 450;

/** 手を離した後、手が止まってから次の手を指すまでの間。 */
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

/** 玉方が応じ、次の所を指すまで待つ。 */
function advanceThroughReply(): void {
  advanceTime(defenderReplyDelayMs);
  advanceTime(nextStepCueDelayMs);
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: "詰将棋" });
}

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function getShownText(text: string): HTMLElement {
  return within(getScreen()).getByText(text.replaceAll("\n", " "));
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

/** 指で指している升・持駒・待った。 */
function getPointed(): string[] {
  return Array.from(
    document.querySelectorAll('[data-tutorial-cue="pointer"]'),
    (pointer) =>
      pointer.parentElement?.getAttribute("aria-label") ??
      pointer.parentElement
        ?.querySelector("button")
        ?.getAttribute("aria-label") ??
      "",
  );
}

function getRecalled(): string[] {
  return Array.from(
    document.querySelectorAll('[data-tutorial-cue="recall"]'),
    (mark) => mark.parentElement?.getAttribute("aria-label") ?? "",
  );
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

/** 手順の2手（▲1二金・▲4三金打）を指す。 */
function playAllSteps(): void {
  tapSquares("1一", "1二");
  advanceThroughReply();
  fireEvent.click(getHandGold());
  tapSquares("4三");
  advanceThroughReply();
}

/** 手を離した後の2手（▲2五金打・▲1三金）で詰ませる。 */
function mate(): void {
  fireEvent.click(getHandGold());
  tapSquares("2五");
  advanceThroughReply();
  tapSquares("1二", "1三");
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
    });

    test("入口で、詰み上がりではなく始めの盤面に、何をするパズルかとゴールの一言を添えること", () => {
      const king = getSquare("2二");
      const purpose = getShownText("相手の玉を詰ませるパズルです");
      const caption = getShownText(
        "逆さの駒は相手の駒です\n玉が逃げられなくなったら詰みです",
      );

      expect(king.getAttribute("aria-label")).toBe("2二 玉方の玉");
      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(getPointed()).toEqual([]);
    });

    describe("はじめた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
        advanceTime(1000);
      });

      test("盤上の金を指で指し、押し方を伝えること", () => {
        const headline = getShownText("この金を押します");
        const pointed = getPointed();

        expect(headline).toBeTruthy();
        expect(pointed).toEqual(["1一 攻方の金"]);
      });

      test("指していない飛を押しても選ばず、音も鳴らさずに、印の線を濃くし直すこと", () => {
        tapSquares("1五");

        const rook = getSquare("1五");
        const recalled = getRecalled();

        expect(rook.getAttribute("aria-pressed")).toBe("false");
        expect(recalled).toEqual(["1一 攻方の金"]);
        expect(playSound).not.toHaveBeenCalled();
      });

      test("金を選ぶと、行き先の升を指し、王手をかけることを伝えること", () => {
        tapSquares("1一");

        const headline = getShownText("印の升を押して\n王手をかけます");
        const pointed = getPointed();

        expect(headline).toBeTruthy();
        expect(pointed).toEqual(["1二"]);
      });

      test("指した升へ動かすと、本番と同じ音で指し、間を置いて玉が逃げてから、持駒の金を指すこと", () => {
        tapSquares("1一", "1二");
        const pointedBeforeReply = getPointed();
        const headlineBeforeReply = getShownText(
          "印の升を押して\n王手をかけます",
        );
        advanceThroughReply();

        const king = getSquare("3三");
        const headline = getShownText("持駒は空いた升に打てます");
        const pointed = getPointed();
        const sounds = getPlayedSoundNames();

        expect(pointedBeforeReply).toEqual([]);
        expect(headlineBeforeReply).toBeTruthy();
        expect(king.getAttribute("aria-label")).toBe("3三 玉方の玉");
        expect(headline).toBeTruthy();
        expect(pointed).toEqual(["金 2枚"]);
        expect(sounds).toHaveLength(2);
      });
    });

    describe("手を離した場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
        advanceTime(1000);
        playAllSteps();
        vi.mocked(playSound).mockClear();
      });

      test("残りの王手の数を伝え、すぐには指さないこと", () => {
        const headline = getShownText(
          "あと2回王手をかけて\n詰ませてみましょう",
        );
        const pointed = getPointed();

        expect(headline).toBeTruthy();
        expect(pointed).toEqual([]);
      });

      test("手が止まると、詰ませる手の持駒を指すこと", () => {
        advanceTime(idleHintDelayMs);

        const pointed = getPointed();

        expect(pointed).toEqual(["金 1枚"]);
      });

      test("王手にならない手は、本番と同じく着手させずに音を鳴らし、わけを伝えること", () => {
        fireEvent.click(getHandGold());
        tapSquares("5五");

        const headline = getShownText("王手にならない手は指せません");
        const sounds = getPlayedSoundNames();

        expect(headline).toBeTruthy();
        expect(sounds).toEqual(["rejected.flac"]);
      });

      test("手順の手は、待ったで戻せないこと", () => {
        const undo = getUndo();

        expect(undo).toHaveProperty("disabled", true);
      });

      describe("詰まない王手を指した場合", () => {
        beforeEach(() => {
          fireEvent.click(getHandGold());
          tapSquares("2三");
          advanceThroughReply();
        });

        test("玉が守られていない飛を取って逃れ、この手数では詰まないことを盤の下に出して、駒を取られたと伝えてすぐ待ったを指すこと", () => {
          const status = screen.getByRole("status");
          const headline = getShownText(
            "玉に駒を取られました\n待ったを押して戻しましょう",
          );
          const pointed = getPointed();

          expect(getSquare("1五").getAttribute("aria-label")).toBe(
            "1五 玉方の玉",
          );
          expect(status.textContent).toContain("7手では詰みません");
          expect(headline).toBeTruthy();
          expect(pointed).toEqual(["待った"]);
        });

        test("待ったを押すと、王手の前に戻して、残りの王手の数を伝えること", () => {
          fireEvent.click(getUndo());

          const king = getSquare("2四");
          const headline = getShownText(
            "あと2回王手をかけて\n詰ませてみましょう",
          );

          expect(king.getAttribute("aria-label")).toBe("2四 玉方の玉");
          expect(headline).toBeTruthy();
        });
      });

      describe("続けて王手できる詰まない王手を指した場合", () => {
        beforeEach(() => {
          tapSquares("1五", "1四");
          advanceThroughReply();
        });

        test("待ったを押す前に王手にならない手を指そうとすると、そのわけを伝えること", () => {
          tapSquares("4二", "5二");

          const headline = getShownText("王手にならない手は指せません");

          expect(headline).toBeTruthy();
          expect(getPointed()).toEqual(["待った"]);
        });
      });

      test("詰ませると、詰みの演出の後に、覚えたルールを振り返り、ゲームのホームで開いているレベルを遊ぶ操作を出し、押すとそのレベルを始めること", () => {
        mate();
        advanceTime(clearEnoughMs);
        const headline = getShownText("詰みです");
        const detail = getShownText("どのレベルも同じルールです");
        const recap = within(
          screen.getByRole("list", { name: "覚えたルール" }),
        ).getAllByRole("listitem");
        fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(recap.map((item) => item.textContent)).toEqual([
          "自分の番では毎回王手をかけます",
          "持駒は空いた升に打てます",
        ]);
        expect(playLayeredSound).toHaveBeenCalled();
        expect(playStart.onStart).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TsumeShogiTutorial open={true} onClose={onClose} />);
      fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
      advanceTime(1000);
      playAllSteps();
    });

    test("詰ませると、プレイの問題も同じルールだと伝え、プレイに戻る操作を出し、押すと閉じること", () => {
      mate();
      advanceTime(clearEnoughMs);
      const detail = getShownText("プレイ中の問題も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
