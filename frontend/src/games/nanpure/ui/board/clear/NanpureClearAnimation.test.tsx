import { cleanup, render } from "@testing-library/react";

import { NanpureClearAnimation } from "./NanpureClearAnimation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("動きを減らす設定の場合", () => {
  let onComplete: () => void;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
    onComplete = vi.fn();
    render(
      <NanpureClearAnimation active onComplete={onComplete}>
        <div>盤面</div>
      </NanpureClearAnimation>,
    );
  });

  test("クリア演出を待たずに完了通知すること", () => {
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
