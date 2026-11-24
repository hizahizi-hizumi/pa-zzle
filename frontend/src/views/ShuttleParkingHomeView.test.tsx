import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { shuttleParkingCatalogEntry } from "@/app/game-integration/shuttle-parking/shuttle-parking-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { GameHowToView } from "@/views/GameHowToView";
import { ShuttleParkingHomeView } from "@/views/ShuttleParkingHomeView";

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

describe("ShuttleParkingHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        {
          path: "/puzzles/shuttle-parking",
          element: <ShuttleParkingHomeView />,
        },
        { path: "/puzzles/:game/how-to", element: <GameHowToView /> },
        {
          path: "/puzzles/shuttle-parking/tutorial",
          element: <p>チュートリアルの画面</p>,
        },
        {
          path: "/puzzles/shuttle-parking/play/:problemId",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/shuttle-parking"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(shuttleParkingCatalogEntry.name);
  });

  test("レベルのカードを5つ並べること", () => {
    const cards = screen.getAllByRole("tab");

    expect(cards).toHaveLength(difficultyLevels.length);
  });

  test("見出しのメニューから遊び方を開けること", async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/puzzles/shuttle-parking/how-to",
      ),
    );
    expect(
      await screen.findByRole("dialog", { name: "送迎パーキングの遊び方" }),
    ).toBeTruthy();
  });

  test("遊び方からチュートリアルを開けること", async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "チュートリアルで遊んで覚える",
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/puzzles/shuttle-parking/tutorial",
      ),
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
    const problemId = pathname.replace("/puzzles/shuttle-parking/play/", "");

    expect(shuttleParkingCatalogEntry.listPoolProblemIds("3")).toContain(
      problemId,
    );
  });
});
