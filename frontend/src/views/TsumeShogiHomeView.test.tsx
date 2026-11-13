import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { TsumeShogiHomeView } from "@/views/TsumeShogiHomeView";

// 画面のつなぎを確かめるのに問題集の全問は要らず、全問の台紙を描くと重いので、各レベルの先頭の数問に絞る。
vi.mock(
  "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry",
  async (importOriginal) => {
    const { tsumeShogiCatalogEntry } =
      await importOriginal<
        typeof import("@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry")
      >();
    return {
      tsumeShogiCatalogEntry: {
        ...tsumeShogiCatalogEntry,
        listPoolProblemIds(difficulty: DifficultyLevel) {
          return tsumeShogiCatalogEntry
            .listPoolProblemIds(difficulty)
            .slice(0, 3);
        },
      },
    };
  },
);

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

  test("見出しのメニューから遊び方を開けること", async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

    const dialog = await screen.findByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });

  test("見出しのメニューからチュートリアルを開けること", async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "チュートリアル" }));

    const dialog = await screen.findByRole("dialog", {
      name: "詰将棋",
      description: "チュートリアル",
    });

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

  test("まだクリアしていなければ、ランダムに遊ぶでチュートリアルを開き、とばして遊ぶを押すと選んだレベルのプレイ画面へ進むこと", async () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "とばして遊ぶ" }),
    );

    const { pathname } = router.state.location;

    expect(pathname).toBe("/puzzles/tsume-shogi/play/3");
  });
});
