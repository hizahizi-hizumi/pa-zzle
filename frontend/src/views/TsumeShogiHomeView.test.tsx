import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { TsumeShogiHomeView } from "@/views/TsumeShogiHomeView";

let fetchProblemPool: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = vi.fn(function ResizeObserver() {
    return { observe() {}, unobserve() {}, disconnect() {} };
  }) as unknown as typeof ResizeObserver;
  fetchProblemPool = vi.fn(async () => new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchProblemPool);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(window, "ResizeObserver");
});

function chooseLevel(label: string) {
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: new RegExp(`^${label}、`) }),
    { button: 0, ctrlKey: false },
  );
}

describe("TsumeShogiHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        {
          path: "/puzzles/tsume-shogi",
          element: <TsumeShogiHomeView />,
        },
        {
          path: "/puzzles/tsume-shogi/play/:difficulty",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/tsume-shogi"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(tsumeShogiCatalogEntry.name);
  });

  const levelLabels = difficultyLevels.map(({ label }) => label);

  test("レベルのカードを5つ並べること", () => {
    const cards = screen.getAllByRole("tab");

    expect(cards).toHaveLength(levelLabels.length);
  });

  test("遊び方を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });

  test("開いたときに問題集の本体を読み込み始めること", () => {
    const requests = fetchProblemPool.mock.calls.length;

    expect(requests).toBe(1);
  });

  test("レベルを選んでランダムに遊ぶを押すと、そのレベルのプレイ画面へ進むこと", () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

    const { pathname } = router.state.location;

    expect(pathname).toBe("/puzzles/tsume-shogi/play/3");
  });
});
