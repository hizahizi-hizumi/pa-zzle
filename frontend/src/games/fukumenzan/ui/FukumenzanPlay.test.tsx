import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import { createFukumenzanResult } from "@/games/fukumenzan/play/use-fukumenzan-play";
import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";
import type { FukumenzanSessionResult } from "@/games/fukumenzan/session/session";
import { FukumenzanPlay } from "@/games/fukumenzan/ui/FukumenzanPlay";

/** 結果画面はブランドの帯からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "elementFromPoint");
});

// 文字は B Y K T H の順。
const problem: FukumenzanProblem = { addends: ["BYK", "KTK"], result: "TKHH" };
const emptyState: FukumenzanPuzzleState = {
  placedDigits: [null, null, null, null, null],
  crossedDigits: [[], [], [], [], []],
};
// 基準時間は 105秒。
const performance: FukumenzanSessionResult = {
  elapsedMs: 126_000,
  undoCount: 2,
  restartCount: 1,
  placeCount: 7,
  returnCount: 1,
  crossToggleCount: 12,
};
const result = createFukumenzanResult(performance, {
  letterCount: 5,
  letterCellCount: 10,
});
const touch = { pointerType: "touch", button: 0, isPrimary: true };

describe("FukumenzanPlay", () => {
  const callbacks = {
    onPlaceDigit: vi.fn(),
    onReturnDigit: vi.fn(),
    onToggleCross: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    renderSettingsDialog: () => null,
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
  };
  const baseProps: ComponentProps<typeof FukumenzanPlay> = {
    difficulty: "1",
    progress: "playing",
    elapsedMs: performance.elapsedMs,
    result: null,
    recordFeedback: { kind: "none" },
    problem,
    letters: ["B", "Y", "K", "T", "H"],
    puzzleState: emptyState,
    leadingZeroLetters: [],
    miscalculatedColumns: [],
    undoCount: performance.undoCount,
    crossUndoNotice: null,
    operation: null,
    canUndo: true,
    canRestart: true,
    ...callbacks,
  };

  function renderPlay(props: Partial<ComponentProps<typeof FukumenzanPlay>>) {
    return render(<FukumenzanPlay {...baseProps} {...props} />);
  }

  function getEquation() {
    return within(screen.getByRole("group", { name: "式" }));
  }

  function getCardRow() {
    return within(screen.getByRole("group", { name: "札" }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay({ progress: "clearing", result });
    });

    test("式を見せ、結果画面をまだ出さないこと", () => {
      const equation = screen.queryByRole("group", { name: "式" });
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(equation).not.toBeNull();
      expect(resultScreen).toBeNull();
    });

    test("札と文字を押しても札を入れる操作を通知しないこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "5 の札" }));
      fireEvent.click(getEquation().getAllByRole("button", { name: "K" })[0]!);

      expect(callbacks.onPlaceDigit).not.toHaveBeenCalled();
    });
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay({});
    });

    test("見出しに時間と待ったの回数を表示すること", () => {
      const header = screen.getByRole("heading", {
        name: FUKUMENZAN_DISPLAY_NAME,
      }).parentElement!;
      const metrics = within(header)
        .getAllByText(/^(時間|待った)$/)
        .map(
          (label) => `${label.textContent} ${label.nextSibling?.textContent}`,
        );

      expect(metrics).toEqual(["時間 02:06", "待った 2"]);
    });

    describe("札を運んで指を離した場合", () => {
      beforeEach(() => {
        const card = getCardRow().getByRole("button", { name: "8 の札" });
        const target = getEquation().getByRole("button", { name: "Y" });
        // 指の下の文字だけを落とし先として返す。描いた札の下（指より上）には文字が無い。
        document.elementFromPoint = vi.fn((x: number, y: number) =>
          x === 100 && y === 200 ? target : null,
        );
        fireEvent.pointerDown(card, {
          ...touch,
          pointerId: 1,
          clientX: 100,
          clientY: 500,
        });
        fireEvent.pointerMove(card, {
          ...touch,
          pointerId: 1,
          clientX: 100,
          clientY: 300,
        });
        fireEvent.pointerUp(card, {
          ...touch,
          pointerId: 1,
          clientX: 100,
          clientY: 200,
        });
      });

      test("指の下の文字に札を入れる操作を通知すること", () => {
        expect(callbacks.onPlaceDigit).toHaveBeenCalledWith(1, 8);
      });
    });

    describe("札を運ぶ途中で2本目の指を離した場合", () => {
      beforeEach(() => {
        const card = getCardRow().getByRole("button", { name: "8 の札" });
        const otherCard = getCardRow().getByRole("button", { name: "3 の札" });
        document.elementFromPoint = vi.fn(() => null);
        fireEvent.pointerDown(card, {
          ...touch,
          pointerId: 1,
          clientX: 100,
          clientY: 500,
        });
        fireEvent.pointerMove(card, {
          ...touch,
          pointerId: 1,
          clientX: 100,
          clientY: 300,
        });
        fireEvent.pointerDown(otherCard, {
          ...touch,
          pointerId: 2,
          isPrimary: false,
        });
        fireEvent.pointerUp(otherCard, {
          ...touch,
          pointerId: 2,
          isPrimary: false,
        });
        fireEvent.pointerCancel(otherCard, {
          ...touch,
          pointerId: 2,
          isPrimary: false,
        });
      });

      test("1本目の指で運んでいる札を残し、元の場所を薄く描いたままにすること", () => {
        const draggedCards = screen.getAllByText("8");

        // 列に残す薄い姿と、運んでいる札。
        expect(draggedCards).toHaveLength(2);
        expect(callbacks.onPlaceDigit).not.toHaveBeenCalled();
      });
    });
  });

  describe("× を付けた空の文字がある場合", () => {
    beforeEach(() => {
      renderPlay({
        puzzleState: { ...emptyState, crossedDigits: [[0, 7], [], [], [], []] },
      });
    });

    test("選んでいないときも、式のマスに残りの候補の数を示すこと", () => {
      const tile = getEquation().getByRole("button", { name: "B（候補 8）" });

      expect(tile.textContent).toBe("B8");
    });
  });

  describe("文字を選んだ場合", () => {
    beforeEach(() => {
      renderPlay({});
      fireEvent.click(getEquation().getAllByRole("button", { name: "K" })[0]!);
    });

    test("式と札の列の外を押すと、選びを外すこと", () => {
      fireEvent.pointerDown(document.body);

      expect(getEquation().queryAllByRole("button", { pressed: true })).toEqual(
        [],
      );
    });

    test("札の列を押しても、選びを外さないこと", () => {
      fireEvent.pointerDown(
        getCardRow().getByRole("button", { name: "2 の札" }),
      );

      expect(
        getEquation().getAllByRole("button", { pressed: true }).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("待ったで × を戻した知らせを受けた場合", () => {
    beforeEach(() => {
      const crossed: FukumenzanPuzzleState = {
        ...emptyState,
        crossedDigits: [[], [], [2], [], []],
      };
      const { rerender } = renderPlay({ puzzleState: crossed });
      rerender(
        <FukumenzanPlay
          {...baseProps}
          puzzleState={crossed}
          crossUndoNotice={{ id: 1, letter: 2 }}
        />,
      );
    });

    test("その文字を選び、札の上に戻った × を見せること", () => {
      const selectedTiles = getEquation()
        .getAllByRole("button", { pressed: true })
        .map((tile) => tile.getAttribute("aria-label"));
      const crossedCard = getCardRow().queryByRole("button", {
        name: "2 の札（×）",
      });

      expect(selectedTiles).toEqual([
        "K（候補 9）",
        "K（候補 9）",
        "K（候補 9）",
        "K（候補 9）",
      ]);
      expect(crossedCard).not.toBeNull();
    });
  });
});
