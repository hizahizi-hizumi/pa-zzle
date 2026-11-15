import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { TakuzuHomeView } from "@/views/TakuzuHomeView";

// 画面のつなぎを確かめるのに問題集の全問は要らず、全問の台紙を描くと重いので、各レベルの先頭の数問に絞る。
vi.mock(
  "@/app/game-integration/takuzu/takuzu-catalog-entry",
  async (importOriginal) => {
    const { takuzuCatalogEntry } =
      await importOriginal<
        typeof import("@/app/game-integration/takuzu/takuzu-catalog-entry")
      >();
    return {
      takuzuCatalogEntry: {
        ...takuzuCatalogEntry,
        listPoolProblemIds(difficulty: DifficultyLevel) {
          return takuzuCatalogEntry.listPoolProblemIds(difficulty).slice(0, 3);
        },
      },
    };
  },
);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = vi.fn(function ResizeObserver() {
    return { observe() {}, unobserve() {}, disconnect() {} };
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(window, "ResizeObserver");
});

function chooseLevel(label: string) {
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: new RegExp(`^${label}、`) }),
    { button: 0, ctrlKey: false },
  );
}

describe("TakuzuHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        { path: "/puzzles/takuzu", element: <TakuzuHomeView /> },
        { path: "/puzzles/takuzu/how-to", element: <p>遊び方の画面</p> },
        {
          path: "/puzzles/takuzu/tutorial",
          element: <p>チュートリアルの画面</p>,
        },
        {
          path: "/puzzles/takuzu/play/:problemId",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/takuzu"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(takuzuCatalogEntry.name);
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

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/puzzles/takuzu/how-to"),
    );
  });

  test("見出しのメニューからチュートリアルを開けること", async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "チュートリアル" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/puzzles/takuzu/tutorial"),
    );
  });

  test("戻るリンクでホームへ戻れること", () => {
    const backLink = screen.getByRole("link", { name: "戻る" });

    const href = backLink.getAttribute("href");

    expect(href).toBe("/");
  });

  test("レベルを選んでランダムに遊ぶを押すと、そのレベルのプレイ画面へ進むこと", () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

    const { pathname } = router.state.location;

    const problemId = pathname.replace("/puzzles/takuzu/play/", "");

    expect(takuzuCatalogEntry.listPoolProblemIds("3")).toContain(problemId);
  });
});
