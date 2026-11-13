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

const defenderReplyDelayMs = 600;

const nextStepCueDelayMs = 450;

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

/** 入口の「はじめる」を押し、始めの盤面へ替える場面を終えて、最初の手順から始める。 */
function pressStart(): void {
  fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
  advanceTime(1000);
}

function getProgressValue(): string | null {
  return screen
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function getSquare(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "盤" })).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
}

function getHandRook(): HTMLElement {
  return within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
    "button",
    { name: /^飛/ },
  );
}

function getUndo(): HTMLElement {
  return screen.getByRole("button", { name: "待った" });
}

/** 升の名前（例: `8三`）を順に押す。 */
function tapSquares(...names: readonly string[]): void {
  for (const name of names) {
    fireEvent.click(getSquare(name));
  }
}

function getCueOwners(cue: string): string[] {
  return Array.from(
    document.querySelectorAll(`[data-tutorial-cue="${cue}"]`),
    (element) => {
      const owner = element.closest("button") ?? element.parentElement;
      return owner?.getAttribute("aria-label") ?? "待った";
    },
  );
}

/** 盤の中を覆う間、覆いから抜いている盤の升。盤の外の抜く所（一言の欄など）は除く。 */
function getSpotlit(): string[] {
  return Array.from(
    document.querySelectorAll("[data-tutorial-spotlight]"),
    (spotlight) => spotlight.parentElement?.getAttribute("aria-label") ?? "",
  ).filter((label) => label !== "");
}

function isBoardCovered(): boolean {
  return screen
    .getByRole("group", { name: "盤" })
    .hasAttribute("data-tutorial-spotlight-area");
}

