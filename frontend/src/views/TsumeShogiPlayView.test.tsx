import {
  act,
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
} from "react-router";

import { createProblemId } from "@/games/problem-id";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { toTsumeShogiPooledProblem } from "@/games/tsume-shogi/problem/problem-pool";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import {
  formatTsumeShogiMoveUsi,
  listTsumeShogiAttackerChecks,
  listTsumeShogiLegalMoves,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import {
  formatTsumeShogiSquare,
  tsumeShogiHandPieceNames,
} from "@/games/tsume-shogi/ui/piece-label";
import { TsumeShogiPlayView } from "@/views/TsumeShogiPlayView";

const problemSeed = "tsume-shogi-play-view";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: () => problemSeed,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/tsume-shogi/play/:difficulty"
          element={<TsumeShogiPlayView />}
        />
        <Route path="/" element={<p>ホーム画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

type PlayRouter = ReturnType<typeof createMemoryRouter>;

function renderRouterAt(path: string): PlayRouter {
  const router = createMemoryRouter(
    [
      {
        path: "/puzzles/tsume-shogi/play/:difficulty",
        element: <TsumeShogiPlayView />,
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

function openMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤" });
}

function waitForDefenderReply(): void {
  act(() => {
    vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
  });
}

function getSquare(square: TsumeShogiSquare): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${formatTsumeShogiSquare(square)}( |$)`),
  });
}

/** 攻方の手を、盤の升か持駒を押してから行き先の升を押して指す。成・不成を選ぶときは手のとおりに選ぶ。 */
function playAttackerMove(move: TsumeShogiMove): void {
  fireEvent.click(
    move.kind === "drop"
      ? within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
          "button",
          {
            name: new RegExp(`^${tsumeShogiHandPieceNames[move.pieceType]} `),
          },
        )
      : getSquare(move.from),
  );
  fireEvent.click(getSquare(move.to));
  const promotionPicker = screen.queryByRole("group", { name: "成・不成" });
  if (promotionPicker && move.kind === "board") {
    fireEvent.click(
      within(promotionPicker).getByRole("button", {
        name: move.promote ? "成" : "不成",
      }),
    );
  }
}

/** 作意の攻方の手を指し、玉方の応手と完成演出の間を進める。 */
function playMainLine({ mainLine }: TsumeShogiProblem): void {
  mainLine.forEach((move, index) => {
    if (index % 2 === 1) return;

    playAttackerMove(move);
    waitForDefenderReply();
  });
  act(() => {
    vi.runAllTimers();
  });
}

const selected = selectTsumeShogiProblemForDifficulty("1", problemSeed);
const initialPosition = selected.problem.initialPosition;
const [firstMove] = selected.problem.mainLine as [TsumeShogiMove];
const checkUsis = new Set(
  listTsumeShogiAttackerChecks(initialPosition).map(formatTsumeShogiMoveUsi),
);
// 攻方の正解は1つなので、初手の作意以外の王手はどれも誤王手。
const wrongCheck = listTsumeShogiAttackerChecks(initialPosition).find(
  (move) =>
    formatTsumeShogiMoveUsi(move) !== formatTsumeShogiMoveUsi(firstMove),
) as TsumeShogiMove;
const nonCheck = listTsumeShogiLegalMoves(initialPosition).find(
  (move) => !checkUsis.has(formatTsumeShogiMoveUsi(move)),
) as TsumeShogiMove;

/** 指す前の駒がある升（打つ手は持駒）の要素。 */
function getMoveSource(move: TsumeShogiMove): HTMLElement {
  return move.kind === "drop"
    ? within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
        "button",
        {
          name: new RegExp(`^${tsumeShogiHandPieceNames[move.pieceType]} `),
        },
      )
    : getSquare(move.from);
}

describe("TsumeShogiPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/1");
    });

    test("遊び方を自動では開かないこと", () => {
      const dialog = screen.queryByRole("dialog");

      expect(dialog).toBeNull();
    });

    test("9×9の盤を表示すること", () => {
      const squares = within(getBoard()).getAllByRole("button");

      expect(squares).toHaveLength(81);
    });

    test("メニューのホームでホームへ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "ホーム" }));

      expect(screen.getByText("ホーム画面")).toBeTruthy();
    });
  });

  describe("通常の出題を詰ませた場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderAt("/puzzles/tsume-shogi/play/1");
      playMainLine(selected.problem);
    });

    test("完成演出の後に詰みを示すこと", () => {
      const cleared = screen.getByRole("region", { name: "詰み" });

      expect(within(cleared).getByText(/手詰 ・ レベル 1$/)).toBeTruthy();
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/9");
    });

    test("選べない難易度であることを示しホームへ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "ホームへ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/");
    });
  });

  describe("指している途中の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderAt("/puzzles/tsume-shogi/play/1");
    });

    test("作意どおりに指すと玉方が応手すること", () => {
      const [, defenderMove] = selected.problem.mainLine as [
        TsumeShogiMove,
        TsumeShogiMove,
      ];
      playAttackerMove(firstMove);
      waitForDefenderReply();

      expect(getSquare(defenderMove.to).getAttribute("aria-label")).toMatch(
        / 玉方の/,
      );
    });

    test("詰まない王手には玉方の反証を指し、待ったで判断地点へ戻れること", () => {
      const sourceLabel = getMoveSource(wrongCheck).getAttribute("aria-label");
      playAttackerMove(wrongCheck);
      waitForDefenderReply();
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(getMoveSource(wrongCheck).getAttribute("aria-label")).toBe(
        sourceLabel,
      );
      expect(
        screen.getByRole("button", { name: "待った" }).hasAttribute("disabled"),
      ).toBe(true);
    });

    describe("王手を指して玉方の応手を待っている場合", () => {
      beforeEach(() => {
        fireEvent.click(getMoveSource(firstMove));
        const destination = getSquare(firstMove.to);
        destination.focus();
        fireEvent.click(destination);
        const promotionPicker = screen.queryByRole("group", {
          name: "成・不成",
        });
        if (promotionPicker && firstMove.kind === "board") {
          fireEvent.click(
            within(promotionPicker).getByRole("button", {
              name: firstMove.promote ? "成" : "不成",
            }),
          );
          getSquare(firstMove.to).focus();
        }
      });

      test("指した升のフォーカスを残したまま、盤の升を押せなくすること", () => {
        const playedSquare = getSquare(firstMove.to);

        expect(document.activeElement).toBe(playedSquare);
        expect(playedSquare.getAttribute("aria-disabled")).toBe("true");
      });
    });

    describe("駒を選んでから遊び方を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(getMoveSource(firstMove));
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
      });

      test("遊び方を閉じる Escape で駒の選択を解除しないこと", () => {
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(getMoveSource(firstMove).getAttribute("aria-pressed")).toBe(
          "true",
        );
      });
    });

    test("王手にならない手は着手させないこと", () => {
      const sourceLabel = getMoveSource(nonCheck).getAttribute("aria-label");
      playAttackerMove(nonCheck);

      const status = screen.getByRole("status");

      expect(status.textContent).toBe("王手になりません");
      expect(getMoveSource(nonCheck).getAttribute("aria-label")).toBe(
        sourceLabel,
      );
    });
  });

  describe("問題IDのクエリ", () => {
    const requested = toTsumeShogiPooledProblem("3", 4);
    const requestedProblemId = createProblemId(requested.identity);
    let router: PlayRouter;

    describe("問題IDの無いURLで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt("/puzzles/tsume-shogi/play/1");
      });

      test("出題した問題のIDを履歴を増やさずにURLへ反映すること", () => {
        const problemId = readProblemId(router);

        expect(problemId).toBe(createProblemId(selected.identity));
        expect(router.state.historyAction).toBe("REPLACE");
      });
    });

    describe("問題集にある問題IDで開いた場合", () => {
      beforeEach(() => {
        router = renderRouterAt(
          `/puzzles/tsume-shogi/play/3?problem=${requestedProblemId}`,
        );
      });

      test("その問題で始めURLを置き換えないこと", () => {
        const problemId = readProblemId(router);
        const plies = screen.getByText(`${requested.problem.plies}手詰`);

        expect(problemId).toBe(requestedProblemId);
        expect(router.state.historyAction).toBe("POP");
        expect(plies).toBeTruthy();
      });
    });

    const unresolvedCases = [
      ["形式の違う問題ID", "1", "invalid"],
      ["別の難易度の問題ID", "1", requestedProblemId],
    ] as const;

    describe.each(unresolvedCases)(
      "%sで開いた場合",
      (_, difficulty, problemIdInUrl) => {
        beforeEach(() => {
          router = renderRouterAt(
            `/puzzles/tsume-shogi/play/${difficulty}?problem=${problemIdInUrl}`,
          );
        });

        test("知らせずに新しい問題を出し、そのIDへURLを置き換えること", () => {
          const problemId = readProblemId(router);

          expect(problemId).toBe(createProblemId(selected.identity));
          expect(router.state.historyAction).toBe("REPLACE");
        });
      },
    );
  });
});
