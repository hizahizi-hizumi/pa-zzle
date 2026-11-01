import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { ParkingJamHomeView } from "@/views/ParkingJamHomeView";

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

  test.each(levelLabels)("%s のカードに盤面の見本を描くこと", (label) => {
    const card = screen.getByRole("tab", { name: new RegExp(`^${label}、`) });

    const preview = card.firstElementChild?.firstElementChild;

    expect(preview).toBeTruthy();
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

  test("レベルを選んでランダムに遊ぶを押すと、そのレベルのプレイ画面へ進むこと", () => {
    chooseLevel("レベル 3");
    fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

    const { pathname } = router.state.location;

    expect(pathname).toBe("/puzzles/parking-jam/play/3");
  });
});
