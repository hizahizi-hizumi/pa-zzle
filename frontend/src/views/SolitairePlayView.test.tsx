import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { solitaireCatalogEntry } from "@/app/game-integration/solitaire/solitaire-catalog-entry";
import { readPlayAttempts } from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import { selectSolitaireProblemById } from "@/games/solitaire/problem-selection";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import {
  applySolitaireMove,
  listSolitaireMoves,
  type SolitaireMove,
} from "@/games/solitaire/puzzle/rules";
import {
  createSolitaireInitialState,
  findSolitaireRunStart,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import { solitaireSuitSymbols } from "@/games/solitaire/ui/card-text";
import { PlayResultView } from "@/views/PlayResultView";
import { SolitairePlayView } from "@/views/SolitairePlayView";

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
  window.localStorage.clear();
  window.sessionStorage.clear();
});

type PlayRouter = ReturnType<typeof createMemoryRouter>;

const [level1ProblemId] = solitaireCatalogEntry.listPoolProblemIds("1");
const level1Problem = selectSolitaireProblemById("1", level1ProblemId!)!;

function renderAt(pathname: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/solitaire/play/:problemId",
        element: <SolitairePlayView />,
      },
      { path: "/puzzles/solitaire", element: <p>ゲームのホーム画面</p> },
      {
        path: "/puzzles/:game/result/:recordId",
        element: <PlayResultView />,
      },
      { path: "/records", element: <p>記録画面</p> },
      { path: "/", element: <p>ホーム画面</p> },
    ],
    { initialEntries: [pathname] },
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

/** 盤面の山のボタンの名前の書き出し。札の数や一番上の札で続きが変わるので、書き出しで探す。 */
function getPileNamePattern(pile: SolitairePile): RegExp {
  switch (pile.pile) {
    case "stock":
      return /^山札、/;
    case "waste":
      return /^捨て札、/;
    case "column":
      return new RegExp(`^列${pile.columnIndex + 1}、`);
    case "foundation":
      return new RegExp(`^${solitaireSuitSymbols[pile.suit]}の組札、`);
  }
}

function pressPiles(piles: readonly SolitairePile[]): void {
  for (const pile of piles) {
    fireEvent.click(
      screen.getByRole("button", { name: getPileNamePattern(pile) }),
    );
  }
}

/** 組札へ置く手は、どのマークの組札を押しても札のマークの組札へ置くので、♠ の組札を押す。 */
const anyFoundation: SolitairePile = { pile: "foundation", suit: "spades" };

function toPresses(move: SolitaireMove): SolitairePile[] {
  if (move.kind !== "transfer") {
    return [{ pile: "stock" }];
  }
  return [
    move.source,
    move.destination.pile === "foundation" ? anyFoundation : move.destination,
  ];
}

/**
 * 組札へ送る手、札をめくり出す列の移動、捨て札から列へ、山札を押す手、列を空ける移動、並びの途中からの移動、組札から戻す手の順に試し、
 * 同じ局面へは戻らずに解く。素朴な手で解けるレベル1 の配り方は、戻らずに1本道で解ける。
 */
function findSolution(start: SolitaireState): SolitairePile[] {
  const seen = new Set<string>();
  const presses: SolitairePile[][] = [];
  function priority(state: SolitaireState, move: SolitaireMove): number {
    if (move.kind !== "transfer") return 3;
    if (move.source.pile === "foundation") return 6;
    if (move.destination.pile === "foundation") return 0;
    if (move.source.pile === "waste") return 2;
    const column = state.columns[move.source.columnIndex] ?? [];
    if (move.cardCount < column.length - findSolitaireRunStart(column)) {
      return 5;
    }
    return column.length > move.cardCount ? 1 : 4;
  }
  function search(state: SolitaireState): boolean {
    if (isSolitaireCleared(state)) return true;
    const key = JSON.stringify(state);
    if (seen.has(key)) return false;
    seen.add(key);
    const moves = listSolitaireMoves(state).sort(
      (left, right) => priority(state, left) - priority(state, right),
    );
    return moves.some((move) => {
      presses.push(toPresses(move));
      if (search(applySolitaireMove(state, move)!)) return true;
      presses.pop();
      return false;
    });
  }
  search(start);
  return presses.flat();
}

describe("SolitairePlayView", () => {
  describe("問題集の問題IDで開いた場合", () => {
    let router: PlayRouter;

    beforeEach(() => {
      router = renderAt(`/puzzles/solitaire/play/${level1ProblemId}`);
    });

    test("ゲーム名の見出しと、配った7列の盤面を表示すること", () => {
      const heading = screen.getByRole("heading", {
        name: SOLITAIRE_DISPLAY_NAME,
      });
      const columns = screen.getAllByRole("button", { name: /^列\d、/ });

      expect(heading).toBeTruthy();
      expect(columns).toHaveLength(7);
    });

    test("戻るボタンで、遊んでいる問題のIDを付けたゲームのホームへ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      const { location } = router.state;

      expect(location.pathname).toBe("/puzzles/solitaire");
      expect(location.search).toBe(`?problem=${level1ProblemId}`);
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt(`/puzzles/solitaire/play/${level1ProblemId}`);
      openMenu();
    });

    test("メニューの検証情報から、出題中の問題の seed を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

      expect(dialog.getByText("レベル 1")).toBeTruthy();
      expect(dialog.getByText(level1Problem.identity.seed)).toBeTruthy();
    });
  });

  describe("レベル1 の問題を解き終えた場合", () => {
    const solution = findSolution(
      createSolitaireInitialState(
        level1Problem.problem.columns,
        level1Problem.problem.stock,
      ),
    );
    /** 山札を押す手は1回、札を動かす手は置き元と置き先の2回押す。 */
    const stockPressCount = solution.filter(
      ({ pile }) => pile === "stock",
    ).length;
    const moveCount = stockPressCount + (solution.length - stockPressCount) / 2;
    let router: PlayRouter;

    beforeEach(async () => {
      router = renderAt(`/puzzles/solitaire/play/${level1ProblemId}`);
      pressPiles(solution);
      await screen.findByRole("region", { name: "プレイ結果" });
    });

    test("記録の結果画面へ移り、難易度とスコアを示すこと", () => {
      const resultScreen = within(
        screen.getByRole("region", { name: "プレイ結果" }),
      );

      expect(router.state.location.pathname).toMatch(
        /^\/puzzles\/solitaire\/result\//,
      );
      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("遊んだ問題とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "solitaire",
        payload: {
          difficulty: "1",
          problemIdentity: level1Problem.identity,
          performance: {
            moveCount,
            undoCount: 0,
            restartCount: 0,
            retractedMoveCount: 0,
          },
        },
      });
    });
  });

  describe("途中でプレイを離れた場合", () => {
    beforeEach(async () => {
      renderAt(`/puzzles/solitaire/play/${level1ProblemId}`);
      pressPiles([{ pile: "stock" }, { pile: "stock" }]);
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));
      await act(async () => {
        await Promise.resolve();
      });
    });

    test("離れた時点までの手数を進み具合として記録すること", () => {
      const [attempt] = readPlayAttempts();

      expect(attempt).toMatchObject({
        gameId: "solitaire",
        start: { difficulty: "1" },
        abandonment: {
          progress: { moveCount: 2, undoCount: 0, retractedMoveCount: 0 },
        },
      });
    });
  });

  describe("問題集に無い問題IDで開いた場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/solitaire/play/0000000000");
    });

    test("遊べないことを示し、ゲームのホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この問題は現在遊べません");
      const backLink = screen.getByRole("link", { name: "問題選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/solitaire");
    });
  });
});
