import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";
import { playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
}));

function cellAt(x: number, y: number): number {
  return y * 6 + x;
}

/** 手順ごとの、印のマスへ止まる向きと印のマス。 */
const steps = [
  { direction: "right", target: cellAt(1, 0) },
  { direction: "down", target: cellAt(1, 1) },
  { direction: "down", target: cellAt(1, 3) },
  { direction: "right", target: cellAt(4, 3) },
  { direction: "down", target: cellAt(4, 4) },
  { direction: "up", target: cellAt(4, 2) },
  { direction: "left", target: cellAt(2, 2) },
] as const satisfies readonly {
  direction: IceFloorMazeDirection;
  target: number;
}[];

/** 手を離した後、最短でゴールに止まる向き。 */
const remainingDirections = ["down", "right", "up"] as const;

/** 次の印を付けるまでの間を十分に越える時間。 */
const nextStepCueEnoughMs = 1500;

/** 手を離した後、手が止まってから次に止まるマスを示すまでの間。 */
const idleHintDelayMs = 4000;

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

function slide(directions: readonly IceFloorMazeDirection[]): void {
  for (const direction of directions) {
    fireEvent.keyDown(window, { key: arrowKeyByDirection[direction] });
  }
}

/** 手順を順に、印のマスへ止まる向きへ滑らせ、そのたびに次の印が出るまで待つ。 */
function finishSteps(count: number): void {
  for (const step of steps.slice(0, count)) {
    slide([step.direction]);
    advanceTime(nextStepCueEnoughMs);
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

/** 盤面の上で、画面全体の覆いから抜いている所。 */
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
      pressNextThroughIntro();
    });

    test("始めの盤面で、操作と滑るルールを伝え、駒を止めるマスに印を付けること", () => {
      const headline = screen.getByText("駒は岩か壁にぶつかるまで 滑ります");
      const detail = screen.getByText("右へスワイプしてください");
      const position = getPiecePosition();
      const cued = getCuedCell();

      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(position).toBe(cellAt(0, 0));
      expect(cued).toBe(steps[0].target);
    });

    test("駒のいるマス・印のマス・止める岩を、画面全体の覆いから抜くこと", () => {
      const spotlights = getBoardSpotlights();

      expect(spotlights.length).toBeGreaterThan(0);
    });

    test("1マスも動けない向きへ滑らせようとすると、駒を動かさず音も鳴らさずに、印の線を濃くし直すこと", () => {
      slide(["up"]);

      const position = getPiecePosition();
      const recalled = document.querySelector('[data-tutorial-cue="recall"]');

      expect(position).toBe(cellAt(0, 0));
      expect(recalled).not.toBeNull();
      expect(playSound).not.toHaveBeenCalled();
    });

    test("滑らせてから次の一言と印に替えるまでは、次の手順の手を受け付けないこと", () => {
      slide(["right", "down"]);

      const position = getPiecePosition();

      expect(position).toBe(steps[0].target);
    });

    describe("滑れる向きがほかにもある手順に進んだ場合", () => {
      beforeEach(() => {
        finishSteps(1);
        vi.mocked(playSound).mockClear();
      });

      test("印のマスで止まらない向きへ滑らせようとすると、駒を動かさず音も鳴らさずに、印の線を濃くし直すこと", () => {
        slide(["left"]);

        const position = getPiecePosition();
        const recalled = document.querySelector('[data-tutorial-cue="recall"]');

        expect(position).toBe(steps[0].target);
        expect(recalled).not.toBeNull();
        expect(playSound).not.toHaveBeenCalled();
      });
    });

    test("印のマスへ止まる向きへ滑らせると、駒が止まり、滑り終えて見届けるまで今の一言を残してから、次の一言と印に替えること", () => {
      slide(["right"]);
      const position = getPiecePosition();
      const cuedBeforeDelay = getCuedCell();
      const headlineBeforeDelay = screen.queryByText(
        "駒は岩か壁にぶつかるまで 滑ります",
      );
      advanceTime(nextStepCueEnoughMs);

      const cued = getCuedCell();
      const headline = screen.queryByText("駒は床に入ると止まります");

      expect(position).toBe(steps[0].target);
      expect(cuedBeforeDelay).toBeNull();
      expect(headlineBeforeDelay).not.toBeNull();
      expect(cued).toBe(steps[1].target);
      expect(headline).not.toBeNull();
    });

    test("印のマスへ止まる向きへ滑らせると、本番と同じ滑る音を鳴らすこと", () => {
      slide(["right"]);

      const sounds = getPlayedSoundNames();

      expect(sounds).toEqual(["slid.flac", "stopped.flac"]);
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
        clientX: 160,
        clientY: 100,
      });

      const position = getPiecePosition();

      expect(position).toBe(steps[0].target);
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        finishSteps(steps.length);
      });

      test("ゴールで止めることを伝え、手が止まったときだけ、一言は替えずに次に止まるマスへ印を付けること", () => {
        const cuedBeforeIdle = getCuedCell();
        advanceTime(idleHintDelayMs);

        const cued = getCuedCell();
        const headline = screen.getByText(
          "ここからは自分で 駒をゴールで止めてみましょう",
        );

        expect(cuedBeforeIdle).toBeNull();
        expect(cued).toBe(cellAt(2, 5));
        expect(headline).toBeTruthy();
      });

      test("画面全体の覆いから抜くマスを置かないこと", () => {
        advanceTime(idleHintDelayMs);

        const spotlights = getBoardSpotlights();

        expect(spotlights.length).toBe(0);
      });

      test("1マスも動けない向きへ滑らせると、駒を動かさず、本番と同じ動けなかった音を鳴らすこと", () => {
        slide(["down"]);
        vi.mocked(playSound).mockClear();
        slide(["down"]);

        const position = getPiecePosition();
        const sounds = getPlayedSoundNames();

        expect(position).toBe(cellAt(2, 5));
        expect(sounds).toEqual(["blocked.flac"]);
      });

      test("ゴールで止めると、完成を伝え、ゲームのホームで開いているレベルを遊ぶ操作でそのレベルを始めること", () => {
        slide(remainingDirections);
        advanceTime(nextStepCueEnoughMs);
        const headline = screen.getByText("完成です");
        const detail = screen.getByText("どのレベルも同じルールです");
        fireEvent.click(screen.getByRole("button", { name: "レベル 3を遊ぶ" }));

        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(playStart.onStart).toHaveBeenCalledOnce();
      });

      test("ゴールで止めた後のもう一度で、最初の手順から始めること", () => {
        slide(remainingDirections);
        advanceTime(nextStepCueEnoughMs);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        pressNextThroughIntro();

        const position = getPiecePosition();
        const cued = getCuedCell();

        expect(position).toBe(cellAt(0, 0));
        expect(cued).toBe(steps[0].target);
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

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const caption = screen.getByText("駒がゴールの印で止まれば完成です");
      const position = getPiecePosition();

      expect(caption).toBeTruthy();
      expect(position).toBe(cellAt(3, 2));
    });

    test("手順を進めて、手を離した後にゴールで止められること", () => {
      pressNextThroughIntro();
      finishSteps(steps.length);
      slide(remainingDirections);
      advanceTime(nextStepCueEnoughMs);

      const finish = screen.getByRole("button", { name: "レベル 3を遊ぶ" });

      expect(finish).toBeTruthy();
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<IceFloorMazeTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
      finishSteps(steps.length);
    });

    test("ゴールで止めると、プレイ中の盤面も同じルールだと伝え、プレイに戻る操作で閉じること", () => {
      slide(remainingDirections);
      advanceTime(nextStepCueEnoughMs);
      const detail = screen.getByText("プレイ中の盤面も同じルールです");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
