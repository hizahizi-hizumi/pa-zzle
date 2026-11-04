import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { HakoiriMusumePlayView } from "@/views/HakoiriMusumePlayView";
import { PlayResultView } from "@/views/PlayResultView";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/hakoiri-musume/play/:difficulty",
        element: <HakoiriMusumePlayView />,
      },
      { path: "/puzzles/hakoiri-musume", element: <p>ゲームのホーム画面</p> },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/", element: <p>ホーム画面</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const arrowKeyByDirection = {
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  left: "ArrowLeft",
} as const satisfies Record<HakoiriMusumeDirection, string>;

/** 駒の番号と、矢印キーで1マス動かす向き。 */
type Step = readonly [pieceIndex: number, direction: HakoiriMusumeDirection];

function movePieces(steps: readonly Step[]): void {
  const board = screen.getByRole("group", {
    name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
  });
  for (const [pieceIndex, direction] of steps) {
    const piece = within(board).getAllByRole("button")[pieceIndex]!;
    fireEvent.keyDown(piece, { key: arrowKeyByDirection[direction] });
  }
}

/**
 * レベル1 の問題集の唯一の問題（合意の易しい例 `vAAvwAAwv..vwhiws..s`、最短13手）の最短解を、1マスずつの移動にしたもの。
 * 駒の番号: 0 左上の縦長、1 娘、2 右上の縦長、3 左中の縦長、4 右中の縦長、5 横長、6 左下の小駒、7 右下の小駒。
 */
const easyExampleSolution: readonly Step[] = [
  [5, "down"],
  [1, "down"],
  [1, "down"],
  [0, "right"],
  [3, "up"],
  [3, "up"],
  [1, "left"],
  [4, "left"],
  [4, "up"],
  [4, "up"],
  [7, "up"],
  [7, "up"],
  [5, "right"],
  [5, "up"],
  [6, "right"],
  [6, "right"],
  [6, "right"],
  [1, "down"],
  [7, "left"],
  [7, "left"],
  [5, "up"],
  [1, "right"],
];

describe("HakoiriMusumePlayView", () => {
  describe("レベル1 を開いた場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/hakoiri-musume/play/1");
    });

    test("ゲーム名の見出しと、8つの駒のある盤面を出すこと", () => {
      const heading = screen.getByRole("heading", {
        name: HAKOIRI_MUSUME_DISPLAY_NAME,
      });
      const board = screen.getByRole("group", {
        name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
      });

      expect(heading).toBeTruthy();
      expect(within(board).getAllByRole("button")).toHaveLength(8);
      expect(
        within(board).getByRole("button", { name: "娘 1行2列" }),
      ).toBeTruthy();
    });

    test("矢印キーで動かした駒が隣の空いたマスへ移り、手数が増えること", () => {
      movePieces([[5, "up"]]);

      const board = screen.getByRole("group", {
        name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
      });

      expect(
        within(board).getByRole("button", { name: "横長 3行2列" }),
      ).toBeTruthy();
      expect(screen.getByText("手数").parentElement?.textContent).toBe("手数1");
    });
  });

  describe("最短解で娘を出口の前へ運んだ場合", () => {
    let router: PlayRouter;

    beforeEach(async () => {
      router = renderAt("/puzzles/hakoiri-musume/play/1");
      movePieces(easyExampleSolution);
      await screen.findByRole("region", { name: "プレイ結果" });
    });

    test("記録の結果画面へ移り、最短との差が0であることを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(router.state.location.pathname).toMatch(
        /^\/puzzles\/hakoiri-musume\/result\//,
      );
      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByText("最短 ±0")).toBeTruthy();
    });

    test("遊んだ問題とプレイの事実と最短手数を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "hakoiri-musume",
        payload: {
          difficulty: "1",
          problemIdentity: { seed: "vAAvwAAwv..vwhiws..s" },
          performance: {
            moveCount: 13,
            undoCount: 0,
            restartCount: 0,
            optimalMoveCount: 13,
          },
        },
      });
    });
  });

  describe("途中でプレイを離れた場合", () => {
    beforeEach(async () => {
      renderAt("/puzzles/hakoiri-musume/play/1");
      movePieces([
        [5, "up"],
        [6, "right"],
      ]);
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      await act(async () => {
        await Promise.resolve();
      });
    });

    test("離れた時点までの手数を進み具合として記録すること", () => {
      const [attempt] = readPlayAttempts();

      expect(attempt).toMatchObject({
        gameId: "hakoiri-musume",
        start: { difficulty: "1" },
        abandonment: {
          progress: { moveCount: 2, undoCount: 0, restartCount: 0 },
        },
      });
    });
  });

  describe("レベルでない値の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/hakoiri-musume/play/6");
    });

    test("選べない難易度であることを示しゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "問題選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/hakoiri-musume");
    });
  });
});
