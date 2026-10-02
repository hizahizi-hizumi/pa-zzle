import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";
import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { formatParkingJamProblemQuery } from "@/games/parking-jam/diagnostics";
import * as problemSelection from "@/games/parking-jam/problem-selection";
import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamBoard,
  type ParkingJamMove,
  type ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamLegalMoves,
} from "@/games/parking-jam/puzzle/rules";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import { readPlayRecords } from "@/records/storage";
import { ParkingJamPlayView } from "@/views/ParkingJamPlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/parking-jam/play/:difficulty"
          element={<ParkingJamPlayView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function countRenderedCars(): number {
  return document.querySelectorAll(".parking-jam-car__body").length;
}

const specifiedProblem = problemSelection.selectParkingJamProblemForDifficulty(
  "5",
  "parking-jam-play-view-specified",
);
const specifiedProblemPath = `/puzzles/parking-jam/play/1?${formatParkingJamProblemQuery(specifiedProblem.identity)}`;

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(entry: InitialEntry): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/parking-jam/play/:difficulty",
        element: <ParkingJamPlayView />,
      },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function readProblemId(router: PlayRouter): string | null {
  return new URLSearchParams(router.state.location.search).get("problem");
}

describe("ParkingJamPlayView", () => {
  describe("定義済みのレベルの場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/parking-jam/play/5");
    });

    test("プレイ画面を表示すること", () => {
      const message = screen.queryByText("この難易度は選べません");

      expect(message).toBeNull();
      expect(countRenderedCars()).toBeGreaterThan(0);
    });
  });

  const invalidDifficultyCases = ["hard", "6"] as const;

  describe.each(invalidDifficultyCases)("レベルでない %s の場合", (value) => {
    beforeEach(() => {
      renderAt(`/puzzles/parking-jam/play/${value}`);
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/parking-jam");
    });
  });

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSelection, "selectParkingJamProblemForDifficulty");
      renderAt(specifiedProblemPath);
    });

    test("指定を無視してレベルの問題集から出題すること", () => {
      const selectProblem =
        problemSelection.selectParkingJamProblemForDifficulty;

      expect(selectProblem).toHaveBeenCalledWith("1", expect.any(String));
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      vi.spyOn(problemSelection, "selectParkingJamProblemForDifficulty");
      renderAt(specifiedProblemPath);
    });

    test("指定した問題を問題集を使わずに出題すること", () => {
      const selectProblem =
        problemSelection.selectParkingJamProblemForDifficulty;

      expect(selectProblem).not.toHaveBeenCalled();
      expect(countRenderedCars()).toBe(
        specifiedProblem.problem.board.vehicles.length,
      );
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/parking-jam/play/1?seed=abc&board=8x8");
    });

    test("指定を復元できないことを示すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");

      expect(message).toBeTruthy();
    });
  });

  describe("問題IDのクエリ", () => {
    const poolProblemId = createProblemId(
      problemSelection.selectParkingJamProblemForDifficulty(
        "1",
        "problem-id-query",
      ).identity,
    );
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/parking-jam/play/1");
      });

      test("出題した問題のIDを履歴を増やさずにURLへ反映すること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toMatch(/^[0-9a-v]{10}$/);
        expect(router.state.historyAction).toBe("REPLACE");
      });
    });

    describe("問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt(
          `/puzzles/parking-jam/play/1?problem=${poolProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(poolProblemId);
        expect(router.state.historyAction).toBe("POP");
      });
    });

    describe("内部診断を使えるビルドで遊び比べの問題を指定した場合", () => {
      beforeEach(() => {
        internalDiagnostics.available = true;
        router = renderRouterAt(specifiedProblemPath);
      });

      test("URLに問題IDを加えないこと", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBeNull();
        expect(router.state.historyAction).toBe("POP");
      });
    });

    const unresolvedCases = [
      ["形式の違う問題ID", "1", "invalid"],
      ["別の難易度の問題ID", "2", poolProblemId],
    ] as const;

    describe.each(unresolvedCases)(
      "%sで開いた場合",
      (_, difficulty, requestedProblemId) => {
        beforeEach(() => {
          router = renderRouterAt(
            `/puzzles/parking-jam/play/${difficulty}?problem=${requestedProblemId}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toMatch(/^[0-9a-v]{10}$/);
          expect(problemId).not.toBe(requestedProblemId);
          expect(router.state.historyAction).toBe("REPLACE");
          expect(screen.queryByText(/選べません|復元できません/)).toBeNull();
        });
      },
    );
  });
});

