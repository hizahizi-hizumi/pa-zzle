import { routes } from "@generouted/react-router";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, test } from "vitest";

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

describe("routes", () => {
  test("ゲーム選択からカラーウォーターソートの成績表示まで遷移できること", async () => {
    const router = await renderRoute("/");

    await clickLink("/games/water-sort");
    expect(router.state.location.pathname).toBe("/games/water-sort");
    expect(document.body.textContent).toContain(
      "難易度を選んでプレイを始めます",
    );

    await clickLink("/games/water-sort/play/hard");
    expect(router.state.location.pathname).toBe("/games/water-sort/play/hard");
    expect(document.body.textContent).toContain("難易度: むずかしい");

    await clickButton("クリア確認");
    expect(document.body.textContent).toContain(
      "カラーウォーターソートをクリアしました",
    );
    expect(router.state.location.pathname).toBe("/games/water-sort/play/hard");
  });

  test("ナンプレのプレイURLを直接開けること", async () => {
    const router = await renderRoute("/games/sudoku/play/easy");

    expect(router.state.location.pathname).toBe("/games/sudoku/play/easy");
    expect(document.body.textContent).toContain("ナンプレ");
    expect(document.body.textContent).toContain("難易度: かんたん");
  });

  test("プレイ画面から履歴を戻ると難易度選択へ戻れること", async () => {
    const router = await renderRoute("/games/sudoku");
    await clickLink("/games/sudoku/play/normal");

    await act(async () => router.navigate(-1));

    expect(router.state.location.pathname).toBe("/games/sudoku");
    expect(document.body.textContent).toContain(
      "難易度を選んでプレイを始めます",
    );
  });

  test("未定義の難易度をプレイ開始として扱わないこと", async () => {
    await renderRoute("/games/water-sort/play/impossible");

    expect(document.body.textContent).toContain("この難易度は選べません");
  });
});

async function renderRoute(path: string) {
  const container = document.createElement("div");
  document.body.append(container);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  reactRoot = createRoot(container);

  await act(async () => {
    reactRoot?.render(<RouterProvider router={router} />);
  });

  return router;
}

async function clickLink(href: string) {
  const link = document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
  expect(link).not.toBeNull();

  await act(async () => {
    link?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
}

async function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();

  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
