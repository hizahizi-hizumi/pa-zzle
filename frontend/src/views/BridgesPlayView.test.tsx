import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from "react-router";
import { readPlayAttempts } from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { measureBridgesSolveWorkload } from "@/games/bridges/problem/workload";
import {
  selectBridgesProblemById,
  selectBridgesProblemForDifficulty,
} from "@/games/bridges/problem-selection";
import {
  bridgesDirections,
  findBridgesEdgeToward,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { createBoardView } from "@/games/bridges/ui/board/board-geometry";
import { createProblemId } from "@/games/problem-id";
import { BridgesPlayView } from "@/views/BridgesPlayView";
import { PlayResultView } from "@/views/PlayResultView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "bridges-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
}));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
  internalDiagnostics.available = false;
  window.localStorage.clear();
});

function LocationSearch() {
  return <output aria-label="URL のクエリ">{useLocation().search}</output>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/bridges/play/:difficulty"
          element={
            <>
              <BridgesPlayView />
              <LocationSearch />
            </>
          }
        />
        <Route path="/puzzles/bridges" element={<p>ゲームのホーム画面</p>} />
        <Route
          path="/puzzles/:game/result/:recordId"
          element={<PlayResultView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/bridges/play/:difficulty",
        element: <BridgesPlayView />,
      },
      { path: "/puzzles/bridges", element: <p>ゲームのホーム画面</p> },
      { path: "/puzzles/:game/result/:recordId", element: <PlayResultView /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

const pooled = selectBridgesProblemForDifficulty("5", problemSeed);
const { problem, identity } = pooled;
const network = getBridgesNetwork(problem);
const { margin: boardMargin } = createBoardView(problem);
const solution = countBridgesSolutions(problem, {
  limit: 1,
  nodeLimit: 200_000,
}).firstSolution!;
const cellPixels = 100;
const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

type CellPosition = readonly [row: number, column: number];
type EdgeEnds = readonly [CellPosition, CellPosition];

function getEdgeEnds(edge: number): EdgeEnds {
  const { from, to } = network.edges[edge]!;
  const a = problem.islands[from]!;
  const b = problem.islands[to]!;
  return [
    [a.row, a.column],
    [b.row, b.column],
  ];
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", {
    name: `${BRIDGES_DISPLAY_NAME}盤面 ${problem.height}行${problem.width}列`,
  });
}

function pointToward(from: CellPosition, to: CellPosition, reach: number) {
  const [fromRow, fromColumn] = from;
  const [toRow, toColumn] = to;
  return {
    clientX:
      (boardMargin +
        fromColumn +
        0.5 +
        Math.sign(toColumn - fromColumn) * reach) *
      cellPixels,
    clientY:
      (boardMargin + fromRow + 0.5 + Math.sign(toRow - fromRow) * reach) *
      cellPixels,
  };
}

function tapBetween([from, to]: EdgeEnds): void {
  const board = getBoard();
  // 島の的のすぐ外の線の上を押す。交わる線は島から1マス以上離れるので、交点のそばの押し（どちらの橋も回さない）にならない。
  fireEvent.pointerDown(board, { ...touch, ...pointToward(from, to, 0.65) });
  fireEvent.pointerUp(board, { ...touch, ...pointToward(from, to, 0.65) });
}

function dragBetween([from, to]: EdgeEnds): void {
  fireEvent.pointerDown(getBoard(), { ...touch, ...pointToward(from, to, 0) });
  fireEvent.pointerUp(getBoard(), { ...touch, ...pointToward(to, from, 0) });
}

