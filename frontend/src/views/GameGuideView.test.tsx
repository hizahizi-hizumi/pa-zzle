import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { GameHowToView } from "@/views/GameHowToView";
import { GameTutorialView } from "@/views/GameTutorialView";

const homePath = "/puzzles/nanpure";
const playPath = "/puzzles/nanpure/play/np-example";

function renderGuide(path: string, state?: unknown, previousPath = homePath) {
  const router = createMemoryRouter(
    [
      { path: homePath, element: <p>問題選択</p> },
      { path: "/puzzles/nanpure/play/:problemId", element: <p>プレイ画面</p> },
      { path: "/puzzles/:game/how-to", element: <GameHowToView /> },
      { path: "/puzzles/:game/tutorial", element: <GameTutorialView /> },
    ],
    {
      initialEntries: [previousPath, { pathname: path, state }],
      initialIndex: 1,
    },
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => cleanup());

describe("GameHowToView", () => {
  test("直接URLで開いて遊び方を表示できること", () => {
    renderGuide("/puzzles/nanpure/how-to");

    const dialog = screen.getByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeTruthy();
  });

  test("ゲームホームから開いて閉じると元の画面へ戻ること", () => {
    const router = renderGuide("/puzzles/nanpure/how-to", {
      returnTo: homePath,
    });
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(router.state.location.pathname).toBe(homePath);
  });
});

describe("GameTutorialView", () => {
  test("直接URLで開いてチュートリアルを表示できること", () => {
    renderGuide("/puzzles/nanpure/tutorial");

    const tutorial = screen.getByRole("dialog", {
      name: "ナンプレ",
      description: "チュートリアル",
    });

    expect(tutorial).toBeTruthy();
  });

  test("プレイから開いて閉じると同じ問題へ戻ること", () => {
    const router = renderGuide(
      "/puzzles/nanpure/tutorial",
      { returnTo: playPath },
      playPath,
    );
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(router.state.location.pathname).toBe(playPath);
  });
});
