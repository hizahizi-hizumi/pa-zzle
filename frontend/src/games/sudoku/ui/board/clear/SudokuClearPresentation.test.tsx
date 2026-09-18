import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { SudokuClearPresentation } from "./SudokuClearPresentation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("動きを減らす設定ではクリア演出を待たずに完了通知すること", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
  const onComplete = vi.fn();

  render(
    <SudokuClearPresentation active onComplete={onComplete}>
      <div>盤面</div>
    </SudokuClearPresentation>,
  );

  expect(onComplete).toHaveBeenCalledOnce();
});
