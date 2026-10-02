import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import {
  formatTsumeShogiPoolProblemQuery,
  formatTsumeShogiProblemQuery,
} from "@/games/tsume-shogi/diagnostics";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  createTsumeShogiProblemIdentity,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";
import {
  restoreTsumeShogiPoolProblem,
  selectTsumeShogiProblemForDifficulty,
} from "@/games/tsume-shogi/problem-selection";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import { writeTsumeShogiHowToPlaySeen } from "@/games/tsume-shogi/ui/how-to-play-seen";
import {
  formatTsumeShogiSquare,
  tsumeShogiHandPieceNames,
} from "@/games/tsume-shogi/ui/piece-label";
import { readPlayRecords } from "@/records/storage";
import { TsumeShogiPlayView } from "@/views/TsumeShogiPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));
const problemSeed = "tsume-shogi-play-view";

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

beforeEach(() => {
  writeTsumeShogiHowToPlaySeen();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  internalDiagnostics.available = false;
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/puzzles/tsume-shogi/play/:difficulty"
          element={<TsumeShogiPlayView />}
        />
        <Route path="/puzzles/tsume-shogi" element={<p>難易度選択画面</p>} />
        <Route path="/records" element={<p>記録画面</p>} />
        <Route path="/" element={<p>ホーム画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
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

function tapSquare(name: RegExp): void {
  fireEvent.click(within(getBoard()).getByRole("button", { name }));
}

function tapHand(character: string): void {
  fireEvent.click(
    within(screen.getByRole("group", { name: "攻方の持駒" })).getByText(
      character,
    ),
  );
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

/** 作意の攻方の手を、盤の升と持駒を押して指し、玉方の応手と完成演出の間を進める。 */
function playMainLine({ mainLine }: TsumeShogiProblem): void {
  mainLine.forEach((move, index) => {
    if (index % 2 === 1) return;

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
    waitForDefenderReply();
  });
  act(() => {
    vi.runAllTimers();
  });
}

function getResultScreen() {
  return within(screen.getByRole("region", { name: "プレイ結果" }));
}

// 問題集に無い3手詰: ▲2二銀打 △1二玉 ▲1三龍。
const specifiedProblemIdentity = createTsumeShogiProblemIdentity(3, 14);
const specifiedProblemPath = `/puzzles/tsume-shogi/play/1?${formatTsumeShogiProblemQuery(specifiedProblemIdentity)}`;
const poolProblemReference = { poolVersion: "2", problemId: "1-1" };
const poolProblemPath = `/puzzles/tsume-shogi/play/2?${formatTsumeShogiPoolProblemQuery(poolProblemReference)}`;

describe("TsumeShogiPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/1");
    });

    test("9×9の盤を表示すること", () => {
      const squares = within(getBoard()).getAllByRole("button");

      expect(squares).toHaveLength(81);
    });

    test("戻るボタンで難易度選択画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューの難易度変更で難易度選択画面へ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(screen.getByText("難易度選択画面")).toBeTruthy();
    });

    test("メニューのホームでホームへ移ること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "ホーム" }));

      expect(screen.getByText("ホーム画面")).toBeTruthy();
    });
  });

  describe("通常の出題を詰ませた場合", () => {
    const selected = selectTsumeShogiProblemForDifficulty("1", problemSeed);

    beforeEach(() => {
      vi.useFakeTimers();
      renderAt("/puzzles/tsume-shogi/play/1");
      playMainLine(selected.problem);
    });

    test("結果画面で難易度とスコアと誤王手の回数を示すこと", () => {
      const resultScreen = getResultScreen();

      expect(resultScreen.getByText("レベル 1")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
      expect(resultScreen.getByText("誤王手")).toBeTruthy();
    });

    test("遊んだ問題と問題集の位置と作業の量とプレイの事実を記録へ保存すること", () => {
      const records = readPlayRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        gameId: "tsume-shogi",
        payload: {
          difficulty: "1",
          problemIdentity: selected.identity,
          poolReference: selected.poolReference,
          workload: selected.workload,
          performance: { wrongCheckCount: 0, illegalInputCount: 0 },
        },
      });
    });

    test("記録を確認で記録画面へ移ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

      expect(screen.getByText("記録画面")).toBeTruthy();
    });

    describe("同じ問題をもう一度詰ませた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
        playMainLine(selected.problem);
      });

      test("もう1件の記録として保存すること", () => {
        const records = readPlayRecords();

        expect(records).toHaveLength(2);
      });
    });
  });

  describe("内部診断を使えるビルドの場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/tsume-shogi/play/1");
      openMenu();
    });

    test("メニューの検証情報から出題中の問題の検証情報を開けること", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      const dialog = screen.getByRole("dialog", { name: "検証情報" });

      // 出題した難易度と、分析し直した分類。
      expect(within(dialog).getAllByText("レベル 1")).toHaveLength(2);
      expect(within(dialog).getByText(/^ts-/)).toBeTruthy();
      expect(within(dialog).getByText(/^v2 \/ 1-\d+$/)).toBeTruthy();
    });
  });

  describe("内部診断を使えないビルドの場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/1");
      openMenu();
    });

    test("メニューに検証情報を出さないこと", () => {
      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("内部診断を使えるビルドで問題集の問題を指定して詰ませた場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      vi.useFakeTimers();
      renderAt(poolProblemPath);
      playMainLine(
        restoreTsumeShogiPoolProblem(poolProblemReference)
          ?.problem as TsumeShogiProblem,
      );
    });

    test("難易度を伏せてスコアを出すこと", () => {
      const resultScreen = getResultScreen();

      expect(resultScreen.getByText("問題指定")).toBeTruthy();
      expect(resultScreen.getByRole("region", { name: "スコア" })).toBeTruthy();
    });

    test("記録を保存しないこと", () => {
      const records = readPlayRecords();

      expect(records).toEqual([]);
    });
  });

  describe("未定義の難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/9");
    });

    test("選べない難易度であることを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("この難易度は選べません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/tsume-shogi");
    });
  });

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      renderAt(specifiedProblemPath);
    });

    test("指定を無視して難易度の問題を出すこと", () => {
      const squares = within(getBoard()).getAllByRole("button");

      expect(squares).toHaveLength(81);
      expect(screen.queryByText("指定された問題を復元できません")).toBeNull();
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/tsume-shogi/play/1?seed=ts-3-0&plies=7");
    });

    test("指定を復元できないことを示し難易度選択へ戻る導線を出すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");
      const backLink = screen.getByRole("link", { name: "難易度選択へ戻る" });

      expect(message).toBeTruthy();
      expect(backLink.getAttribute("href")).toBe("/puzzles/tsume-shogi");
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      vi.useFakeTimers();
      renderAt(specifiedProblemPath);
    });

    test("指定した問題を出すこと", () => {
      const silverOn1a = within(getBoard()).getByRole("button", {
        name: "1一 攻方の銀",
      });

      expect(silverOn1a).toBeTruthy();
    });

    test("作意どおりに指すと玉方が応手すること", () => {
      tapHand("銀");
      tapSquare(/^2二$/);
      waitForDefenderReply();
      const kingAfterReply = within(getBoard()).getByRole("button", {
        name: "1二 玉方の玉",
      });

      expect(kingAfterReply).toBeTruthy();
    });

    describe("詰ませた場合", () => {
      beforeEach(() => {
        tapHand("銀");
        tapSquare(/^2二$/);
        waitForDefenderReply();
        tapSquare(/^4三 攻方の龍$/);
        tapSquare(/^1三$/);
        act(() => {
          vi.runAllTimers();
        });
      });

      test("記録を保存しないこと", () => {
        const records = readPlayRecords();

        expect(records).toEqual([]);
      });
    });

    test("詰まない王手には玉方の反証を指し、判断地点へ戻れること", () => {
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^4一$/);
      waitForDefenderReply();
      const refutedKing = within(getBoard()).getByRole("button", {
        name: "1二 玉方の玉",
      });
      fireEvent.click(screen.getByRole("button", { name: "判断地点へ戻る" }));

      expect(refutedKing).toBeTruthy();
      expect(
        within(getBoard()).getByRole("button", { name: "4三 攻方の龍" }),
      ).toBeTruthy();
      expect(
        within(getBoard()).getByRole("button", { name: "2一 玉方の玉" }),
      ).toBeTruthy();
    });

    describe("王手を指して玉方の応手を待っている場合", () => {
      beforeEach(() => {
        tapHand("銀");
        const destination = getSquare({ file: 2, rank: 2 });
        destination.focus();
        fireEvent.click(destination);
      });

      test("指した升のフォーカスを残したまま、盤の升を押せなくすること", () => {
        const playedSquare = within(getBoard()).getByRole("button", {
          name: "2二 攻方の銀",
        });

        expect(document.activeElement).toBe(playedSquare);
        expect(playedSquare.getAttribute("aria-disabled")).toBe("true");
      });
    });

    describe("駒を選んでから遊び方を開いた場合", () => {
      beforeEach(() => {
        tapSquare(/^4三 攻方の龍$/);
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
      });

      test("遊び方を閉じる Escape で駒の選択を解除しないこと", () => {
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

        const dragon = within(getBoard()).getByRole("button", {
          name: "4三 攻方の龍",
        });

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(dragon.getAttribute("aria-pressed")).toBe("true");
      });
    });

    test("王手にならない手は着手させないこと", () => {
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^4四$/);

      const status = screen.getByRole("status");

      expect(status.textContent).toBe("王手になりません");
      expect(
        within(getBoard()).getByRole("button", { name: "4三 攻方の龍" }),
      ).toBeTruthy();
    });
  });
});
