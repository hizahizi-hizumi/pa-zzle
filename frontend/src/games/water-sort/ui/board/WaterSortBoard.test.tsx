import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WaterSortBoard } from "./WaterSortBoard";

function createOnSelectBottle() {
  return vi.fn<(bottleIndex: number) => void>();
}

function createOnClearingPourComplete() {
  return vi.fn<() => void>();
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
});

describe("WaterSortBoard", () => {
  describe("次の操作が可能な盤面の場合", () => {
    let onSelectBottle: ReturnType<typeof createOnSelectBottle>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = createOnSelectBottle();
      ({ rerender } = render(
        <WaterSortBoard
          state={[[0], [], [1], []]}
          sourceBottleIndex={0}
          operation={null}
          onSelectBottle={onSelectBottle}
        />,
      ));
    });

    test("注水アニメーションの完了を待たずに次の操作を通知できること", () => {
      fireEvent.click(screen.getByRole("button", { name: "ボトル 2: 空" }));
      rerender(
        <WaterSortBoard
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

  describe("最終注水のアニメーション中の場合", () => {
    let onSelectBottle: ReturnType<typeof createOnSelectBottle>;

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = createOnSelectBottle();
      render(
        <WaterSortBoard
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

    test("ボトルの操作領域を残して実盤面の見た目だけ隠すこと", () => {
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

  describe("進行中の注水後に操作結果がリセットされる場合", () => {
    let onSelectBottle: ReturnType<typeof createOnSelectBottle>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = createOnSelectBottle();
      ({ rerender } = render(
        <WaterSortBoard
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
      ));
    });

    test("進行中の注水表示を残さないこと", () => {
      rerender(
        <WaterSortBoard
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

  describe("同じ注ぎ先へ後続注水する場合", () => {
    let animate: ReturnType<typeof vi.fn>;
    let firstPourAnimations: Array<ReturnType<typeof vi.fn>>;
    let onSelectBottle: ReturnType<typeof createOnSelectBottle>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      const pendingAnimations = installPendingAnimations();
      animate = pendingAnimations.animate;
      onSelectBottle = createOnSelectBottle();
      ({ rerender } = render(
        <WaterSortBoard
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
      ));
      firstPourAnimations = pendingAnimations.cancelAnimations.slice();
    });

    test("先行注水を終了しないこと", () => {
      rerender(
        <WaterSortBoard
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

      expect(animate).toHaveBeenCalledTimes(8);
      expect(firstPourAnimations).toHaveLength(4);
      for (const cancelAnimation of firstPourAnimations) {
        expect(cancelAnimation).not.toHaveBeenCalled();
      }
    });
  });

  describe("注水中に最新の操作結果が不正操作へ変わる場合", () => {
    let onSelectBottle: ReturnType<typeof createOnSelectBottle>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      installPendingAnimations();
      onSelectBottle = createOnSelectBottle();
      ({ rerender } = render(
        <WaterSortBoard
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
      ));
    });

    test("進行中の注水表示を維持すること", () => {
      rerender(
        <WaterSortBoard
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

  describe("動きを減らす設定で最終注水する場合", () => {
    let animate: ReturnType<typeof vi.fn>;
    let onClearingPourComplete: ReturnType<typeof createOnClearingPourComplete>;

    beforeEach(() => {
      animate = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      onClearingPourComplete = createOnClearingPourComplete();
      render(
        <WaterSortBoard
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
          onClearingPourComplete={onClearingPourComplete}
        />,
      );
    });

    test("最終注水を待たずに完了通知すること", () => {
      expect(animate).not.toHaveBeenCalled();
      expect(onClearingPourComplete).toHaveBeenCalledOnce();
    });
  });

  describe("注水対象のDOMを取得できない場合", () => {
    let onClearingPourComplete: ReturnType<typeof createOnClearingPourComplete>;

    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: vi.fn(),
      });
      onClearingPourComplete = createOnClearingPourComplete();
      render(
        <WaterSortBoard
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
          onClearingPourComplete={onClearingPourComplete}
        />,
      );
    });

    test("最終注水の進行を停止しないこと", () => {
      expect(onClearingPourComplete).toHaveBeenCalledOnce();
    });
  });
});
