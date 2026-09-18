import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { SudokuClearAnimation } from "./SudokuClearAnimation";

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
    <SudokuClearAnimation active onComplete={onComplete}>
      <div>盤面</div>
    </SudokuClearAnimation>,
  );

  expect(onComplete).toHaveBeenCalledOnce();
});
