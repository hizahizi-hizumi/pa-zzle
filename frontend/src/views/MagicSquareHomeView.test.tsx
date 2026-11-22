import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { magicSquareCatalogEntry } from "@/app/game-integration/magic-square/magic-square-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { GameHowToView } from "@/views/GameHowToView";
import { MagicSquareHomeView } from "@/views/MagicSquareHomeView";

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

function openMenuItem(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(screen.getByRole("menuitem", { name }));
}

describe("MagicSquareHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        { path: "/puzzles/magic-square", element: <MagicSquareHomeView /> },
        { path: "/puzzles/:game/how-to", element: <GameHowToView /> },
        {
          path: "/puzzles/magic-square/tutorial",
          element: <p>チュートリアルの画面</p>,
        },
        {
          path: "/puzzles/magic-square/play/:problemId",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/magic-square"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(magicSquareCatalogEntry.name);
  });

  test("レベルのカードを5つ並べること", () => {
    const cards = screen.getAllByRole("tab");

    expect(cards).toHaveLength(difficultyLevels.length);
  });

  test("見出しのメニューから遊び方を開けること", async () => {
    openMenuItem("遊び方");

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/puzzles/magic-square/how-to",
      ),
    );
  });

  test("遊び方からチュートリアルを開けること", async () => {
    openMenuItem("遊び方");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "チュートリアルで遊んで覚える",
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/puzzles/magic-square/tutorial",
      ),
    );
  });

  test("レベルを選んでランダムに遊ぶを押すと、そのレベルの問題のプレイ画面へ進むこと", async () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

    await waitFor(() =>
      expect(
        magicSquareCatalogEntry
          .listPoolProblemIds("3")
          .map((problemId) => `/puzzles/magic-square/play/${problemId}`),
      ).toContain(router.state.location.pathname),
    );
  });
});
