import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  iceFloorMazeTutorial,
  iceFloorMazeTutorialRecap,
} from "@/games/ice-floor-maze/tutorial/tutorial";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
}));

function cellAt(x: number, y: number): number {
  return y * 6 + x;
}

const start = cellAt(2, 5);
const goal = cellAt(4, 4);

/** 手順ごとの、印のマスへ最も少ない手数で止める向きと印のマス。 */
const steps = [
  { directions: ["up"], target: cellAt(2, 2) },
  { directions: ["right"], target: cellAt(4, 2) },
  { directions: ["down"], target: cellAt(4, 5) },
  { directions: ["left", "up"], target: cellAt(1, 1) },
] as const satisfies readonly {
  directions: readonly IceFloorMazeDirection[];
  target: number;
}[];

const remainingDirections = ["left", "down", "right"] as const;

const firstFreePlayStop = cellAt(0, 1);

const nextStepCueEnoughMs = 1500;

/** 最初の手順の滑り（3マス）を滑り終えるのに十分で、次の印に替わるまでの間より短い時間。 */
const slideFinishedMs = 500;

const longIdleMs = 10000;

const arrowKeyByDirection = {
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  left: "ArrowLeft",
} as const satisfies Record<IceFloorMazeDirection, string>;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
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
  return screen.getByRole("dialog", { name: ICE_FLOOR_MAZE_DISPLAY_NAME });
}

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

function queryStartButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "はじめる" });
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function slide(directions: readonly IceFloorMazeDirection[]): void {
  for (const direction of directions) {
    fireEvent.keyDown(window, { key: arrowKeyByDirection[direction] });
  }
}

/** 手順を順に、印のマスへ止まる向きへ滑らせ、そのたびに次の印が出るまで待つ。 */
function finishSteps(count: number): void {
  for (const step of steps.slice(0, count)) {
    for (const direction of step.directions) {
      slide([direction]);
      advanceTime(nextStepCueEnoughMs);
    }
  }
}

function getBoard(): HTMLElement {
  return screen.getByRole("img", { name: "盤面" });
}

function getPiecePosition(): number {
  return Number(
    getBoard()
      .querySelector("[data-piece-cell]")
      ?.getAttribute("data-piece-cell"),
  );
}

function getCuedCell(): number | null {
  const cue = document.querySelector("[data-cell-cue]");
  return cue ? Number(cue.getAttribute("data-cell-cue")) : null;
}

function getSwipeCue(): { cellIndex: number; direction: string | null } | null {
  const cue = document.querySelector("[data-swipe-cue]");
  return cue
    ? {
        cellIndex: Number(cue.getAttribute("data-swipe-cue")),
        direction:
          cue
            .querySelector('[data-tutorial-cue="pointer"]')
            ?.getAttribute("data-swipe") ?? null,
      }
    : null;
}

function getBoardSpotlights(): NodeListOf<Element> {
  return (getBoard().parentElement ?? getBoard()).querySelectorAll(
    "[data-tutorial-spotlight]",
  );
}

function getPlayedSoundNames(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => sound.url.split("/").at(-1) ?? "");
}

