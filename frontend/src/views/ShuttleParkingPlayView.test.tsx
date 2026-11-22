import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { shuttleParkingCatalogEntry } from "@/app/game-integration/shuttle-parking/shuttle-parking-catalog-entry";
import { readPlayAttempts } from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import { createProblemId } from "@/games/problem-id";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import { selectShuttleParkingProblemById } from "@/games/shuttle-parking/problem-selection";
import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingPuzzle,
} from "@/games/shuttle-parking/puzzle/rules";
import { PlayResultView } from "@/views/PlayResultView";
import { ShuttleParkingPlayView } from "@/views/ShuttleParkingPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderAt(problemId: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/shuttle-parking/play/:problemId",
        element: <ShuttleParkingPlayView />,
      },
      { path: "/puzzles/shuttle-parking", element: <p>ゲームのホーム画面</p> },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/", element: <p>ホーム画面</p> },
    ],
    { initialEntries: [`/puzzles/shuttle-parking/play/${problemId}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function findClearingOrder(puzzle: ShuttleParkingPuzzle): number[] {
  const { canClear } = createShuttleParkingClearability(puzzle);
  const order: number[] = [];
  let state = createShuttleParkingInitialState(puzzle);
  while (state.parkedCarIds.length > 0) {
    for (const carId of listShuttleParkingExitableCarIds(puzzle, state)) {
      const exit = exitShuttleParkingCar(puzzle, state, carId);
      if (exit.outcome === "exited" && canClear(exit.state)) {
        order.push(carId);
        state = exit.state;
        break;
      }
    }
  }
  return order;
}

function pressCar(carId: number): void {
  const lot = screen.getByRole("group", { name: "送迎パーキングの駐車場" });
  const car = lot.querySelector(`[data-car-id="${carId}"]`);
  if (!(car instanceof HTMLElement)) throw new Error(`car ${carId} not found`);
  fireEvent.click(car);
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

const [problemId] = shuttleParkingCatalogEntry.listPoolProblemIds("1");
const selected = selectShuttleParkingProblemById("1", problemId!)!;

describe("ShuttleParkingPlayView", () => {
  describe("問題集にある問題IDで開いた場合", () => {
    beforeEach(() => {
      renderAt(problemId!);
    });

    test("その問題のプレイ画面を表示すること", () => {
      const heading = screen.getByRole("heading", {
        name: SHUTTLE_PARKING_DISPLAY_NAME,
      });
      const lot = screen.getByRole("group", { name: "送迎パーキングの駐車場" });

      expect(heading).toBeTruthy();
      expect(within(lot).getAllByRole("button")).toHaveLength(
        selected.problem.lot.cars.length,
      );
    });

    test("戻るボタンでゲームのホームへ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));

      expect(screen.getByText("ゲームのホーム画面")).toBeTruthy();
    });

    test("内部診断を使えないビルドではメニューに検証情報を出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("全員を送り出した場合", () => {
    let router: PlayRouter;

    beforeEach(async () => {
      router = renderAt(problemId!);
      for (const carId of findClearingOrder(selected.problem)) {
        pressCar(carId);
      }
      await screen.findByRole(
        "region",
        { name: "プレイ結果" },
        { timeout: 3_000 },
      );
    });

    test("記録の結果画面へ移り、難易度とスコアを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(router.state.location.pathname).toMatch(
        /^\/puzzles\/shuttle-parking\/result\//,
      );
      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("遊んだ問題とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "shuttle-parking",
        payload: {
          difficulty: "1",
          problemIdentity: selected.identity,
          performance: {
            exitCount: selected.problem.lot.cars.length,
            trapCount: 0,
            undoCount: 0,
          },
        },
      });
    });
  });

  describe("途中でプレイを離れた場合", () => {
    beforeEach(async () => {
      renderAt(problemId!);
      pressCar(findClearingOrder(selected.problem)[0]!);
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      await act(async () => {
        await Promise.resolve();
      });
    });

    test("離れた時点までの回数を進み具合として記録すること", () => {
      const [attempt] = readPlayAttempts();

      expect(attempt).toMatchObject({
        gameId: "shuttle-parking",
        start: { difficulty: "1" },
        abandonment: { progress: { exitCount: 1, undoCount: 0 } },
      });
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(problemId!);
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の符号を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      expect(dialog.getByText(selected.identity.seed)).toBeTruthy();
    });
  });

  describe("存在しない問題IDで開いた場合", () => {
    beforeEach(() => {
      renderAt("invalid");
    });

    test("開けないことを伝え、ゲームのホームへ戻る導線を出すこと", () => {
      const backLink = screen.getByRole("link", { name: "問題選択へ戻る" });

      expect(screen.getByText("この問題は現在遊べません")).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/shuttle-parking");
    });
  });

  test("問題IDが問題集の問題の identity から作られていること", () => {
    expect(createProblemId(selected.identity)).toBe(problemId);
  });
});
