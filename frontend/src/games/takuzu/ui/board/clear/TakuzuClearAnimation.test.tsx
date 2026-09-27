import { cleanup, render } from "@testing-library/react";

import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TakuzuClearAnimation", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("完成演出を待たずに完了を通知すること", () => {
      render(
        <TakuzuClearAnimation active onComplete={onComplete}>
          <button type="button" data-clear-wave-step={0} />
        </TakuzuClearAnimation>,
      );

      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  describe("完成演出に入っていない場合", () => {
    test("完了を通知しないこと", () => {
      render(
        <TakuzuClearAnimation active={false} onComplete={onComplete}>
          <button type="button" data-clear-wave-step={0} />
        </TakuzuClearAnimation>,
      );

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