/** 車の向きに沿って出庫できる車を順に出し、すべての車を出庫させる手順を求める。車が減っても出庫できなくなる車は無い。 */
function findExitMoves(board: ParkingJamBoard): ParkingJamMove[] {
  const moves: ParkingJamMove[] = [];
  let state = createParkingJamInitialState(board);
  while (!isParkingJamCleared(state)) {
    const move = listParkingJamLegalMoves(board, state).find(
      ({ vehicleId, direction }) =>
        (board.vehicles.find((vehicle) => vehicle.id === vehicleId)
          ?.orientation ===
          "horizontal") ===
        (direction === "left" || direction === "right"),
    );
    const next = move && applyParkingJamMove(board, state, move);
    if (!move || !next) {
      throw new Error("Parking jam board must be solvable");
    }
    moves.push(move);
    state = next;
  }
  return moves;
}

const arrowKeys = {
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  left: "ArrowLeft",
} as const;

function getVehicleLabel(vehicle: ParkingJamVehicle): string {
  return `${vehicle.orientation === "horizontal" ? "横向き" : "縦向き"}の車 行${vehicle.row + 1} 列${vehicle.column + 1}`;
}

describe("解き終えた場合", () => {
  const { problem, identity } =
    problemSelection.selectParkingJamProblemForDifficulty("1", "solve");
  const exits = findExitMoves(problem.board).map((move) => ({
    label: getVehicleLabel(
      problem.board.vehicles.find(
        (vehicle) => vehicle.id === move.vehicleId,
      ) as ParkingJamVehicle,
    ),
    key: arrowKeys[move.direction],
  }));
  let router: PlayRouter;

  beforeEach(() => {
    router = renderRouterAt(
      `/puzzles/parking-jam/play/1?problem=${createProblemId(identity)}`,
    );
    for (const exit of exits) {
      fireEvent.keyDown(screen.getByLabelText(exit.label), { key: exit.key });
    }
    const lastExit = exits.at(-1);
    if (lastExit) {
      // jsdom には animationend の CSS 対応が無く、React は接頭辞付きのイベント名で購読する。
      fireEvent(
        screen.getByLabelText(lastExit.label),
        new Event("webkitAnimationEnd", { bubbles: true }),
      );
    }
  });

  test("保存した記録の結果画面へ履歴を置き換えて移ること", async () => {
    const resultScreen = await screen.findByRole("region", {
      name: "プレイ結果",
    });
    const [record] = readPlayRecords();

    expect(resultScreen).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      `/puzzles/parking-jam/result/${encodeURIComponent(record?.id ?? "")}`,
    );
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual({
      recordSaveOutcome: { status: "first-record" },
    });
  });
});

describe("直前の問題を避ける location state", () => {
  const firstProblem = problemSelection.selectParkingJamProblemForDifficulty(
    "1",
    "avoided-first",
  );
  const secondProblem = problemSelection.selectParkingJamProblemForDifficulty(
    "1",
    "avoided-second",
  );
  const firstProblemId = createProblemId(firstProblem.identity);
  const secondProblemId = createProblemId(secondProblem.identity);
  const state = createPlayLocationState(firstProblemId);
  let router: PlayRouter;

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("avoided-first")
      .mockReturnValueOnce("avoided-second");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("問題IDの無いURLで開いた場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/parking-jam/play/1",
        state,
      });
    });

    test("避ける問題を選ばずに別の問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(secondProblemId).not.toBe(firstProblemId);
      expect(problemId).toBe(secondProblemId);
    });
  });

  describe("避ける問題をURLの問題IDでも指定した場合", () => {
    beforeEach(() => {
      router = renderRouterAt({
        pathname: "/puzzles/parking-jam/play/1",
        search: `?problem=${firstProblemId}`,
        state,
      });
    });

    test("URLで指定した問題で始めること", () => {
      const problemId = readProblemId(router);

      expect(problemId).toBe(firstProblemId);
      expect(router.state.historyAction).toBe("POP");
    });
  });
});
