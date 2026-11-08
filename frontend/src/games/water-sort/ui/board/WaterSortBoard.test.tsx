import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
});

describe("WaterSortBoard", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  test("ドラッグしたボトルを別のボトルへ離すと移動元と移動先を通知すること", () => {
    const onSelectBottle = vi.fn();
    const onPourBottle = vi.fn();
    render(
      <WaterSortBoard
        interactionDisabled={false}
        state={[[0], [], [1], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={onSelectBottle}
        onPourBottle={onPourBottle}
      />,
    );
    const source = screen.getByRole("button", { name: "ボトル 1: 赤" });
    const destination = screen.getByRole("button", { name: "ボトル 2: 空" });
    vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
      left: 80,
      right: 130,
      top: 40,
      bottom: 220,
      x: 80,
      y: 40,
      width: 50,
      height: 180,
      toJSON: () => undefined,
    });

    fireEvent.pointerDown(source, {
      pointerId: 4,
      button: 0,
      clientX: 20,
      clientY: 60,
    });
    fireEvent.pointerMove(source, { pointerId: 4, clientX: 110, clientY: 120 });
    expect(destination.dataset.waterSortDropTarget).toBe("true");
    fireEvent.pointerUp(source, { pointerId: 4, clientX: 110, clientY: 120 });
    expect(destination.dataset.waterSortDropTarget).toBeUndefined();
    fireEvent.click(source);

    expect(onPourBottle).toHaveBeenCalledExactlyOnceWith(0, 1, {
      offsetX: 90,
      offsetY: 48,
      tiltDegrees: 5,
    });
    expect(onSelectBottle).not.toHaveBeenCalled();
  });

  test("ドラッグ中は注水できない容器を候補として強調しないこと", () => {
    const onPourBottle = vi.fn();
    render(
      <WaterSortBoard
        appearance="glass"
        interactionDisabled={false}
        state={[[0], [1], [], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={vi.fn()}
        onPourBottle={onPourBottle}
      />,
    );
    const source = screen.getByRole("button", { name: "ボトル 1: 赤" });
    const incompatible = screen.getByRole("button", { name: "ボトル 2: 青" });
    vi.spyOn(incompatible, "getBoundingClientRect").mockReturnValue({
      left: 80,
      right: 130,
      top: 40,
      bottom: 220,
      x: 80,
      y: 40,
      width: 50,
      height: 180,
      toJSON: () => undefined,
    });
    fireEvent.pointerDown(source, {
      pointerId: 5,
      button: 0,
      clientX: 20,
      clientY: 60,
    });
    fireEvent.pointerMove(source, { pointerId: 5, clientX: 110, clientY: 120 });
    expect(incompatible.dataset.waterSortDropTarget).toBeUndefined();
    fireEvent.pointerUp(source, { pointerId: 5, clientX: 110, clientY: 120 });
    expect(onPourBottle).toHaveBeenCalledExactlyOnceWith(0, 1, {
      offsetX: 90,
      offsetY: 48,
      tiltDegrees: 5,
    });
  });

  test("ドラッグ先に移せる色の量を半透明で予告し、指を離すと予告を消すこと", () => {
    render(
      <WaterSortBoard
        appearance="glass"
        interactionDisabled={false}
        state={[[0, 0], [], [1], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={vi.fn()}
        onPourBottle={vi.fn()}
      />,
    );
    const source = screen.getByRole("button", { name: "ボトル 1: 赤、赤" });
    const destination = screen.getByRole("button", { name: "ボトル 2: 空" });
    vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
      left: 80,
      right: 130,
      top: 40,
      bottom: 220,
      x: 80,
      y: 40,
      width: 50,
      height: 180,
      toJSON: () => undefined,
    });

    fireEvent.pointerDown(source, {
      pointerId: 8,
      button: 0,
      clientX: 20,
      clientY: 60,
    });
    fireEvent.pointerMove(source, { pointerId: 8, clientX: 110, clientY: 120 });

    expect(destination.dataset.waterSortDropTarget).toBe("true");
    expect(destination.dataset.waterSortPreviewCount).toBe("2");

    fireEvent.pointerUp(source, { pointerId: 8, clientX: 110, clientY: 120 });

    expect(destination.dataset.waterSortDropTarget).toBeUndefined();
    expect(destination.dataset.waterSortPreviewCount).toBeUndefined();
  });

  test("完成済みボトルはドラッグしても注水の予告や操作を開始しないこと", () => {
    const onPourBottle = vi.fn();
    render(
      <WaterSortBoard
        appearance="glass"
        interactionDisabled={false}
        state={[[0, 0, 0, 0], [], [1], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={vi.fn()}
        onPourBottle={onPourBottle}
      />,
    );
    const source = screen.getByRole("button", {
      name: "ボトル 1: 赤、赤、赤、赤",
    });
    const destination = screen.getByRole("button", { name: "ボトル 2: 空" });
    vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
      left: 80,
      right: 130,
      top: 40,
      bottom: 220,
      x: 80,
      y: 40,
      width: 50,
      height: 180,
      toJSON: () => undefined,
    });

    fireEvent.pointerDown(source, {
      pointerId: 9,
      button: 0,
      clientX: 20,
      clientY: 60,
    });
    fireEvent.pointerMove(source, { pointerId: 9, clientX: 110, clientY: 120 });
    fireEvent.pointerUp(source, { pointerId: 9, clientX: 110, clientY: 120 });

    expect(destination.dataset.waterSortDropTarget).toBeUndefined();
    expect(destination.dataset.waterSortPreviewCount).toBeUndefined();
    expect(onPourBottle).not.toHaveBeenCalled();
  });

  test("注水先の判定領域が重なるときは指に近い容器を選ぶこと", () => {
    const onPourBottle = vi.fn();
    render(
      <WaterSortBoard
        appearance="glass"
        interactionDisabled={false}
        state={[[0], [], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={vi.fn()}
        onPourBottle={onPourBottle}
      />,
    );
    const source = screen.getByRole("button", { name: "ボトル 1: 赤" });
    const first = screen.getByRole("button", { name: "ボトル 2: 空" });
    const second = screen.getByRole("button", { name: "ボトル 3: 空" });
    for (const [bottle, left] of [
      [first, 80],
      [second, 100],
    ] as const) {
      vi.spyOn(bottle, "getBoundingClientRect").mockReturnValue({
        left,
        right: left + 20,
        top: 40,
        bottom: 220,
        x: left,
        y: 40,
        width: 20,
        height: 180,
        toJSON: () => undefined,
      });
    }
    fireEvent.pointerDown(source, {
      pointerId: 6,
      button: 0,
      clientX: 20,
      clientY: 60,
    });
    fireEvent.pointerMove(source, { pointerId: 6, clientX: 107, clientY: 120 });
    expect(first.dataset.waterSortDropTarget).toBeUndefined();
    expect(second.dataset.waterSortDropTarget).toBe("true");
    fireEvent.pointerUp(source, { pointerId: 6, clientX: 107, clientY: 120 });
    expect(onPourBottle).toHaveBeenCalledWith(0, 2, expect.any(Object));
  });

  test("注水アニメーションの完了を待たずに次の操作を通知できること", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
      <WaterSortBoard
        interactionDisabled={false}
        state={[[0], [], [1], []]}
        sourceBottleIndex={0}
        operation={null}
        onSelectBottle={onSelectBottle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ボトル 2: 空" }));
    rerender(
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

  test("注水中もボトルの操作領域を残して実盤面の見た目だけ隠すこと", () => {
    installPendingAnimations();
    const onSelectBottle = vi.fn();
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

    rerender(
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

  test("同じ注ぎ先への後続注水を開始しても先行注水を終了しないこと", () => {
    const { animate, cancelAnimations } = installPendingAnimations();
    const onSelectBottle = vi.fn();
    const { rerender } = render(
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
    const firstPourAnimations = cancelAnimations.slice();

    rerender(
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

    rerender(
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
    const onClearAnimationComplete = vi.fn();

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

    expect(animate).not.toHaveBeenCalled();
    expect(onClearAnimationComplete).toHaveBeenCalledOnce();
  });

  test("注水対象のDOMを取得できなくても最終注水の進行を停止しないこと", () => {
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(),
    });
    const onClearAnimationComplete = vi.fn();

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

    expect(onClearAnimationComplete).toHaveBeenCalledOnce();
  });
});
