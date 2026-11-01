import { cleanup, render } from "@testing-library/react";

import { NonogramClearAnimation } from "@/games/nonogram/ui/board/clear/NonogramClearAnimation";

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
          <span data-nonogram-clear-wave="0" />
        </NonogramClearAnimation>,
      );
    });

    test("完成した図柄を見せる間を置いてから完了を通知すること", () => {
      const calledBeforeHold = onComplete.mock.calls.length;
      vi.runAllTimers();

      expect(calledBeforeHold).toBe(0);
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  describe("完成演出に入っていない場合", () => {
    beforeEach(() => {
      render(
        <NonogramClearAnimation active={false} onComplete={onComplete}>
          <span data-nonogram-clear-wave="0" />
        </NonogramClearAnimation>,
      );
    });

    test("完了を通知しないこと", () => {
      const calls = onComplete.mock.calls.length;

      expect(calls).toBe(0);
    });
  });
});
