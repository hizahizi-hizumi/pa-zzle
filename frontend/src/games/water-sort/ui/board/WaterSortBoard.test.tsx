import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WaterSortBoard } from "./WaterSortBoard";

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
  test("注水アニメーションの完了を待たずに次の操作を通知できること", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
      <WaterSortBoard
        state={[[0], [], [1], []]}
        sourceBottleIndex={0}
        operation={null}
        onSelectBottle={onSelectBottle}
      />,
    );

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

  test("注水中もボトルの操作領域を残して実盤面の見た目だけ隠すこと", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
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

  test("操作結果がリセットされたら進行中の注水表示を残さないこと", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
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
    );

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

  test("同じ注ぎ先への後続注水を開始しても先行注水を終了しないこと", () => {
    const { animate, cancelAnimations } = installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
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
    );
    const firstPourAnimations = cancelAnimations.slice();

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

  test("最新の操作結果が不正操作へ変わっても進行中の注水表示を維持すること", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
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
    );

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

  test("動きを減らす設定では最終注水を待たずに完了通知すること", () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
    const onClearingPourComplete = vi.fn();

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

    expect(animate).not.toHaveBeenCalled();
    expect(onClearingPourComplete).toHaveBeenCalledOnce();
  });

  test("注水対象のDOMを取得できなくても最終注水の進行を停止しないこと", () => {
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(),
    });
    const onClearingPourComplete = vi.fn();

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

    expect(onClearingPourComplete).toHaveBeenCalledOnce();
  });
});