function getMessageText(): string {
  return screen.getByRole("dialog").textContent ?? "";
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

/** 銀を王手の升へ動かす。成・不成は成るほうを選ぶ。 */
function playSilverCheck(): void {
  tapSquares("6一", "7二");
  fireEvent.click(screen.getByRole("button", { name: /^成/ }));
}

/** 手順をすべて指して手を離す。 */
function playAllSteps(): void {
  fireEvent.click(getHandRook());
  tapSquares("8三");
  advanceThroughReply();
  playSilverCheck();
  advanceThroughReply();
  tapSquares("7三", "8二");
  advanceThroughReply();
  fireEvent.click(getUndo());
  advanceThroughReply();
  tapSquares("7三", "7二");
  advanceThroughReply();
}

describe("TsumeShogiTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
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
      pressStart();
    });

    test("始めの盤面で、持駒の飛車に指を添えた印を付け、盤を覆わず、進み具合を空にしておくこと", () => {
      const marked = getCueOwners("mark");
      const pointed = getCueOwners("pointer");
      const progress = getProgressValue();

      expect(getMessageText()).toContain("印の駒を押してから");
      expect(marked).toEqual(["飛車 1枚"]);
      expect(pointed).toEqual(["飛車 1枚"]);
      expect(isBoardCovered()).toBe(false);
      expect(progress).toBe("0");
    });

    test("印の無い金を押しても選ばず、音も鳴らさずに、印の線を濃くし直すこと", () => {
      tapSquares("7三");

      const gold = getSquare("7三");
      const recalled = getCueOwners("recall");

      expect(gold.getAttribute("aria-pressed")).toBe("false");
      expect(recalled).toEqual(["飛車 1枚"]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("持駒の飛車を選ぶと、打つ升へ指の無い印を移すこと", () => {
      fireEvent.click(getHandRook());

      const marked = getCueOwners("mark");
      const pointed = getCueOwners("pointer");

      expect(marked).toEqual(["8三"]);
      expect(pointed).toEqual([]);
    });

    test("印の升へ打つと、本番と同じ音で指し、間を置いて玉が応じてから、王手を伝えて銀に印を付けること", () => {
      fireEvent.click(getHandRook());
      tapSquares("8三");
      const markedBeforeReply = getCueOwners("mark");
      advanceThroughReply();

      const king = getSquare("7一");
      const marked = getCueOwners("mark");
      const sounds = getPlayedSoundNames();

      expect(markedBeforeReply).toEqual([]);
      expect(king.getAttribute("aria-label")).toBe("7一 玉方の玉");
      expect(getMessageText()).toContain("自分の番はいつも王手をかけます");
      expect(marked).toEqual(["6一 攻方の銀"]);
      expect(sounds.length).toBeGreaterThanOrEqual(2);
      expect(getProgressValue()).not.toBe("0");
    });

    describe("王手を伝えた手順に進んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandRook());
        tapSquares("8三");
        advanceThroughReply();
        vi.mocked(playSound).mockClear();
      });

      test("盤の中を覆い、印の銀と王手をかける玉を元の明るさで残すこと", () => {
        const spotlit = getSpotlit();

        expect(isBoardCovered()).toBe(true);
        expect(new Set(spotlit)).toEqual(
          new Set(["7一 玉方の玉", "6一 攻方の銀"]),
        );
      });

      test("銀を選んだ後は、行き先に印を付けず、王手の升を自分で選ぶことを伝え、覆いは残すこと", () => {
        tapSquares("6一");

        const marked = getCueOwners("mark");

        expect(marked).toEqual([]);
        expect(getMessageText()).toContain("王手になる升を選びます");
        expect(isBoardCovered()).toBe(true);
      });

      test("銀を王手にならない升へ動かそうとすると、本番と同じく着手させずに音を鳴らし、わけを伝えること", () => {
        tapSquares("6一", "5二");

        const silver = getSquare("6一");
        const sounds = getPlayedSoundNames();

        expect(getMessageText()).toContain("王手になっていません");
        expect(silver.getAttribute("aria-label")).toBe("6一 攻方の銀");
        expect(sounds).toEqual(["rejected.flac"]);
      });

      test("一度ルールに合わない手を指すと、銀の行き先の升にも印を付けること", () => {
        tapSquares("6一", "5二");

        const marked = getCueOwners("mark");

        expect(marked).toEqual(["7二"]);
      });

      test("王手になる升へ動かすと、成・不成を選ぶ間に成ることを伝えること", () => {
        tapSquares("6一", "7二");

        expect(getMessageText()).toContain("成ると裏返って");
      });
    });

    describe("王手した駒を取られて詰まなくなることを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandRook());
        tapSquares("8三");
        advanceThroughReply();
        playSilverCheck();
        advanceThroughReply();
      });

      test("印の金と、金を取る相手の飛車を覆いから抜くこと", () => {
        const spotlit = getSpotlit();

        expect(getMessageText()).toContain("次に金で王手をかけると");
        expect(new Set(spotlit)).toEqual(
          new Set(["7二 玉方の飛車", "7三 攻方の金"]),
        );
      });

      test("金を選んで印の無い飛車を押すと、何をする手順かを言い直し、印の線を濃くし直すこと", () => {
        tapSquares("7三", "7二");

        const rook = getSquare("7二");
        const recalled = getCueOwners("recall");

        expect(rook.getAttribute("aria-label")).toBe("7二 玉方の飛車");
        expect(getMessageText()).toContain("先に取られる王手を");
        expect(recalled).toEqual(["8二"]);
      });

      test("印の升へ金を動かすと、金を取られて逃れられ、待ったに覆いの無い印を付けること", () => {
        tapSquares("7三", "8二");
        advanceThroughReply();

        const rook = getSquare("8二");
        const status = screen.getByRole("status");
        const marked = getCueOwners("mark");

        expect(rook.getAttribute("aria-label")).toBe("8二 玉方の飛車");
        expect(status.textContent).toContain("逃れる");
        expect(getMessageText()).toContain(
          "詰まなくなったら待ったボタンを押して",
        );
        expect(marked).toEqual(["待った"]);
        expect(isBoardCovered()).toBe(false);
      });
    });

    describe("持駒を伝える手順に進んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandRook());
        tapSquares("8三");
        advanceThroughReply();
        playSilverCheck();
        advanceThroughReply();
        tapSquares("7三", "8二");
        advanceThroughReply();
        fireEvent.click(getUndo());
        advanceThroughReply();
      });

      test("金に印を付け、取られなかった飛車を取る王手を自分で選ばせること", () => {
        const marked = getCueOwners("mark");

        expect(getMessageText()).toContain("自分の持駒になります");
        expect(marked).toEqual(["7三 攻方の金"]);
      });

      test("ほかの王手を指して逃れられた後に盤を押しても、取られたわけの一言を残すこと", () => {
        tapSquares("7三", "6二");
        advanceThroughReply();
        tapSquares("8三");

        expect(getMessageText()).toContain("詰まなくなりました");
      });

      test("ほかの王手を指すと、金を取られたわけを伝え、待ったで同じ手順に戻すこと", () => {
        tapSquares("7三", "6二");
        advanceThroughReply();
        const refutedMessage = getMessageText();
        fireEvent.click(getUndo());

        const marked = getCueOwners("mark");

        fireEvent.click(getSquare("7三"));
        const markedAfterSelect = getCueOwners("mark");

        expect(refutedMessage).toContain("詰まなくなりました");
        expect(marked).toEqual(["7三 攻方の金"]);
        expect(markedAfterSelect).toEqual(["7二 玉方の飛車"]);
      });
    });

    describe("手を離した場合", () => {
      beforeEach(() => {
        playAllSteps();
      });

      test("取った飛車を駒台に置き、印を付けず、盤を覆わず、「ヒント」を出すこと", () => {
        const rook = getHandRook();
        const marked = getCueOwners("mark");

        expect(rook.getAttribute("aria-label")).toBe("飛車 1枚");
        expect(marked).toEqual([]);
        expect(isBoardCovered()).toBe(false);
        expect(screen.getByRole("button", { name: "ヒント" })).toBeTruthy();
      });

      test("手が止まっても、求められるまで手がかりを出さないこと", () => {
        advanceTime(10000);

        const marked = getCueOwners("mark");

        expect(marked).toEqual([]);
      });

      test("「ヒント」を押すと、持駒の飛車に印を付けて玉を覆いから抜き、選ぶと打つ升へ印を移すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "ヒント" }));
        const hinted = getCueOwners("mark");
        const spotlit = getSpotlit();
        fireEvent.click(getHandRook());

        const marked = getCueOwners("mark");

        expect(hinted).toEqual(["飛車 1枚"]);
        expect(spotlit).toEqual(["7二 玉方の玉"]);
        expect(marked).toEqual(["7三"]);
      });

      test("逃れられる王手を指すと、待ったで戻せることを伝え、直す所として待ったに印を付けて「ヒント」を下げること", () => {
        fireEvent.click(getHandRook());
        tapSquares("7四");
        advanceThroughReply();

        const marked = getCueOwners("mark");
        const hint = screen.queryByRole("button", { name: "ヒント" });

        expect(getMessageText()).toContain(
          "待ったボタンを押して王手の前に戻します",
        );
        expect(marked).toEqual(["待った"]);
        expect(hint).toBeNull();
      });

      test("取った飛車を打って詰ませると、詰みの演出の後に、ゲームのホームで開いているレベルを遊ぶ操作を出し、押すとそのレベルを始めること", () => {
        fireEvent.click(getHandRook());
        tapSquares("7三");
        advanceTime(clearEnoughMs);
        const message = getMessageText();
        fireEvent.click(screen.getByRole("button", { name: "レベル 1を遊ぶ" }));

        expect(message).toContain("詰みです");
        expect(playLayeredSound).toHaveBeenCalled();
        expect(playStart.onStart).toHaveBeenCalledTimes(1);
      });

      describe("詰ませた場合", () => {
        beforeEach(() => {
          fireEvent.click(getHandRook());
          tapSquares("7三");
          advanceTime(clearEnoughMs);
        });

        test("覚えたルールを並べ、進み具合を満たすこと", () => {
          const recap = within(
            screen.getByRole("list", { name: "覚えたルール" }),
          )
            .getAllByRole("listitem")
            .map((item) => item.textContent);
          const progress = getProgressValue();

          expect(recap).toEqual([
            "自分の番はいつも王手をかけます",
            "取られて詰まなくなる王手もあります",
            "相手の駒を取ると自分の持駒になります",
          ]);
          expect(progress).toBe("100");
        });

        test("もう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", () => {
          fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
          advanceTime(0);

          const startButton = screen.queryByRole("button", {
            name: "はじめる",
          });
          const king = getSquare("8一");
          const marked = getCueOwners("mark");
          const progress = getProgressValue();

          expect(startButton).toBeNull();
          expect(king.getAttribute("aria-label")).toBe("8一 玉方の玉");
          expect(marked).toEqual(["飛車 1枚"]);
          expect(progress).toBe("0");
        });
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TsumeShogiTutorial open={true} onClose={onClose} />);
      pressStart();
      playAllSteps();
    });

    test("詰ませると、プレイに戻る操作を出し、押すと閉じること", () => {
      fireEvent.click(getHandRook());
      tapSquares("7三");
      advanceTime(clearEnoughMs);
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
