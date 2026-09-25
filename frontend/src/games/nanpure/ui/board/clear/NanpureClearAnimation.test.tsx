import { cleanup, render } from "@testing-library/react";

import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";

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
    <NanpureClearAnimation active onComplete={onComplete}>
      <div>盤面</div>
    </NanpureClearAnimation>,
  );

  expect(onComplete).toHaveBeenCalledOnce();
});
