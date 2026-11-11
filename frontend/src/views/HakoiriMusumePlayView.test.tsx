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
import {
  createHakoiriMusumeComponentGraph,
  measureHakoiriMusumeStateGraph,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  decodeHakoiriMusumePoolEntry,
  listHakoiriMusumePoolEntries,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  formatHakoiriMusumeBoard,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  moveHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";
import { createProblemId } from "@/games/problem-id";
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

/** 問題集の1問を最短解で解く、駒の番号と1マスずつの向きの並び。最短解は全局面の最短手数から1手ずつ減る盤面をたどって求める。 */
function findSolutionSteps(board: string): Step[] {
  const graph = createHakoiriMusumeComponentGraph(board);
  const { optimal } = measureHakoiriMusumeStateGraph(graph);
  const steps: Step[] = [];
  let state = createHakoiriMusumeInitialState(parseHakoiriMusumeBoard(board)!);
  let current = graph.indexByBoard.get(board)!;
  while (optimal[current] !== 0) {
    let next = -1;
    for (
      let edge = graph.edgeStarts[current]!;
      edge < graph.edgeStarts[current + 1]!;
      edge += 1
    ) {
      if (optimal[graph.edges[edge]!] === optimal[current]! - 1) {
        next = graph.edges[edge]!;
        break;
      }
    }
    const target = graph.boards[next]!;
    const route = findRoute(state, target);
    for (const direction of route.directions) {
      steps.push([route.pieceIndex, direction]);
    }
    state = route.state;
    current = next;
  }
  return steps;
}

/** 1手で盤面 `target` にする駒と、その駒を1マスずつ動かす向き。 */
function findRoute(
  state: HakoiriMusumeState,
  target: string,
): {
  pieceIndex: number;
  directions: HakoiriMusumeDirection[];
  state: HakoiriMusumeState;
} {
  for (let pieceIndex = 0; pieceIndex < state.pieces.length; pieceIndex += 1) {
    const routes = new Map([
      [
        formatHakoiriMusumeBoard(state.pieces),
        { state, directions: [] as HakoiriMusumeDirection[] },
      ],
    ]);
    const queue = [...routes.values()];
    for (let head = 0; head < queue.length; head += 1) {
      const { state: from, directions } = queue[head]!;
      if (formatHakoiriMusumeBoard(from.pieces) === target) {
        return { pieceIndex, directions, state: from };
      }
      for (const direction of hakoiriMusumeDirections) {
        const moved = moveHakoiriMusumePiece(from, pieceIndex, direction);
        const key = moved && formatHakoiriMusumeBoard(moved.pieces);
        if (moved && key && !routes.has(key)) {
          const entry = {
            state: moved,
            directions: [...directions, direction],
          };
          routes.set(key, entry);
          queue.push(entry);
        }
      }
    }
  }
  throw new Error(`No single move reaches ${target}`);
}

const problemEntry = listHakoiriMusumePoolEntries("1")[0]!;
const [problemBoard, problemOptimalMoveCount, problemPreparationLength] =
  problemEntry;
const problemId = createProblemId(
  decodeHakoiriMusumePoolEntry(problemEntry).identity,
);
const problemPath = `/puzzles/hakoiri-musume/play/1?problem=${problemId}`;
const solution = findSolutionSteps(problemBoard);

describe("HakoiriMusumePlayView", () => {
  describe("レベル1 の問題を問題 ID で開いた場合", () => {
    const pieces = parseHakoiriMusumeBoard(problemBoard)!;

    beforeEach(() => {
      renderAt(problemPath);
    });

    test("ゲーム名の見出しと、問題の駒を並べた盤面を出すこと", () => {
      const heading = screen.getByRole("heading", {
        name: HAKOIRI_MUSUME_DISPLAY_NAME,
      });
      const board = screen.getByRole("group", {
        name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
      });

      expect(heading).toBeTruthy();
      expect(within(board).getAllByRole("button")).toHaveLength(pieces.length);
    });

    test("矢印キーで動かした駒が隣の空いたマスへ移り、手数が増えること", () => {
      const board = screen.getByRole("group", {
        name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
      });
      const [pieceIndex] = solution[0]!;
      const before = within(board)
        .getAllByRole("button")
        [pieceIndex]!.getAttribute("aria-label");
      movePieces([solution[0]!]);

      const after = within(board)
        .getAllByRole("button")
        [pieceIndex]!.getAttribute("aria-label");

      expect(after).not.toBe(before);
      expect(screen.getByText("手数").parentElement?.textContent).toBe("手数1");
    });
  });

  describe("最短解で娘を出口の前へ運んだ場合", () => {
    let router: PlayRouter;

    beforeEach(async () => {
      router = renderAt(problemPath);
      movePieces(solution);
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
      expect(resultScreen.getByLabelText("最短手数と同じ ±0")).toBeTruthy();
    });

    test("遊んだ問題とプレイの事実と最短手数を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "hakoiri-musume",
        payload: {
          difficulty: "1",
          problemIdentity: { seed: problemBoard },
          performance: {
            moveCount: problemOptimalMoveCount,
            undoCount: 0,
            restartCount: 0,
            optimalMoveCount: problemOptimalMoveCount,
            preparationLength: problemPreparationLength,
          },
        },
      });
    });
  });

  describe("途中でプレイを離れた場合", () => {
    beforeEach(async () => {
      renderAt(problemPath);
      movePieces(solution.slice(0, 1));
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
          progress: { moveCount: 1, undoCount: 0, restartCount: 0 },
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
