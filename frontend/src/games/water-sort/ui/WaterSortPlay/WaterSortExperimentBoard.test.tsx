import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { WaterSortExperimentBoard } from "@/games/water-sort/ui/WaterSortPlay/WaterSortExperimentBoard";

const onSelectBottle = vi.fn();
const onPourBottle = vi.fn();
const initialState = [[0, 1], [], [2, 3], []] as const;

function renderExperiment(experience: "settle" | "touch" = "touch") {
  return render(
    <WaterSortExperimentBoard
      experience={experience}
      state={initialState}
      sourceBottleIndex={null}
      operation={null}
      onSelectBottle={onSelectBottle}
      onPourBottle={onPourBottle}
      interactionDisabled={false}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  onSelectBottle.mockClear();
  onPourBottle.mockClear();
});

describe("WaterSortExperimentBoard", () => {
  test("実際に注げる先をドラッグ開始前に教えないこと", () => {
    renderExperiment();

    const destination = screen.getByRole("button", { name: "ボトル 2: 空" });

    expect(destination.hasAttribute("data-water-sort-drop-target")).toBe(false);
  });

  test("液体のドラッグを指したボトルへの注水操作として伝えること", () => {
    renderExperiment();
    const source = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    const destination = screen.getByRole("button", { name: "ボトル 2: 空" });
    vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
      left: 100,
      right: 155,
      top: 100,
      bottom: 300,
      width: 55,
      height: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, {
      pointerId: 3,
      button: 0,
      clientX: 20,
      clientY: 120,
    });
    fireEvent.pointerMove(source, { pointerId: 3, clientX: 125, clientY: 180 });
    expect(screen.getByTestId("floating-water")).toBeTruthy();
    fireEvent.pointerUp(source, { pointerId: 3, clientX: 125, clientY: 180 });

    expect(onPourBottle).toHaveBeenCalledWith(0, 1);
    expect(screen.queryByTestId("floating-water")).toBeNull();
  });

  test("上端ではない色を触っても液体を引き出さないこと", () => {
    renderExperiment();
    const source = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 70,
      top: 100,
      bottom: 300,
      width: 70,
      height: 200,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, {
      pointerId: 16,
      button: 0,
      clientX: 20,
      clientY: 280,
    });
    fireEvent.pointerMove(source, {
      pointerId: 16,
      clientX: 125,
      clientY: 180,
    });
    fireEvent.pointerUp(source, { pointerId: 16, clientX: 125, clientY: 180 });

    expect(screen.queryByTestId("floating-water")).toBeNull();
    expect(onPourBottle).not.toHaveBeenCalled();
  });

  test("上端の液体だけをつかむと移動元に取り出し量が残ること", () => {
    renderExperiment();
    const source = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 70,
      top: 100,
      bottom: 300,
      width: 70,
      height: 200,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, {
      pointerId: 17,
      button: 0,
      clientX: 20,
      clientY: 230,
    });
    fireEvent.pointerMove(source, {
      pointerId: 17,
      clientX: 125,
      clientY: 180,
    });

    expect(screen.getByTestId("floating-water")).toBeTruthy();
    expect(source.querySelector(".water-sort-held-gap")).toBeTruthy();
  });

  test("ドラッグを中断すると液体を戻し手数を進めないこと", () => {
    renderExperiment();
    const source = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    fireEvent.pointerDown(source, {
      pointerId: 12,
      button: 0,
      clientX: 20,
      clientY: 120,
    });
    fireEvent.pointerMove(source, {
      pointerId: 12,
      clientX: 125,
      clientY: 180,
    });
    expect(screen.getByTestId("floating-water")).toBeTruthy();
    fireEvent.pointerCancel(source, { pointerId: 12 });
    expect(screen.queryByTestId("floating-water")).toBeNull();
    expect(onPourBottle).not.toHaveBeenCalled();
  });

  test("完成したボトルからは液体を取り出せないこと", () => {
    render(
      <WaterSortExperimentBoard
        experience="touch"
        state={[[0, 0, 0, 0], []]}
        sourceBottleIndex={null}
        operation={null}
        onSelectBottle={onSelectBottle}
        onPourBottle={onPourBottle}
        interactionDisabled={false}
      />,
    );
    const source = screen.getByRole("button", {
      name: "ボトル 1: 赤、赤、赤、赤（完成）",
    });

    fireEvent.pointerDown(source, {
      pointerId: 4,
      button: 0,
      clientX: 20,
      clientY: 120,
    });
    fireEvent.pointerMove(source, { pointerId: 4, clientX: 125, clientY: 180 });
    fireEvent.pointerUp(source, { pointerId: 4, clientX: 125, clientY: 180 });

    expect(onPourBottle).not.toHaveBeenCalled();
    expect(screen.queryByTestId("floating-water")).toBeNull();
  });

  test("注水中の液量変化を示し終了後は盤面の表示へ戻ること", () => {
    vi.useFakeTimers();
    const { rerender } = renderExperiment("settle");
    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={[[0], [1], [2, 3], []]}
        sourceBottleIndex={null}
        operation={{
          id: 7,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1], [], [2, 3], []],
          stateAfter: [[0], [1], [2, 3], []],
          isClearingMove: false,
        }}
        onSelectBottle={onSelectBottle}
        onPourBottle={onPourBottle}
        interactionDisabled={false}
      />,
    );
    expect(screen.getAllByTestId("liquid-transfer")).toHaveLength(2);

    act(() => vi.advanceTimersByTime(500));

    expect(screen.queryByTestId("liquid-transfer")).toBeNull();
  });

  test("液体が着地してから短く水面が揺れ、次の操作では残らないこと", () => {
    vi.useFakeTimers();
    const { rerender } = renderExperiment("settle");
    const poured = {
      id: 32,
      type: "poured" as const,
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
      stateBefore: [[0, 1], [], [2, 3], []],
      stateAfter: [[0], [1], [2, 3], []],
      isClearingMove: false,
    };
    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={poured.stateAfter}
        sourceBottleIndex={null}
        operation={poured}
        onSelectBottle={onSelectBottle}
        interactionDisabled={false}
      />,
    );

    act(() => vi.advanceTimersByTime(360));

    expect(
      screen
        .getByRole("button", { name: "ボトル 2: 青" })
        .querySelector('[data-just-settled="true"]'),
    ).toBeTruthy();

    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={poured.stateAfter}
        sourceBottleIndex={null}
        operation={{ id: 33, type: "invalid", bottleIndex: 2 }}
        onSelectBottle={onSelectBottle}
        interactionDisabled={false}
      />,
    );

    expect(document.querySelector('[data-just-settled="true"]')).toBeNull();
  });

  test("移動量が多い一手は少ない一手より時間をかけて液体が移ること", () => {
    vi.useFakeTimers();
    const { rerender } = renderExperiment("settle");
    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={[[0], [1, 1, 1], [2, 3], []]}
        sourceBottleIndex={null}
        operation={{
          id: 31,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1, 1, 1], [], [2, 3], []],
          stateAfter: [[0], [1, 1, 1], [2, 3], []],
          isClearingMove: false,
        }}
        onSelectBottle={onSelectBottle}
        onPourBottle={onPourBottle}
        interactionDisabled={false}
      />,
    );
    expect(
      screen
        .getAllByTestId("liquid-transfer")[0]
        ?.style.getPropertyValue("--water-sort-transfer-duration"),
    ).toBe("500ms");
    const sourceResponse = screen
      .getByRole("button", { name: "ボトル 1: 赤" })
      .querySelector<HTMLElement>('[data-transfer-role="source"]');
    const destinationResponse = screen
      .getByRole("button", { name: "ボトル 2: 青、青、青" })
      .querySelector<HTMLElement>('[data-transfer-role="destination"]');
    expect(
      sourceResponse?.style.getPropertyValue("--water-sort-motion-amplitude"),
    ).toBe("3.3px");
    expect(
      destinationResponse?.style.getPropertyValue(
        "--water-sort-motion-amplitude",
      ),
    ).toBe("3.3px");
    act(() => vi.advanceTimersByTime(480));
    expect(screen.getAllByTestId("liquid-transfer")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(21));
    expect(screen.queryByTestId("liquid-transfer")).toBeNull();
    expect(document.querySelector("[data-transfer-role]")).toBeNull();
  });

  test("一本が揃うと注水完了後にその色の輪郭へ変わること", () => {
    vi.useFakeTimers();
    const { rerender } = renderExperiment("settle");
    const before = [[0, 1], [1, 1, 1], [2, 3], []];
    const after = [[0], [1, 1, 1, 1], [2, 3], []];
    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={after}
        sourceBottleIndex={null}
        operation={{
          id: 35,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: before,
          stateAfter: after,
          isClearingMove: false,
        }}
        onSelectBottle={onSelectBottle}
        interactionDisabled={false}
      />,
    );
    const bottle = screen.getByRole("button", {
      name: "ボトル 2: 青、青、青、青（完成）",
    });
    expect(bottle.querySelector('[data-complete="true"]')).toBeNull();

    act(() => vi.advanceTimersByTime(360));

    const completed = bottle.querySelector<HTMLElement>(
      '[data-complete="true"]',
    );
    expect(
      completed?.style.getPropertyValue("--water-sort-completed-color"),
    ).toBe("#4a67e8");
    expect(
      completed?.querySelector(".water-sort-completed-seal"),
    ).not.toBeNull();
  });

  test("一本を完成させた直後に待ったで戻しても完成演出が残らないこと", () => {
    vi.useFakeTimers();
    const { rerender } = renderExperiment("settle");
    const before = [[0, 1], [1, 1, 1], [2, 3], []];
    const after = [[0], [1, 1, 1, 1], [2, 3], []];
    const props = {
      experience: "settle" as const,
      sourceBottleIndex: null,
      onSelectBottle,
      interactionDisabled: false,
    };
    rerender(
      <WaterSortExperimentBoard
        {...props}
        state={after}
        operation={{
          id: 34,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: before,
          stateAfter: after,
          isClearingMove: false,
        }}
      />,
    );
    act(() => vi.advanceTimersByTime(360));
    expect(document.querySelector('[data-just-finished="true"]')).toBeTruthy();

    rerender(
      <WaterSortExperimentBoard {...props} state={before} operation={null} />,
    );

    expect(document.querySelector('[data-just-finished="true"]')).toBeNull();
    expect(document.querySelector(".water-sort-completed-seal")).toBeNull();
  });

  test("最後の一手は液体が収まった後も完成の反応を見せてから結果へ進むこと", () => {
    vi.useFakeTimers();
    const onClearAnimationComplete = vi.fn();
    const { rerender } = renderExperiment("settle");
    rerender(
      <WaterSortExperimentBoard
        experience="settle"
        state={[[0], [1, 1, 1, 1], [2, 3], []]}
        sourceBottleIndex={null}
        operation={{
          id: 15,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1], [1, 1, 1], [2, 3], []],
          stateAfter: [[0], [1, 1, 1, 1], [2, 3], []],
          isClearingMove: true,
        }}
        onSelectBottle={onSelectBottle}
        interactionDisabled
        onClearAnimationComplete={onClearAnimationComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(490));
    const finished = screen.getByRole("button", { name: /ボトル 2:/ });
    expect(finished.querySelector("[data-just-finished='true']")).toBeTruthy();
    expect(onClearAnimationComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(550));
    expect(onClearAnimationComplete).toHaveBeenCalledOnce();
  });

  test("比較モード切替後に完了済みの注水演出を再生し直さないこと", () => {
    render(
      <WaterSortExperimentBoard
        experience="touch"
        state={[[0], [1], []]}
        sourceBottleIndex={null}
        operation={{
          id: 21,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1], [], []],
          stateAfter: [[0], [1], []],
          isClearingMove: false,
        }}
        onSelectBottle={onSelectBottle}
        onPourBottle={onPourBottle}
        interactionDisabled={false}
      />,
    );

    expect(screen.queryByTestId("liquid-transfer")).toBeNull();
  });

  test("演出の途中で操作が中断されたら注水表示と活動状態を解放すること", () => {
    vi.useFakeTimers();
    const onActivity = vi.fn();
    const props = {
      experience: "settle" as const,
      state: [[0], [1], []],
      sourceBottleIndex: null,
      onSelectBottle,
      interactionDisabled: false,
      onPourAnimationActivityChange: onActivity,
    };
    const { rerender } = render(
      <WaterSortExperimentBoard {...props} operation={null} />,
    );
    rerender(
      <WaterSortExperimentBoard
        {...props}
        operation={{
          id: 30,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1], [], []],
          stateAfter: [[0], [1], []],
          isClearingMove: false,
        }}
      />,
    );
    expect(screen.getAllByTestId("liquid-transfer")).toHaveLength(2);
    rerender(
      <WaterSortExperimentBoard
        {...props}
        operation={{ id: 31, type: "invalid", bottleIndex: 1 }}
      />,
    );
    expect(screen.queryByTestId("liquid-transfer")).toBeNull();
    expect(onActivity).toHaveBeenLastCalledWith(false);
  });
});