describe("IceFloorMazeTutorial", () => {
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
        <IceFloorMazeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("始めの盤面で、操作と滑るルールを伝え、駒を止めるマスに印を付けること", () => {
      const headline = screen.getByText("駒は岩か壁にぶつかるまで 滑ります");
      const detail = screen.getByText("上へスワイプして駒を滑らせてみましょう");
      const position = getPiecePosition();
      const cued = getCuedCell();

      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(position).toBe(start);
      expect(cued).toBe(steps[0].target);
      expect(getProgressValue()).toBe("0");
    });

    test("操作を教える手順では、駒のマスで指を上へ滑らせて、スワイプの向きを見せること", () => {
      const swipe = getSwipeCue();

      expect(swipe).toEqual({ cellIndex: start, direction: "up" });
    });

    test("操作を教える手順では、盤面を覆わないこと", () => {
      const spotlights = getBoardSpotlights();

      expect(spotlights.length).toBe(0);
    });

    test("印のマスで止まらない向きへ滑らせようとすると、駒を動かさず音も鳴らさずに、印の線を濃くし直すこと", () => {
      slide(["left"]);

      const position = getPiecePosition();
      const recalled = document.querySelector('[data-tutorial-cue="recall"]');

      expect(position).toBe(start);
      expect(recalled).not.toBeNull();
      expect(playSound).not.toHaveBeenCalled();
    });

    test("1マスも動けない向きへ滑らせようとすると、本番と同じく押し戻して動けなかった音を鳴らし、印の線を濃くし直すこと", () => {
      slide(["down"]);

      const position = getPiecePosition();
      const recalled = document.querySelector('[data-tutorial-cue="recall"]');
      const sounds = getPlayedSoundNames();

      expect(position).toBe(start);
      expect(recalled).not.toBeNull();
      expect(sounds).toEqual(["blocked.flac"]);
    });

    test("駒が滑っている間は、次の手順の手を受け付けないこと", () => {
      slide(["up", "right"]);

      const position = getPiecePosition();

      expect(position).toBe(steps[0].target);
    });

    test("滑り終えた後なら、次の一言と印に替わる前の手でも受け付けること", () => {
      slide(["up"]);
      advanceTime(slideFinishedMs);
      slide(["right"]);

      const position = getPiecePosition();

      expect(position).toBe(steps[1].target);
    });

    describe("ルールを伝える手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(1);
      });

      test("向きを自分で選ばせるため、指のしぐさを出さないこと", () => {
        const swipe = getSwipeCue();

        expect(swipe).toBeNull();
      });

      test("駒のいるマス・印のマス・止める床を、盤面の覆いから抜くこと", () => {
        const spotlights = getBoardSpotlights();

        expect(spotlights.length).toBeGreaterThan(0);
      });
    });

    describe("読みの手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(3);
      });

      test("1回目を滑らせても同じ一言と印のままで、もう1回滑らせると手を離すこと", () => {
        slide(["left"]);
        advanceTime(nextStepCueEnoughMs);
        const cuedAfterFirst = getCuedCell();
        const headlineAfterFirst = screen.queryByText(
          "止めたいマスの先の岩に 向けて滑らせます",
        );
        slide(["up"]);
        advanceTime(nextStepCueEnoughMs);

        const headline = screen.queryByText(
          "ゴールで止めるにはどこから滑らせるかを逆にたどりましょう",
        );

        expect(cuedAfterFirst).toBe(steps[3].target);
        expect(headlineAfterFirst).not.toBeNull();
        expect(headline).not.toBeNull();
      });
    });

    test("印のマスへ止まる向きへ滑らせると、駒が止まり、滑り終えて見届けるまで今の一言を残してから、次の一言と印に替え、進み具合を進めること", () => {
      slide(["up"]);
      const position = getPiecePosition();
      const cuedBeforeDelay = getCuedCell();
      const headlineBeforeDelay = screen.queryByText(
        "駒は岩か壁にぶつかるまで 滑ります",
      );
      advanceTime(nextStepCueEnoughMs);

      const cued = getCuedCell();
      const headline = screen.queryByText("駒は緑の床に乗ると止まります");

      expect(position).toBe(steps[0].target);
      expect(cuedBeforeDelay).toBeNull();
      expect(headlineBeforeDelay).not.toBeNull();
      expect(cued).toBe(steps[1].target);
      expect(headline).not.toBeNull();
      expect(getProgressValue()).toBe("20");
    });

    test("印のマスへ止まる向きへ滑らせると、本番と同じ滑る音を鳴らすこと", () => {
      slide(["up"]);

      const sounds = getPlayedSoundNames();

      expect(sounds).toEqual([
        "slid.flac",
        "glided-short.flac",
        "stopped.flac",
      ]);
    });

    test("盤面をスワイプしても滑らせること", () => {
      const board = getBoard();
      fireEvent.pointerDown(board, {
        isPrimary: true,
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(board, {
        isPrimary: true,
        pointerId: 1,
        clientX: 100,
        clientY: 40,
      });

      const position = getPiecePosition();

      expect(position).toBe(steps[0].target);
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(steps.length);
      });

      test("ゴールで止めることを伝え、手が止まっていても印も覆いも出さないこと", () => {
        advanceTime(longIdleMs);

        const cued = getCuedCell();
        const spotlights = getBoardSpotlights();
        const headline = screen.getByText(
          "ゴールで止めるにはどこから滑らせるかを逆にたどりましょう",
        );

        expect(cued).toBeNull();
        expect(spotlights.length).toBe(0);
        expect(headline).toBeTruthy();
      });

      test("ヒントを押すと、次に止まるマスに印を付けてその手を決めるルールの一言を出し、次の手で消すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "ヒント" }));
        const cued = getCuedCell();
        const headline = screen.queryByText(
          "駒は岩か壁にぶつかるまで 滑ります",
        );
        slide(["left"]);

        const cuedAfterSlide = getCuedCell();

        expect(cued).toBe(firstFreePlayStop);
        expect(headline).not.toBeNull();
        expect(cuedAfterSlide).toBeNull();
      });

      test("ヒントでは、手を引く間のルールを伝える手順と同じく、指のしぐさを出さないこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "ヒント" }));

        const swipe = getSwipeCue();

        expect(swipe).toBeNull();
      });

      test("1マスも動けない向きへ滑らせると、駒を動かさず、本番と同じ動けなかった音を鳴らすこと", () => {
        vi.mocked(playSound).mockClear();
        slide(["up"]);

        const position = getPiecePosition();
        const sounds = getPlayedSoundNames();

        expect(position).toBe(steps[3].target);
        expect(sounds).toEqual(["blocked.flac"]);
      });

      test("手を離した後は、手順の分だけ進み具合を進めておくこと", () => {
        const progress = getProgressValue();

        expect(progress).toBe("80");
      });

      describe("ゴールで止めた場合", () => {
        beforeEach(() => {
          slide(remainingDirections);
          advanceTime(nextStepCueEnoughMs);
        });

        test("完成を伝え、覚えたルールを並べ、進み具合を満たすこと", () => {
          const headline = screen.getByText("完成です");
          const detail = screen.getByText(
            "ほかの仕掛けは 「遊び方」で見られます",
          );
          const recap = within(
            within(getScreen()).getByRole("list", { name: "覚えたルール" }),
          )
            .getAllByRole("listitem")
            .map((item) => item.textContent);

          expect(headline).toBeTruthy();
          expect(detail).toBeTruthy();
          expect(recap).toEqual(iceFloorMazeTutorialRecap);
          expect(getProgressValue()).toBe("100");
        });

        test("ゲームのホームで開いているレベルを遊ぶ操作で、そのレベルを始めること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル 3を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", () => {
          fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
          advanceTime(0);

          const position = getPiecePosition();
          const cued = getCuedCell();
          const startButton = queryStartButton();

          expect(position).toBe(start);
          expect(cued).toBe(steps[0].target);
          expect(startButton).toBeNull();
          expect(getProgressValue()).toBe("0");
        });
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(
        <IceFloorMazeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("入口で、何をするパズルかとゴールの盤面を、ゴールの一言とはじめるの操作と一緒に見せること", () => {
      const purpose = screen.getByText(
        iceFloorMazeTutorial.intro.purpose.replaceAll("\n", " "),
      );
      const caption = screen.getByText("ゴールで止めると完成です");
      const position = getPiecePosition();
      const startButton = queryStartButton();

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(position).toBe(goal);
      expect(startButton).not.toBeNull();
      expect(getProgressValue()).toBe("0");
    });

    test("手順を進めて、手を離した後にゴールで止められること", () => {
      pressStart();
      finishSteps(steps.length);
      slide(remainingDirections);
      advanceTime(nextStepCueEnoughMs);

      const finish = screen.getByRole("button", { name: "レベル 3を遊ぶ" });

      expect(finish).toBeTruthy();
    });
  });

  describe("始めてから閉じて開き直した場合", () => {
    beforeEach(() => {
      const { rerender } = render(
        <IceFloorMazeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
      finishSteps(1);
      fireEvent.keyDown(getScreen(), { key: "Escape" });
      rerender(
        <IceFloorMazeTutorial
          open={false}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      rerender(
        <IceFloorMazeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("入口から、ゴールの盤面で始まること", () => {
      const startButton = queryStartButton();
      const position = getPiecePosition();

      expect(onClose).toHaveBeenCalledOnce();
      expect(startButton).not.toBeNull();
      expect(position).toBe(goal);
      expect(getProgressValue()).toBe("0");
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<IceFloorMazeTutorial open={true} onClose={onClose} />);
      pressStart();
      finishSteps(steps.length);
    });

    test("ゴールで止めると、ほかの仕掛けは遊び方で見られると伝え、プレイに戻る操作で閉じること", () => {
      slide(remainingDirections);
      advanceTime(nextStepCueEnoughMs);
      const detail = screen.getByText("ほかの仕掛けは 「遊び方」で見られます");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
