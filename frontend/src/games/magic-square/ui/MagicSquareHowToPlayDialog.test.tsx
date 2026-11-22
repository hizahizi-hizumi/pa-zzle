import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_WITHDRAWAL_PENALTY,
} from "@/games/magic-square/score";
import { MagicSquareHowToPlayDialog } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog";
import { SCORE_ITEM_LABELS } from "@/games/play-vocabulary";

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "魔方陣の遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

describe("MagicSquareHowToPlayDialog", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<MagicSquareHowToPlayDialog open onClose={vi.fn()} />);
    });

    test("ルール・操作・採点のタブを、ルールを開いて置くこと", () => {
      const tabs = within(getDialog())
        .getAllByRole("tab")
        .map((tab) => [tab.textContent, tab.getAttribute("aria-selected")]);

      expect(tabs).toEqual([
        ["ルール", "true"],
        ["操作", "false"],
        ["採点", "false"],
      ]);
    });

    test("ルールの図を本番の盤面部品で描き、違反の2種を違反として描くこと", () => {
      const panel = within(getDialog()).getByRole("tabpanel", {
        name: "ルール",
      });

      const violations = [
        "1行目の合計 36 埋まって合計と違う",
        "1列目の合計 34 空きがあるのに合計に届いた",
      ].map((text) => within(panel).queryAllByText(text).length);

      expect(violations.every((count) => count > 0)).toBe(true);
    });

    test("ルールで、出す盤面の大きさごとのそろえる合計を言うこと", () => {
      const panel = within(getDialog()).getByRole("tabpanel", {
        name: "ルール",
      });

      const phrases = ["4×4なら34、", "5×5なら65、", "6×6なら111で"].map(
        (text) => within(panel).queryAllByText(text).length,
      );

      expect(phrases.every((count) => count > 0)).toBe(true);
    });

    test("採点のタブで、結果画面と同じ順と満点の見出しを並べること", () => {
      const panel = openTab("採点");

      const titles = within(panel)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);

      expect(titles).toEqual(
        Object.entries(MAGIC_SQUARE_SCORE_MAXIMUMS).map(
          ([item, maximum]) =>
            `${SCORE_ITEM_LABELS[item as keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS]} ${maximum}点`,
        ),
      );
    });

    test("採点のタブで、取り下げ1回ごとの減点を score.ts と同じ値で添えること", () => {
      const panel = openTab("採点");

      const deduction = within(panel).getByText(
        `1回 −${MAGIC_SQUARE_WITHDRAWAL_PENALTY}点`,
      );

      expect(deduction).toBeTruthy();
    });
  });
});
