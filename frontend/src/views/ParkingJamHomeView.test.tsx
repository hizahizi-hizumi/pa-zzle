import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { ParkingJamHomeView } from "@/views/ParkingJamHomeView";

// 画面のつなぎを確かめるのに問題集の全問は要らず、全問の台紙を描くと重いので、各レベルの先頭の数問に絞る。
vi.mock(
  "@/app/game-integration/parking-jam/parking-jam-catalog-entry",
  async (importOriginal) => {
    const { parkingJamCatalogEntry } =
      await importOriginal<
        typeof import("@/app/game-integration/parking-jam/parking-jam-catalog-entry")
      >();
    return {
      parkingJamCatalogEntry: {
        ...parkingJamCatalogEntry,
        listPoolProblemIds(difficulty: DifficultyLevel) {
          return parkingJamCatalogEntry
            .listPoolProblemIds(difficulty)
            .slice(0, 3);
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

describe("ParkingJamHomeView", () => {
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    router = createMemoryRouter(
      [
        { path: "/puzzles/parking-jam", element: <ParkingJamHomeView /> },
        {
          path: "/puzzles/parking-jam/play/:difficulty",
          element: <p>プレイ画面</p>,
        },
      ],
      { initialEntries: ["/puzzles/parking-jam"] },
    );
    render(<RouterProvider router={router} />);
  });

  test("ゲームの表示名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe(parkingJamCatalogEntry.name);
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
      name: "パーキングジャム",
      description: "チュートリアル",
    });

    expect(dialog).toBeTruthy();
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

    expect(pathname).toBe("/puzzles/parking-jam/play/3");
  });
});
