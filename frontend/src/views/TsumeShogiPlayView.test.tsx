import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TsumeShogiPlayView } from "@/views/TsumeShogiPlayView";

// 仮の問題のうち、3手詰 `ts-3-14`（▲2二銀打 △1二玉 ▲1三龍）を選ぶ seed。
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

function tapHand(pieceName: string): void {
  fireEvent.click(
    within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
      "button",
      { name: new RegExp(`^${pieceName} `) },
    ),
  );
}

function waitForDefenderReply(): void {
  act(() => {
    vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
  });
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

  describe("問題を遊ぶ場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderAt("/puzzles/tsume-shogi/play/1");
    });

    test("選んだ問題の初期局面を出すこと", () => {
      const silverOn1a = within(getBoard()).getByRole("button", {
        name: "1一 攻方の銀",
      });

      expect(silverOn1a).toBeTruthy();
    });

    test("作意どおりに指すと玉方が応手し、詰めると完成演出の後に詰みを示すこと", () => {
      tapHand("銀");
      tapSquare(/^2二$/);
      waitForDefenderReply();
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^1三$/);
      act(() => {
        vi.runAllTimers();
      });

      const cleared = screen.getByRole("region", { name: "詰み" });

      expect(within(cleared).getByText("3手詰 ・ レベル 1")).toBeTruthy();
      expect(
        within(getBoard()).getByRole("button", { name: "1二 玉方の玉" }),
      ).toBeTruthy();
    });

    test("詰まない王手には玉方の反証を指し、待ったで判断地点へ戻れること", () => {
      tapSquare(/^4三 攻方の龍$/);
      tapSquare(/^4一$/);
      waitForDefenderReply();
      const refutedKing = within(getBoard()).getByRole("button", {
        name: "1二 玉方の玉",
      });
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

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
        const destination = within(getBoard()).getByRole("button", {
          name: /^2二$/,
        });
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
