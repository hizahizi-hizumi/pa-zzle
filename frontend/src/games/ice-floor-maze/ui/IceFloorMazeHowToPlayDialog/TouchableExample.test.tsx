import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  createIceFloorMazeBlockedInput,
  createIceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { slideIceFloorMazePiece } from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import {
  brittleRockRuleExamples,
  floorRuleExample,
  goalRuleExamples,
  type IceFloorMazeHowToPlayExample,
  slideOperationExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/TouchableExample";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
import { playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
}));

// 本番の効果音のフックをそのまま動かし、渡された直前の滑りと動けなかった入力を本番の組み立てと照らす。
vi.mock(
  "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects")
      >();
    return {
      ...actual,
      useIceFloorMazeSoundEffects: vi.fn(actual.useIceFloorMazeSoundEffects),
    };
  },
);

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(useIceFloorMazeSoundEffects).mockClear();
});

/** 効果音のフックへ最後に渡した、直前の滑り・動けなかった入力・ゴール・進み。 */
function getLastSoundInputs() {
  return vi.mocked(useIceFloorMazeSoundEffects).mock.calls.at(-1);
}

function renderExample(example: IceFloorMazeHowToPlayExample) {
  render(
    <HowToPlayExamplePanel resettable>
      <TouchableExample example={example} />
    </HowToPlayExamplePanel>,
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤面" });
}

function getPieceCell(): string | null {
  return (
    getBoard()
      .querySelector("[data-piece-cell]")
      ?.getAttribute("data-piece-cell") ?? null
  );
}

function getHint(): string | null {
  return (
    getBoard()
      .querySelector("[data-swipe-hint]")
      ?.getAttribute("data-swipe-hint") ?? null
  );
}

function getCaption(): string | null {
  return (
    screen
      .getByRole("figure")
      .querySelector('[data-how-to-play-caption-layer][aria-hidden="false"]')
      ?.textContent ?? null
  );
}

/** 本番と同じく、盤面の上で指を動かしてスワイプする。 */
function swipe(dx: number, dy: number) {
  const area = getBoard().firstElementChild as HTMLElement;
  fireEvent.pointerDown(area, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(area, {
    pointerId: 1,
    clientX: 100 + dx,
    clientY: 100 + dy,
  });
  fireEvent.pointerUp(area, { pointerId: 1 });
}

/** 指かマウスで、`start` の上から押してスワイプする。動きと離すのは、本番と同じくスワイプを受ける領域が受ける。 */
function swipeFrom(
  start: Element,
  pointerType: "touch" | "mouse",
  dx: number,
  dy: number,
) {
  const area = getBoard().firstElementChild as HTMLElement;
  fireEvent.pointerDown(start, {
    pointerId: 2,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(area, {
    pointerId: 2,
    pointerType,
    clientX: 100 + dx,
    clientY: 100 + dy,
  });
  fireEvent.pointerUp(area, { pointerId: 2, pointerType });
}

function getSwipeStartTarget(): Element {
  const target = getBoard().querySelector("[data-swipe-start-target]");
  if (target === null) {
    throw new Error("Example board must have a swipe start target");
  }
  return target;
}

function getBoardImage(): Element {
  return within(getBoard()).getByRole("img", { name: "盤面" });
}

describe("TouchableExample", () => {
  describe("床のルールの例", () => {
    const floorSlide = slideIceFloorMazePiece(
      floorRuleExample.board,
      createIceFloorMazeInitialState(
        floorRuleExample.board,
        floorRuleExample.start,
      ),
      "right",
    );
    if (floorSlide.status !== "slid") {
      throw new Error("Floor example must slide to the right");
    }

    beforeEach(() => {
      renderExample(floorRuleExample);
    });

    test("触る前は、手がかりを右に付け、その手で起きることを言うこと", () => {
      const state = [getPieceCell(), getHint(), getCaption()];

      expect(state).toEqual(["5", "right", "床で止まる"]);
    });

    test("手がかりは、駒のマスを共通の手がかりで囲み、指を駒にかけないよう矢印と反対の左下の角の外に置くこと", () => {
      const pointer = getBoard().querySelector(
        "[data-swipe-hint] [data-how-to-play-press-hint-pointer]",
      ) as SVGElement | null;

      const placement = [
        pointer?.getAttribute("data-how-to-play-press-hint-pointer"),
        pointer?.style.bottom !== "",
        pointer?.style.left !== "",
      ];

      expect(placement).toEqual(["outside-corner", true, true]);
    });

    test("右へスワイプすると、本番と同じく床で止まり、本番の組み立てと同じ直前の滑りを本番の効果音のフックへ渡して音を鳴らし、次の手がかりへ移すこと", () => {
      swipe(40, 0);

      expect([getPieceCell(), getHint(), getCaption()]).toEqual([
        "7",
        "right",
        "床で止まる",
      ]);
      expect(getLastSoundInputs()).toEqual([
        createIceFloorMazeLastSlide({
          id: 1,
          board: floorRuleExample.board,
          goal: null,
          slide: floorSlide,
          isClearingMove: false,
          entersTrap: false,
        }),
        null,
        null,
        "playing",
      ]);
      expect(playSound).toHaveBeenCalled();
    });

    test("指のスワイプを始められてスクロールを止める所を、駒のマスの上の1か所だけにし、盤面のほかの所ではスクロールを止めないこと", () => {
      const targets = getBoard().querySelectorAll("[data-swipe-start-target]");
      const area = getBoard().firstElementChild;

      const stopsScroll = [
        targets[0]?.classList.contains("touch-none"),
        area?.classList.contains("touch-none"),
      ];

      expect(targets).toHaveLength(1);
      expect(stopsScroll).toEqual([true, false]);
    });

    test("駒のマスの外から指でスワイプしても滑らせず、駒のマスから指でスワイプすると滑らせること", () => {
      swipeFrom(getBoardImage(), "touch", 40, 0);
      const afterOutside = getPieceCell();

      swipeFrom(getSwipeStartTarget(), "touch", 40, 0);

      expect([afterOutside, getPieceCell()]).toEqual(["5", "7"]);
    });

    test("マウスでは、本番と同じく盤面のどこからでもスワイプで滑らせること", () => {
      swipeFrom(getBoardImage(), "mouse", 40, 0);

      expect(getPieceCell()).toBe("7");
    });

    test("Tab で選んだ盤面は、矢印キーでも本番と同じに滑らせること", () => {
      fireEvent.keyDown(getBoard(), { key: "ArrowRight" });
      fireEvent.keyDown(getBoard(), { key: "ArrowRight" });

      expect([getPieceCell(), getHint(), getCaption()]).toEqual([
        "9",
        null,
        "壁の手前で止まる",
      ]);
    });

    test("最初の姿と違う間だけ元に戻すボタンを出し、押すと最初の姿に戻すこと", () => {
      const button = screen.getByRole("button", {
        name: "例を元に戻す",
        hidden: true,
      });
      const disabledBefore = (button as HTMLButtonElement).disabled;
      swipe(40, 0);
      const disabledAfter = (
        screen.getByRole("button", {
          name: "例を元に戻す",
        }) as HTMLButtonElement
      ).disabled;

      fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

      expect([disabledBefore, disabledAfter]).toEqual([true, false]);
      expect([getPieceCell(), getHint()]).toEqual(["5", "right"]);
    });
  });

  describe("すぐ隣のもろい岩へ向ける例", () => {
    const example = brittleRockRuleExamples[1];
    const blockedSlide = slideIceFloorMazePiece(
      example.board,
      createIceFloorMazeInitialState(example.board, example.start),
      "right",
    );
    if (blockedSlide.status !== "blocked") {
      throw new Error("Brittle rock example must be blocked to the right");
    }

    beforeEach(() => {
      renderExample(example);
    });

    test("動けない手の手がかりは、すぐ隣のもろい岩に重ねる矢印の線を引かず、駒の枠の内側に矢じりだけを置くこと", () => {
      const hint = getBoard().querySelector("[data-swipe-hint]");

      const parts = [
        hint?.hasAttribute("data-swipe-hint-blocked"),
        hint?.querySelector("[data-hint-arrow]") !== null,
        hint?.querySelector("[data-hint-arrowhead]") !== null,
      ];

      expect(parts).toEqual([true, false, true]);
    });

    test("動けない手では盤面を変えず、本番の組み立てと同じ動けなかった入力を本番の効果音のフックへ渡して動けない音を鳴らし、手がかりを消すこと", () => {
      swipe(40, 0);

      expect([getPieceCell(), getHint(), getCaption()]).toEqual([
        "5",
        null,
        "崩せない",
      ]);
      expect(getLastSoundInputs()).toEqual([
        null,
        createIceFloorMazeBlockedInput(example.board, blockedSlide, 1),
        null,
        "playing",
      ]);
      expect(playSound).toHaveBeenCalledTimes(1);
    });
  });

  describe("ゴールのルールの、ゴールで止まる例", () => {
    beforeEach(() => {
      renderExample(goalRuleExamples[0]);
    });

    test("ゴールで止まると完成と言い、本番の完成の音へ進み、本番と同じくそれからは受け付けないこと", () => {
      swipe(40, 0);
      swipe(-40, 0);

      expect([getPieceCell(), getHint(), getCaption()]).toEqual([
        "6",
        null,
        "完成",
      ]);
      // 動けない環境では完成演出がすぐ終わるので、完成の音を鳴らす進み（clearing）を通ったことを確かめる。
      expect(
        vi
          .mocked(useIceFloorMazeSoundEffects)
          .mock.calls.map(([, , , progress]) => progress),
      ).toContain("clearing");
    });
  });

  describe("操作の例", () => {
    beforeEach(() => {
      renderExample(slideOperationExample);
    });

    test("言葉を添えずに、手がかりを右、下の順に移すこと", () => {
      const before = getHint();
      swipe(40, 0);
      const afterRight = getHint();

      swipe(0, 40);

      expect([before, afterRight, getHint()]).toEqual(["right", "down", null]);
      expect(
        within(screen.getByRole("figure")).queryByText(/止まる/),
      ).toBeNull();
    });
  });
});
