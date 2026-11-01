import { cleanup, render } from "@testing-library/react";

import {
  _private,
  NonogramClearAnimation,
} from "@/games/nonogram/ui/board/clear/NonogramClearAnimation";

const { REDUCED_MOTION_HOLD_MS } = _private;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("NonogramClearAnimation", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      render(
        <NonogramClearAnimation active onComplete={onComplete}>
          <span data-nonogram-clear-swell="" />
        </NonogramClearAnimation>,
      );
    });

    test("完成した図柄を見せる間を置いてから完了を通知すること", () => {
      vi.advanceTimersByTime(REDUCED_MOTION_HOLD_MS - 1);
      const calledBeforeHold = onComplete.mock.calls.length;

      vi.advanceTimersByTime(1);

      expect(calledBeforeHold).toBe(0);
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  describe("完成演出に入っていない場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      render(
        <NonogramClearAnimation active={false} onComplete={onComplete}>
          <span data-nonogram-clear-swell="" />
        </NonogramClearAnimation>,
      );
    });

    test("時間が経っても完了を通知しないこと", () => {
      vi.runAllTimers();

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
