import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { formatTsumeShogiProblemQuery } from "@/games/tsume-shogi/diagnostics";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { createTsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { TsumeShogiPlayView } from "@/views/TsumeShogiPlayView";

const internalDiagnostics = vi.hoisted(() => ({ available: false }));

vi.mock("@/lib/internal-diagnostics", () => ({
  get internalDiagnosticsAvailable() {
    return internalDiagnostics.available;
  },
  buildRevision: null,
}));

afterEach(() => {
  cleanup();
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
      </Routes>
    </MemoryRouter>,
  );
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

// 3手詰: ▲2二銀打 △1二玉 ▲1三龍。
const specifiedProblemPath = `/puzzles/tsume-shogi/play/1?${formatTsumeShogiProblemQuery(createTsumeShogiProblemIdentity(3, 14))}`;

describe("TsumeShogiPlayView", () => {
  describe("定義済みの難易度の場合", () => {
    beforeEach(() => {
      renderAt("/puzzles/tsume-shogi/play/1");
    });

    test("9×9の盤と難易度を表示すること", () => {
      const squares = within(getBoard()).getAllByRole("button");

      expect(squares).toHaveLength(81);
      expect(screen.getByText("レベル 1")).toBeTruthy();
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

  describe("内部診断を使えないビルドで問題を指定した場合", () => {
    beforeEach(() => {
      renderAt(specifiedProblemPath);
    });

    test("指定を無視して難易度の問題を出すこと", () => {
      const difficultyLabel = screen.getByText("レベル 1");

      expect(difficultyLabel).toBeTruthy();
    });
  });

  describe("内部診断を使えるビルドで復元できない問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      renderAt("/puzzles/tsume-shogi/play/1?seed=ts-3-0&plies=7");
    });

    test("指定を復元できないことを示すこと", () => {
      const message = screen.getByText("指定された問題を復元できません");

      expect(message).toBeTruthy();
    });
  });

  describe("内部診断を使えるビルドで問題を指定した場合", () => {
    beforeEach(() => {
      internalDiagnostics.available = true;
      vi.useFakeTimers();
      renderAt(specifiedProblemPath);
    });

    test("難易度を伏せて指定した問題を出すこと", () => {
      const silverOn1a = within(getBoard()).getByRole("button", {
        name: "1一 攻方の銀",
      });

      expect(silverOn1a).toBeTruthy();
      expect(screen.getByText("問題指定")).toBeTruthy();
      expect(screen.queryByText("レベル 1")).toBeNull();
    });

    test("作意どおりに指すと玉方が応手し、詰めると詰みを示すこと", () => {
      tapHand("銀");
      tapSquare(/^2二$/);
      waitForDefenderReply();
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^1三$/);

      const cleared = screen.getByRole("region", { name: "詰み" });

      expect(cleared).toBeTruthy();
      expect(
        within(getBoard()).getByRole("button", { name: "1二 玉方の玉" }),
      ).toBeTruthy();
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

    test("王手にならない手は着手させないこと", () => {
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^4四$/);

      const status = screen.getByRole("status");

      expect(status.textContent).toBe("王手になる手だけ指せます");
      expect(
        within(getBoard()).getByRole("button", { name: "4三 攻方の龍" }),
      ).toBeTruthy();
    });
  });
});
