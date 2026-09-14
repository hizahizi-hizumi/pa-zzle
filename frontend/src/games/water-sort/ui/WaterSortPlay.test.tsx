import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WaterSortPlay } from "./WaterSortPlay";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let reactRoot: Root | undefined;

afterEach(async () => {
  if (reactRoot) {
    await act(async () => reactRoot?.unmount());
  }
  reactRoot = undefined;
  document.body.replaceChildren();
});

describe("WaterSortPlay", () => {
  test("プレイ中にクリア操作を通知すること", async () => {
    const clear = vi.fn();
    await renderWaterSortPlay({ clear });
    const button = getButton("クリア確認");

    await act(async () => button.click());

    expect(clear).toHaveBeenCalledOnce();
  });

  test("クリア後に再挑戦操作を通知すること", async () => {
    const retry = vi.fn();
    await renderWaterSortPlay({ status: "cleared", retry });
    const button = getButton("もう一度");

    await act(async () => button.click());

    expect(retry).toHaveBeenCalledOnce();
  });

  test("難易度変更操作を通知すること", async () => {
    const onChangeDifficulty = vi.fn();
    await renderWaterSortPlay({ onChangeDifficulty });
    const button = getButton("難易度を変える");

    await act(async () => button.click());

    expect(onChangeDifficulty).toHaveBeenCalledOnce();
  });
});

async function renderWaterSortPlay(
  overrides: Partial<ComponentProps<typeof WaterSortPlay>> = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  const props: ComponentProps<typeof WaterSortPlay> = {
    difficulty: "normal",
    seed: "test-seed",
    status: "playing",
    clear: vi.fn(),
    retry: vi.fn(),
    onChangeDifficulty: vi.fn(),
    ...overrides,
  };

  await act(async () => reactRoot?.render(<WaterSortPlay {...props} />));
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!button) {
    throw new Error(`ボタンが見つかりません: ${label}`);
  }

  return button;
}
