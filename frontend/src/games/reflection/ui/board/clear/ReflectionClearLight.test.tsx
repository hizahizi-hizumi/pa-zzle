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
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      render(
        <svg aria-label="光路">
          <ReflectionClearLight board={board} active onComplete={onComplete} />
        </svg>,
      );
    });

    test("光路を伸ばさずに完了を通知すること", () => {
      const called = onComplete.mock.calls.length;

      expect(called).toBe(1);
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
