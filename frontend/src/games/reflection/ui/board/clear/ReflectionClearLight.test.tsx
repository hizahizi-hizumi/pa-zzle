import { cleanup, render } from "@testing-library/react";

import { parseReflectionBoard } from "@/games/reflection/puzzle/board";
import { ReflectionClearLight } from "@/games/reflection/ui/board/clear/ReflectionClearLight";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReflectionClearLight", () => {
  const board = parseReflectionBoard(["/..", "...", "..@"]);
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  describe("動きを減らす設定の場合", () => {
    const animate = vi.fn();

    beforeEach(() => {
      vi.useFakeTimers();
      animate.mockClear();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      // jsdom の SVG 要素には animate が無いので、動かせる環境として足す。
      Element.prototype.animate = animate;
      render(
        <svg aria-label="光路">
          <ReflectionClearLight board={board} active onComplete={onComplete} />
        </svg>,
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    test("光路を伸ばさないこと", () => {
      const animated = animate.mock.calls.length;

      expect(animated).toBe(0);
    });

    test("全光路を見せる間を置いてから完了を通知すること", () => {
      const calledAtOnce = onComplete.mock.calls.length;
      vi.runAllTimers();
      const calledLater = onComplete.mock.calls.length;

      expect([calledAtOnce, calledLater]).toEqual([0, 1]);
    });
  });

  describe("完成演出に入っていない場合", () => {
    beforeEach(() => {
      render(
        <svg aria-label="光路">
          <ReflectionClearLight
            board={board}
            active={false}
            onComplete={onComplete}
          />
        </svg>,
      );
    });

    test("完了を通知しないこと", () => {
      const called = onComplete.mock.calls.length;

      expect(called).toBe(0);
    });
  });
});

describe("全光路の完成演出", () => {
  const board = parseReflectionBoard(["/..", "...", "..@"]);
  const onComplete = vi.fn();
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }) as unknown as Animation);

  beforeEach(() => {
    vi.useFakeTimers();
    animate.mockClear();
    cancel.mockClear();
    onComplete.mockClear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    Element.prototype.animate = animate;
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(Element.prototype, "animate");
  });

  test("本線・光量・白い芯が同じ経路を描くこと", () => {
    const { container } = render(
      <svg aria-label="光路">
        <ReflectionClearLight board={board} active onComplete={onComplete} />
      </svg>,
    );
    const traces = container.querySelectorAll("[data-clear-light-step]");
    const paths = container.querySelectorAll(
      "[data-laser-line], [data-laser-aura], [data-laser-core]",
    );

    expect(traces.length).toBeGreaterThan(0);
    expect(paths).toHaveLength(traces.length * 3);
    expect(animate.mock.calls.length).toBeGreaterThanOrEqual(paths.length);
  });

  test("全光路が揃った姿を見せてから一度だけ完了を通知すること", () => {
    render(
      <svg aria-label="光路">
        <ReflectionClearLight board={board} active onComplete={onComplete} />
      </svg>,
    );
    vi.advanceTimersByTime(1759);
    const calledBefore = onComplete.mock.calls.length;
    vi.advanceTimersByTime(1);
    const calledAfter = onComplete.mock.calls.length;

    expect([calledBefore, calledAfter]).toEqual([0, 1]);
  });
});
