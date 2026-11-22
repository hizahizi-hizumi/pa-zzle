import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { CLEAR_FINALE_REDUCED_MOTION_HOLD_MS } from "@/games/water-sort/ui/board/clear-finale-timing";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";

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

      // 注ぎ元・液の筋・注ぎ元から減る液の3つを、注ぎ先へ増える液より先に動かす。
      const firstSourceAnimations = firstPourAnimations.slice(0, 3);

      expect(animations.animate).toHaveBeenCalledTimes(8);
      expect(firstPourAnimations).toHaveLength(4);
      for (const cancelAnimation of firstSourceAnimations) {
        expect(cancelAnimation).not.toHaveBeenCalled();
      }
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
});
