import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { magicSquareBoardSizes } from "@/games/magic-square/problem/problem";
import {
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
} from "@/games/magic-square/puzzle/board";
import { MAGIC_SQUARE_MEMO_CAPACITY } from "@/games/magic-square/puzzle/rules";
import {
  MAGIC_SQUARE_CORRECTION_PENALTY,
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
  MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
} from "@/games/magic-square/score";
import { MagicSquareHowToPlayDialog } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog";
import { MAGIC_SQUARE_EXAMPLE_SIZE } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
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

    test("ルールの後ろに、例の盤面と違う大きさの盤面のまとまりを置き、使う数とそろえる合計を本番の盤面と同じ値で言うこと", () => {
      const panel = within(getDialog()).getByRole("tabpanel", {
        name: "ルール",
      });
      const otherSizes = magicSquareBoardSizes.filter(
        (size) => size !== MAGIC_SQUARE_EXAMPLE_SIZE,
      );

      const section = within(panel)
        .getByRole("heading", {
          level: 3,
          name: `${otherSizes.map((size) => `${size}×${size}`).join("と")}の盤面`,
        })
        .closest("section");

      const rows = within(section as HTMLElement)
        .getAllByRole("row")
        .map((row) =>
          Array.from(
            row.querySelectorAll("th, td"),
            (cell) => cell.textContent,
          ),
        );

      expect(rows).toEqual([
        ["盤面", "置く数", "左上の合計"],
        ...otherSizes.map((size) => [
          `${size}×${size}`,
          `1〜${getMagicSquareMaxValue(size)}`,
          String(getMagicSquareMagicSum(size)),
        ]),
      ]);
    });

    test("ルールの例を、本番の盤面部品で描いた触れる例として、元に戻すボタンのある面に置くこと", () => {
      const panel = within(getDialog()).getByRole("tabpanel", {
        name: "ルール",
      });

      const resetButtons = within(panel).getAllByRole("button", {
        name: "例を元に戻す",
      });
      const boards = within(panel).getAllByRole("group", {
        name: "魔方陣の盤面",
      });

      expect(resetButtons).toHaveLength(3);
      expect(boards).toHaveLength(4);
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

    test("採点のタブで、置き直し1回ごとの減点を score.ts と同じ値で添えること", () => {
      const panel = openTab("採点");

      const deduction = within(panel).getByText(
        `1回 −${MAGIC_SQUARE_CORRECTION_PENALTY}点`,
      );

      expect(deduction).toBeTruthy();
    });

    test("採点のタブで、基準時間の決まり方を score.ts の式と同じ値で言うこと", () => {
      const panel = openTab("採点");

      const [row] = within(panel).getAllByRole("listitem");

      expect(row?.textContent).toBe(
        `基準時間空いたマス1つにつき${MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS / 1000}秒ずつ${MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS / 1000}秒に足します。`,
      );
    });

    test("採点のタブで、置き直しの数え方と1つの例外、待った・盤面を戻すで外れた数の数え方を言うこと", () => {
      const panel = openTab("採点");

      const rows = within(panel)
        .getAllByRole("listitem")
        .map((row) => row.textContent ?? "");
      const correction = rows.find((row) => row.startsWith("置き直し"));
      const pressed = rows.find((row) => row.startsWith("「待った」"));

      expect(correction).toContain(
        `置き直し 1回 −${MAGIC_SQUARE_CORRECTION_PENALTY}点置いた数が外れるたびに画面の上の「置き直し」が増えます。ただし列の端の色を変えなかった数はほかのマスを選ぶ前に直せば数えません。`,
      );
      expect(pressed).toBe(
        "「待った」・「盤面を戻す」「待った」で外れた数も同じように数えます。「盤面を戻す」で外れた数はどれも数えます。",
      );
    });

    test("操作のタブで、置き方・やり直し・メモの順にまとまりを並べ、待ったの図を押せない図にすること", () => {
      const panel = openTab("操作");

      const titles = within(panel)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);
      const undoFigure = within(panel)
        .getAllByRole("button", { name: "待った", hidden: true })
        .find((button) => button.closest("[inert]") !== null);

      expect(titles).toEqual(["置き方", "やり直し", "メモ"]);
      expect(undoFigure?.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    test("操作のタブで、メモを書ける数を本番の上限と同じ値で言うこと", () => {
      const panel = openTab("操作");

      expect(panel.textContent).toContain(
        `メモを1マスに${MAGIC_SQUARE_MEMO_CAPACITY}つまで書けます。`,
      );
    });
  });
});
