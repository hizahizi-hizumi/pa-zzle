import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router";
import { formatParkingJamProblemQuery } from "@/games/parking-jam/diagnostics";
import * as problemSelection from "@/games/parking-jam/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { ParkingJamPlayView } from "@/views/ParkingJamPlayView";

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

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/parking-jam/play/:difficulty",
        element: <ParkingJamPlayView />,
      },
    ],
    { initialEntries: [path] },
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
