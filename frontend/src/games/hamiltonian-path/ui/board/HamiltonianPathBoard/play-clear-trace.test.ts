import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { playClearTrace } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/play-clear-trace";
import {
  HamiltonianPathFigure,
  hamiltonianPathFigureParts,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";

const board = parseHamiltonianPathBoard(["S . .", ". . .", ". . ."]);
const path = [0, 1, 2, 5, 4, 3, 6, 7, 8];
/** 光でなぞる演出とその後の間を十分に超える時間。 */
const longEnoughMs = 10_000;

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("playClearTrace", () => {
  let figure: SVGSVGElement;
  let animatedElements: Element[];
  let cancelTrace: ReturnType<typeof vi.fn>;
  let finishTrace: () => void;
  const onFinished = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onFinished.mockClear();
    animatedElements = [];
    cancelTrace = vi.fn();
    const finished = new Promise<void>((resolve) => {
      finishTrace = resolve;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(function record(this: Element) {
        animatedElements.push(this);
        return { finished, cancel: cancelTrace } as unknown as Animation;
      }),
    });
    const { container } = render(
      createElement(HamiltonianPathFigure, {
        board,
        path,
        isDeadEnd: false,
        solved: true,
      }),
    );
    figure = container.querySelector("svg")!;
  });

  test("クリアした道を光でなぞり、なぞり終えるまで完了を知らせないこと", async () => {
    playClearTrace(figure, path.length, onFinished);
    await vi.advanceTimersByTimeAsync(longEnoughMs);

    expect(animatedElements).toEqual([
      figure.querySelector(`[${hamiltonianPathFigureParts.clearTrace}]`),
    ]);
    expect(onFinished).not.toHaveBeenCalled();
  });

  test("なぞり終えた後、完成した道を見せる間を置いてから一度だけ完了を知らせること", async () => {
    playClearTrace(figure, path.length, onFinished);
    finishTrace();
    await vi.advanceTimersByTimeAsync(0);
    const finishedRightAfterTrace = onFinished.mock.calls.length;
    await vi.advanceTimersByTimeAsync(longEnoughMs);

    expect(finishedRightAfterTrace).toBe(0);
    expect(onFinished).toHaveBeenCalledOnce();
  });

  test("取り消すとなぞる光を止め、完了を知らせないこと", async () => {
    const cancel = playClearTrace(figure, path.length, onFinished);
    cancel();
    finishTrace();
    await vi.advanceTimersByTimeAsync(longEnoughMs);

    expect(cancelTrace).toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("光を動かさず、完成した道を見せる間を置いてから完了を知らせること", async () => {
      playClearTrace(figure, path.length, onFinished);
      const finishedImmediately = onFinished.mock.calls.length;
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      expect(animatedElements).toEqual([]);
      expect(finishedImmediately).toBe(0);
      expect(onFinished).toHaveBeenCalledOnce();
    });
  });
});
