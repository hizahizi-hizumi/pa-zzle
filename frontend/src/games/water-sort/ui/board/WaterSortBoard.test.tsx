import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { CLEAR_FINALE_REDUCED_MOTION_HOLD_MS } from "@/games/water-sort/ui/board/clear-finale-timing";
import { WATER_SORT_REJECTION_DURATION_MS } from "@/games/water-sort/ui/board/rejection-timing";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";

type AnimateCall = {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions | undefined;
};

/** `animate` を呼んだ要素と、渡した動きを記録する。 */
function recordAnimations() {
  const calls: AnimateCall[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function animate(
      this: Element,
      keyframes: Keyframe[],
      options?: KeyframeAnimationOptions,
    ) {
      calls.push({ target: this, keyframes, options });
      return {
        finished: new Promise<void>(() => undefined),
        cancel: vi.fn(),
      } as unknown as Animation;
    },
  });
  return calls;
}

function getBottle(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** 動かした要素が、そのボトルか、そのボトルの中の試験管か。 */
function isInside(target: Element, bottle: HTMLElement): boolean {
  return bottle.contains(target);
}

function installPendingAnimations() {
  const cancelAnimations: Array<ReturnType<typeof vi.fn>> = [];
  const finished = new Promise<void>(() => undefined);
  const animate = vi.fn(() => {
    const cancel = vi.fn();
    cancelAnimations.push(cancel);
    return { finished, cancel } as unknown as Animation;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });

  return { animate, cancelAnimations };
}

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WaterSortBoard", () => {
  describe("注水が終わる前に次のボトルを選ぶ場合", () => {
    let onSelectBottle: (bottleIndex: number) => void;
    let board: ReturnType<typeof render>;

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = vi.fn();
      board = render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0], [], [1], []]}
          sourceBottleIndex={0}
          operation={null}
          onSelectBottle={onSelectBottle}
        />,
      );
    });

    test("注水アニメーションの完了を待たずに次の操作を通知できること", () => {
      fireEvent.click(screen.getByRole("button", { name: "ボトル 2: 空" }));
      board.rerender(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0], [1], []]}
          sourceBottleIndex={2}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], [], [1], []],
            stateAfter: [[], [0], [1], []],
            isClearingMove: false,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "ボトル 4: 空" }));

      expect(onSelectBottle).toHaveBeenNthCalledWith(1, 1);
      expect(onSelectBottle).toHaveBeenNthCalledWith(2, 3);
    });
  });

  describe("注水アニメーションを再生している場合", () => {
    let onSelectBottle: (bottleIndex: number) => void;

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = vi.fn();
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0, 0, 0, 0]]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], [0, 0, 0]],
            stateAfter: [[], [0, 0, 0, 0]],
            isClearingMove: true,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );
    });

    test("注水中もボトルの操作領域を残して実盤面の見た目だけ隠すこと", () => {
      const sourceBottle = screen.getByRole("button", { name: "ボトル 1: 空" });
      const destinationBottle = screen.getByRole("button", {
        name: "ボトル 2: 赤、赤、赤、赤",
      });
      expect(sourceBottle.style.visibility).toBe("");
      expect(destinationBottle.style.visibility).toBe("");
      expect(
        sourceBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(true);
      expect(
        destinationBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(true);

      fireEvent.click(destinationBottle);

      expect(onSelectBottle).toHaveBeenCalledWith(1);
    });
  });

  describe("注水操作の結果がリセットされた場合", () => {
    let onSelectBottle: (bottleIndex: number) => void;
    let board: ReturnType<typeof render>;

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = vi.fn();
      board = render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0]]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], []],
            stateAfter: [[], [0]],
            isClearingMove: false,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );
    });

    test("操作結果がリセットされたら進行中の注水表示を残さないこと", () => {
      board.rerender(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0], []]}
          sourceBottleIndex={null}
          operation={null}
          onSelectBottle={onSelectBottle}
        />,
      );
      const sourceBottle = screen.getByRole("button", { name: "ボトル 1: 赤" });
      const destinationBottle = screen.getByRole("button", {
        name: "ボトル 2: 空",
      });

      expect(
        sourceBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(false);
      expect(
        destinationBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(false);
    });
  });

  describe("同じ注ぎ先へ続けて注水する場合", () => {
    let onSelectBottle: (bottleIndex: number) => void;
    let board: ReturnType<typeof render>;
    let animations: ReturnType<typeof installPendingAnimations>;
    let firstPourAnimations: Array<ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      animations = installPendingAnimations();
      onSelectBottle = vi.fn();
      board = render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0], [0], []]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 2,
            stateBefore: [[0], [0], [], []],
            stateAfter: [[], [0], [0], []],
            isClearingMove: false,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );
      firstPourAnimations = animations.cancelAnimations.slice();
    });

    test("同じ注ぎ先への後続注水を開始しても先行注水の注ぎ元を止めないこと", () => {
      board.rerender(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [], [0, 0], []]}
          sourceBottleIndex={null}
          operation={{
            id: 2,
            type: "poured",
            sourceBottleIndex: 1,
            destinationBottleIndex: 2,
            stateBefore: [[], [0], [0], []],
            stateAfter: [[], [], [0, 0], []],
            isClearingMove: false,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );

      // 注ぐ動きは注ぎ元の試験管を動かす1つで、液と流れはその進み具合から描く。
      expect(animations.animate).toHaveBeenCalledTimes(2);
      expect(firstPourAnimations).toHaveLength(1);
      expect(firstPourAnimations[0]).not.toHaveBeenCalled();
    });
  });

  describe("注水後に不正な操作が発生した場合", () => {
    let onSelectBottle: (bottleIndex: number) => void;
    let board: ReturnType<typeof render>;

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = vi.fn();
      board = render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0], []]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], [], []],
            stateAfter: [[], [0], []],
            isClearingMove: false,
          }}
          onSelectBottle={onSelectBottle}
        />,
      );
    });

    test("最新の操作結果が不正操作へ変わっても進行中の注水表示を維持すること", () => {
      board.rerender(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0], []]}
          sourceBottleIndex={null}
          operation={{ id: 2, type: "invalid", bottleIndex: 2 }}
          onSelectBottle={onSelectBottle}
        />,
      );

      const sourceBottle = screen.getByRole("button", { name: "ボトル 1: 空" });
      const destinationBottle = screen.getByRole("button", {
        name: "ボトル 2: 赤",
      });
      expect(
        sourceBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(true);
      expect(
        destinationBottle.firstElementChild?.classList.contains("invisible"),
      ).toBe(true);
    });
  });

  describe("動きを減らす設定の場合", () => {
    let onClearAnimationComplete: () => void;
    let animate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      animate = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      onClearAnimationComplete = vi.fn();

      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[], [0, 0, 0, 0]]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], [0, 0, 0]],
            stateAfter: [[], [0, 0, 0, 0]],
            isClearingMove: true,
          }}
          onSelectBottle={vi.fn()}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
    });

    test("注ぐ動きを見せず、片付いた姿を見せてから完了を知らせること", () => {
      const notifiedBeforeHold = vi.mocked(onClearAnimationComplete).mock.calls
        .length;
      act(() => {
        vi.advanceTimersByTime(CLEAR_FINALE_REDUCED_MOTION_HOLD_MS);
      });

      expect(notifiedBeforeHold).toBe(0);
      expect(onClearAnimationComplete).toHaveBeenCalledOnce();
      // 空の試験管を動かさずに消すだけで、注ぐ動きと片付ける動きを再生しない。
      expect(animate.mock.calls.map(([keyframes]) => keyframes)).toEqual([
        [{ opacity: 0 }],
      ]);
    });
  });

  describe("注水対象のDOMを取得できない場合", () => {
    let onClearAnimationComplete: () => void;

    beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: vi.fn(),
      });
      onClearAnimationComplete = vi.fn();

      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[]]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], []],
            stateAfter: [[], [0]],
            isClearingMove: true,
          }}
          onSelectBottle={vi.fn()}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
    });

    test("注水対象のDOMを取得できなくても最終注水の進行を停止しないこと", () => {
      act(() => {
        vi.advanceTimersByTime(CLEAR_FINALE_REDUCED_MOTION_HOLD_MS);
      });

      expect(onClearAnimationComplete).toHaveBeenCalledOnce();
    });
  });

  describe("1色でそろった試験管がある場合", () => {
    beforeEach(() => {
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[
            [0, 0, 0, 0],
            [1, 1, 1],
            [1, 0],
          ]}
          sourceBottleIndex={null}
          operation={null}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("そろった試験管にだけ栓をして描くこと", () => {
      const stopperedBottles = screen
        .getAllByRole("button", { name: /^ボトル/ })
        .filter((bottle) => bottle.querySelector("[data-rubber-stopper]"))
        .map((bottle) => bottle.getAttribute("aria-label"));

      expect(stopperedBottles).toEqual(["ボトル 1: 赤、赤、赤、赤"]);
    });
  });

  describe("試験管を持たずに注げない試験管を押した場合", () => {
    let calls: AnimateCall[];

    beforeEach(() => {
      calls = recordAnimations();
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0, 1], []]}
          sourceBottleIndex={null}
          operation={{ id: 1, type: "invalid", bottleIndex: 1 }}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("押した試験管だけを、試験管立ての中で底を支点に揺らすこと", () => {
      const rejected = getBottle("ボトル 2: 空");
      const other = getBottle("ボトル 1: 赤、青");

      expect(calls).toHaveLength(1);
      expect(isInside(calls[0]?.target as Element, rejected)).toBe(true);
      expect(isInside(calls[0]?.target as Element, other)).toBe(false);
      expect(calls[0]?.keyframes[0]?.transformOrigin).toBe("50% 100%");
      expect(calls[0]?.options?.duration).toBe(
        WATER_SORT_REJECTION_DURATION_MS,
      );
    });
  });

  describe("試験管を持って、注げない試験管を押した場合", () => {
    let calls: AnimateCall[];

    beforeEach(() => {
      calls = recordAnimations();
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0], [1], []]}
          sourceBottleIndex={0}
          operation={{ id: 1, type: "invalid", bottleIndex: 1 }}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("押した試験管を揺らし、持っている試験管を傾けかけて引き戻すこと", () => {
      const rejected = getBottle("ボトル 2: 青");
      const held = getBottle("ボトル 1: 赤");
      const rattle = calls.find((call) => isInside(call.target, rejected));
      const withdraw = calls.find((call) => isInside(call.target, held));

      expect(calls).toHaveLength(2);
      expect(rattle?.keyframes[0]?.transformOrigin).toBe("50% 100%");
      expect(withdraw?.keyframes.map((keyframe) => keyframe.transform)).toEqual(
        [
          "translateX(0) rotate(0deg)",
          expect.stringContaining("rotate("),
          expect.stringContaining("rotate("),
          "translateX(0) rotate(0deg)",
        ],
      );
    });
  });

  describe("動きを減らす設定で、注げない試験管を押した場合", () => {
    let calls: AnimateCall[];

    beforeEach(() => {
      calls = recordAnimations();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0], [1], []]}
          sourceBottleIndex={0}
          operation={{ id: 1, type: "invalid", bottleIndex: 1 }}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("試験管を動かさず、押した試験管を一度暗くするだけにすること", () => {
      const rejected = getBottle("ボトル 2: 青");

      expect(calls).toHaveLength(1);
      expect(isInside(calls[0]?.target as Element, rejected)).toBe(true);
      expect(calls[0]?.keyframes.map((keyframe) => keyframe.transform)).toEqual(
        [undefined, undefined, undefined],
      );
      expect(calls[0]?.keyframes[1]?.filter).toBe("brightness(0.55)");
    });
  });

  describe("試験管を持っている場合", () => {
    beforeEach(() => {
      render(
        <WaterSortBoard
          interactionDisabled={false}
          state={[[0, 1], [1], []]}
          sourceBottleIndex={0}
          operation={null}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("持っている試験管にだけ試験管ばさみを描くこと", () => {
      const clampedBottles = screen
        .getAllByRole("button", { name: /^ボトル/ })
        .filter((bottle) => bottle.querySelector("[data-test-tube-clamp]"))
        .map((bottle) => bottle.getAttribute("aria-label"));

      expect(clampedBottles).toEqual(["ボトル 1: 赤、青"]);
    });
  });

  describe("そろえた後の演出の間", () => {
    const boardAreaTop = 132;

    beforeEach(() => {
      installPendingAnimations();
      // 注ぐ動きを省いて、すぐに片付ける演出へ進める。
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect",
      ).mockImplementation(function getRect(this: HTMLElement) {
        const top = this.tagName === "DIV" ? boardAreaTop : 200;
        return DOMRect.fromRect({ x: 0, y: top, width: 40, height: 110 });
      });
      render(
        <WaterSortBoard
          interactionDisabled
          state={[[], [0, 0, 0, 0]]}
          sourceBottleIndex={null}
          operation={{
            id: 1,
            type: "poured",
            sourceBottleIndex: 0,
            destinationBottleIndex: 1,
            stateBefore: [[0], [0, 0, 0]],
            stateAfter: [[], [0, 0, 0, 0]],
            isClearingMove: true,
          }}
          onSelectBottle={vi.fn()}
        />,
      );
    });

    test("触れて飛ばせる所を盤面の上端から下に限り、上の見出しとメニューを覆わないこと", () => {
      const skip = screen.queryByRole("button", { name: "演出を飛ばす" });

      expect(skip?.style.top).toBe(`${boardAreaTop}px`);
    });
  });
});
