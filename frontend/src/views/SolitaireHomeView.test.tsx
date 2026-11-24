import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { solitaireCatalogEntry } from "@/app/game-integration/solitaire/solitaire-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { GameHowToView } from "@/views/GameHowToView";
import { SolitaireHomeView } from "@/views/SolitaireHomeView";

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

function openHowToPlay() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
}

describe("SolitaireHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        { path: "/puzzles/solitaire", element: <SolitaireHomeView /> },
        { path: "/puzzles/:game/how-to", element: <GameHowToView /> },
        {
          path: "/puzzles/solitaire/play/:problemId",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/solitaire"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(solitaireCatalogEntry.name);
  });

  test("レベルのカードを5つ並べること", () => {
    const cards = screen.getAllByRole("tab");

    expect(cards).toHaveLength(difficultyLevels.length);
  });

  test("見出しのメニューから遊び方を開き、チュートリアルを始める操作を出さないこと", async () => {
    openHowToPlay();

    await screen.findByRole("dialog", { name: "ソリティアの遊び方" });

    expect(router.state.location.pathname).toBe("/puzzles/solitaire/how-to");
    expect(
      screen.queryByRole("button", { name: "チュートリアルで遊んで覚える" }),
    ).toBeNull();
  });

  test("レベルを選んでランダムに遊ぶを押すと、そのレベルのプレイ画面へ進むこと", () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

    const problemId = router.state.location.pathname.replace(
      "/puzzles/solitaire/play/",
      "",
    );

    expect(solitaireCatalogEntry.listPoolProblemIds("3")).toContain(problemId);
  });
});
