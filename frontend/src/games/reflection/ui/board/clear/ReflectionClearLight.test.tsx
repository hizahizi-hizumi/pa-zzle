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