/** 盤面の読み上げの、島ごとの行（「1行3列の島 数字2 橋1本 ちょうど」）。 */
function readIslands(): string[] {
  return within(getBoard())
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

function countPlacedBridges(): number {
  const total = readIslands().reduce(
    (sum, text) => sum + Number(/橋(\d+)本/.exec(text)?.[1]),
    0,
  );
  // 島ごとの橋の本数の合計は、橋1本を両端の島で2回数える。
  return total / 2;
}

function readIsland([row, column]: CellPosition): string {
  return readIslands().find((text) =>
    text.startsWith(`${row + 1}行${column + 1}列の島`),
  )!;
}

const solutionEdges = solution.flatMap((count, edge) =>
  count === 0 ? [] : [edge],
);
const doubleEdge = getEdgeEnds(solution.indexOf(2));
const crossingEdge = network.crossingEdges.findIndex(
  (crossings) => crossings.length > 0,
);
const crossedEdge = network.crossingEdges[crossingEdge]![0]!;
const lastEdge = solutionEdges.at(-1)!;
const solutionLineCount = solution.reduce((total, count) => total + count, 0);

function solveAllButLast(): void {
  for (const edge of solutionEdges) {
    const ends = getEdgeEnds(edge);
    const count = edge === lastEdge ? solution[edge]! - 1 : solution[edge]!;
    for (let bridge = 0; bridge < count; bridge += 1) {
      if (bridge === 0) {
        tapBetween(ends);
      } else {
        dragBetween(ends);
      }
    }
  }
}

function placeBoard(): void {
  vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(
    new DOMRect(
      0,
      0,
      (problem.width + 2 * boardMargin) * cellPixels,
      (problem.height + 2 * boardMargin) * cellPixels,
    ),
  );
}

function getResultScreen() {
  return within(screen.getByRole("region", { name: "プレイ結果" }));
}

describe("BridgesPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/5");
      placeBoard();
    });

    test("橋の無い盤面と、その問題 ID の URL を示すこと", () => {
      const search = screen.getByRole("status", { name: "URL のクエリ" });
      const bridgeCount = countPlacedBridges();

      expect({ bridgeCount, query: search.textContent }).toEqual({
        bridgeCount: 0,
        query: `?problem=${createProblemId(identity)}`,
      });
    });

    test("島と島の間を押すたびに橋が1本 → 2本 → なしと変わること", () => {
      const counts = [1, 2, 3].map(() => {
        tapBetween(doubleEdge);
        return countPlacedBridges();
      });

      expect(counts).toEqual([1, 2, 0]);
    });

    test("島から隣の島の向きへなぞると橋を架けること", () => {
      dragBetween(doubleEdge);
      const island = readIsland(doubleEdge[0]);

      expect(island).toContain("橋1本");
    });

    test("島の丸の中で離すと橋を架けないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        ...pointToward(...doubleEdge, 0),
      });
      fireEvent.pointerUp(getBoard(), {
        ...touch,
        ...pointToward(...doubleEdge, 0.3),
      });
      const bridgeCount = countPlacedBridges();

      expect(bridgeCount).toBe(0);
    });

    describe("交わる所に橋がある場合", () => {
      beforeEach(() => {
        tapBetween(getEdgeEnds(crossingEdge));
      });

      test("交わる辺には架けないこと", () => {
        dragBetween(getEdgeEnds(crossedEdge));
        const bridgeCount = countPlacedBridges();

        expect(bridgeCount).toBe(1);
      });
    });

    test("待ったで直前の橋を取り消すこと", () => {
      tapBetween(doubleEdge);
      fireEvent.click(screen.getByRole("button", { name: "待った" }));
      const bridgeCount = countPlacedBridges();

      expect(bridgeCount).toBe(0);
    });

    describe("キーボードで島を選んだ場合", () => {
      const direction = bridgesDirections.find(
        (candidate) => findBridgesEdgeToward(problem, 0, candidate) !== null,
      )!;
      const arrowKey = {
        up: "ArrowUp",
        right: "ArrowRight",
        down: "ArrowDown",
        left: "ArrowLeft",
      }[direction];
      const first = problem.islands[0]!;
      const firstLabel = `${first.row + 1}行${first.column + 1}列の島`;

      beforeEach(() => {
        within(getBoard())
          .getByRole("button", { name: new RegExp(`^${firstLabel}`) })
          .focus();
      });

      test("Shift と矢印キーで、その向きの辺の橋を架けること", () => {
        fireEvent.keyDown(document.activeElement!, {
          key: arrowKey,
          shiftKey: true,
        });
        const island = readIsland([first.row, first.column]);

        expect(island).toContain("橋1本");
      });

      test("矢印キーで、その向きの隣の島へ移ること", () => {
        fireEvent.keyDown(document.activeElement!, { key: arrowKey });
        const focused = document.activeElement?.textContent ?? "";

        expect(focused.startsWith(firstLabel)).toBe(false);
      });
    });

    describe("最後の1本を除いて解いた場合", () => {
      beforeEach(() => {
        solveAllButLast();
      });

      test("全島がちょうどになるまでは、記録を保存しないこと", () => {
        const allExact = readIslands().every((text) =>
          text.endsWith("ちょうど"),
        );
        const records = readPlayRecords();

        expect({ allExact, records }).toEqual({
          allExact: false,
          records: [],
        });
      });

      describe("最後の1本を架けた場合", () => {
        beforeEach(() => {
          tapBetween(getEdgeEnds(lastEdge));
        });

        test("遊んだ問題と作業の量とプレイの事実を記録へ保存すること", () => {
          const records = readPlayRecords();

          expect(records).toHaveLength(1);
          expect(records[0]).toMatchObject({
            gameId: "bridges",
            payload: {
              difficulty: "5",
              problemIdentity: identity,
              workload: measureBridgesSolveWorkload(pooled),
              performance: {
                undoCount: 0,
                restartCount: 0,
                inputCount: solutionLineCount,
                blockedCount: 0,
              },
            },
          });
        });

        test("保存した記録の結果画面で難易度とスコアを示すこと", () => {
          const resultScreen = getResultScreen();

          expect(resultScreen.getByText("レベル 5")).toBeTruthy();
          expect(
            resultScreen.getByRole("region", { name: "スコア" }),
          ).toBeTruthy();
        });

        describe("同じ問題をもう一度解いた場合", () => {
          beforeEach(() => {
            fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
            placeBoard();
            solveAllButLast();
            tapBetween(getEdgeEnds(lastEdge));
          });

          test("もう1件の記録として保存すること", () => {
            const records = readPlayRecords();

            expect(records).toHaveLength(2);
          });
        });
      });
    });

    describe("橋を1本架けて別の問題へ移った場合", () => {
      beforeEach(() => {
        tapBetween(getEdgeEnds(solutionEdges[0]!));
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
      });

      test("離れたプレイの進み具合を、架けた橋の本数とともに記録すること", () => {
        const abandoned = readPlayAttempts().find(
          (attempt) => attempt.abandonment !== null,
        );

        expect(abandoned?.abandonment?.progress).toMatchObject({
          placedBridgeCount: 1,
          requiredBridgeCount: solutionLineCount,
          inputCount: 1,
        });
      });
    });
  });

  describe("全部の橋を架けて記録を保存した場合", () => {
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt("/puzzles/bridges/play/5");
      placeBoard();
      solveAllButLast();
      tapBetween(getEdgeEnds(lastEdge));
    });

    test("記録の結果画面のパスへ履歴を置き換えて移ること", () => {
      const [record] = readPlayRecords();

      expect(router.state.location.pathname).toBe(
        `/puzzles/bridges/result/${encodeURIComponent(record?.id ?? "")}`,
      );
      expect(router.state.historyAction).toBe("REPLACE");
      expect(getResultScreen().getByText("レベル 5")).toBeTruthy();
    });
  });

  describe("URL の問題 ID で問題を指定した場合", () => {
    const { identity: requestedIdentity } = selectBridgesProblemForDifficulty(
      "4",
      "requested-problem",
    );
    const problemId = createProblemId(requestedIdentity);
    const requested = selectBridgesProblemById("4", problemId)!;

    beforeEach(() => {
      renderAt(`/puzzles/bridges/play/4?problem=${problemId}`);
    });

    test("その問題で始めること", () => {
      const board = screen.getByRole("group", {
        name: `${BRIDGES_DISPLAY_NAME}盤面 ${requested.problem.height}行${requested.problem.width}列`,
      });
      const islandCount = within(board).getAllByRole("button").length;
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(islandCount).toBe(requested.problem.islands.length);
      expect(search.textContent).toBe(`?problem=${problemId}`);
    });
  });

  describe("URL の問題 ID が引けない場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/3?problem=unknown");
    });

    const expected = selectBridgesProblemForDifficulty("3", problemSeed);

    test("難易度の問題を選び、その問題 ID に URL を置き換えること", () => {
      const search = screen.getByRole("status", { name: "URL のクエリ" });

      expect(search.textContent).toBe(
        `?problem=${createProblemId(expected.identity)}`,
      );
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/bridges/play/3");
      openMenu();
    });

    test("メニューの検証情報から、出題中の問題を分析し直した検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      // 出題した難易度と、分析し直した判定。
      expect(dialog.getAllByText("レベル 3")).toHaveLength(2);
      expect(dialog.getByText(/^一意（探索 \d+局面）$/)).toBeTruthy();
    });
  });

  describe("定義されていない難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/bridges/play/9");
    });

    test("遊べないことを示し、ゲームのホームへ戻れること", () => {
      fireEvent.click(screen.getByRole("link", { name: "問題選択へ戻る" }));
      const destination = screen.queryByText("ゲームのホーム画面");

      expect(destination).not.toBeNull();
    });
  });

  describe("問題集にある問題IDで開いた場合", () => {
    const poolProblemId = createProblemId(
      selectBridgesProblemForDifficulty("1", "game-home-navigation").identity,
    );
    let router: PlayRouter;

    beforeEach(() => {
      router = renderRouterAt(
        `/puzzles/bridges/play/1?problem=${poolProblemId}`,
      );
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      const { historyAction, location } = router.state;

      expect(location.pathname).toBe("/puzzles/bridges");
      expect(location.search).toBe(`?problem=${poolProblemId}`);
      expect(historyAction).toBe("REPLACE");
    });

    describe("メニューからゲームのホームを選んだ場合", () => {
      beforeEach(() => {
        openMenu();
      });

      test("遊んでいる問題のIDを付けたゲームのホームへ履歴を置き換えて移ること", () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "問題選択" }));
        const { historyAction, location } = router.state;

        expect(location.pathname).toBe("/puzzles/bridges");
        expect(location.search).toBe(`?problem=${poolProblemId}`);
        expect(historyAction).toBe("REPLACE");
      });
    });
  });
});
