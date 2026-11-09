import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import {
  TAKUZU_CORRECTION_PENALTY,
  TAKUZU_RESTART_PENALTY,
  TAKUZU_SCORE_MAXIMUMS,
  TAKUZU_UNDO_PENALTY,
} from "@/games/takuzu/score";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "バイナリパズルの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

function listSectionTitles(panel: HTMLElement): (string | null)[] {
  return within(panel)
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
}

describe("TakuzuHowToPlayDialog", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuHowToPlayDialog open onClose={vi.fn()} />);
    });

    test("開いたときに、閉じるボタンではなく見出しにフォーカスを置き、Tab で最初に閉じるボタンへ進めること", () => {
      const heading = within(getDialog()).getByRole("heading", {
        name: "バイナリパズルの遊び方",
      });

      const [firstTabbable] = getDialog().querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );

      expect(document.activeElement).toBe(heading);
      expect(firstTabbable?.getAttribute("aria-label")).toBe("閉じる");
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

    test("ゴールの盤面を、1つだけ描くこと", () => {
      const goals = within(getDialog()).getAllByRole("img", {
        name: "ゴールの盤面",
      });

      expect(goals).toHaveLength(1);
    });

    test("操作のタブを、置き方・やり直し・キーボードのまとまりに分けること", () => {
      const panel = openTab("操作");

      const titles = listSectionTitles(panel);

      expect(titles).toEqual(["置き方", "やり直し", "キーボード"]);
    });

    test("採点のタブで、結果画面と同じ順と満点の見出しを並べること", () => {
      const panel = openTab("採点");

      const titles = listSectionTitles(panel);

      expect(titles).toEqual([
        `正確さ ${TAKUZU_SCORE_MAXIMUMS.accuracy}点`,
        `速さ ${TAKUZU_SCORE_MAXIMUMS.speed}点`,
      ]);
    });

    test("採点のタブで、正確さで数えるものを結果画面の採点基準と同じ順に score.ts と同じ1回ごとの減点を添えて並べ、速さに基準時間の項目を置くこと", () => {
      const panel = openTab("採点");

      const measures = within(panel)
        .getAllByRole("listitem")
        .map((item) => item.firstElementChild?.textContent);

      expect(measures).toEqual([
        `置き直し 1回 −${TAKUZU_CORRECTION_PENALTY}点`,
        `${PLAY_OPERATION_LABELS.restart} 1回 −${TAKUZU_RESTART_PENALTY}点`,
        `${PLAY_OPERATION_LABELS.undo} 1回 −${TAKUZU_UNDO_PENALTY}点`,
        "基準時間",
      ]);
    });

    test("採点のタブの置き直しの図に、押し方ごとの数え方を添えること", () => {
      const panel = openTab("採点");

      const captions = within(panel)
        .getAllByRole("figure")
        .map((figure) => figure.querySelector("figcaption")?.textContent);

      expect(captions).toEqual([
        "同じマスを続けて押す → 置き直し 0回",
        "ほかのマスから戻って変える → 置き直し 1回",
      ]);
    });
  });

  describe("採点のタブで閉じて開き直した場合", () => {
    const onClose = vi.fn();

    beforeEach(() => {
      onClose.mockClear();
      const { rerender } = render(
        <TakuzuHowToPlayDialog open onClose={onClose} />,
      );
      openTab("採点");
      fireEvent.click(
        within(getDialog()).getByRole("button", { name: "閉じる" }),
      );
      rerender(<TakuzuHowToPlayDialog open={false} onClose={onClose} />);
      rerender(<TakuzuHowToPlayDialog open onClose={onClose} />);
    });

    test("前に開いていたタブによらず、ルールのタブから始めること", () => {
      const selected = within(getDialog())
        .getAllByRole("tab")
        .filter((tab) => tab.getAttribute("aria-selected") === "true")
        .map((tab) => tab.textContent);

      expect(onClose).toHaveBeenCalled();
      expect(selected).toEqual(["ルール"]);
    });
  });

  describe("操作のタブのキーボードの表を、本番の盤面で使う場合", () => {
    const onPlaceCell = vi.fn();
    const cellViews: TakuzuCellView[] = Array.from({ length: 4 }, () => ({
      cell: null,
      given: false,
      inViolatingRun: false,
    }));
    const placedCellByDescription: Readonly<Record<string, TakuzuCell>> = {
      "四角を置きます。": "a",
      "丸を置きます。": "b",
      "空きにします。": null,
    };
    const arrowKeyByLabel: Readonly<Record<string, string>> = {
      "↑": "ArrowUp",
      "↓": "ArrowDown",
      "←": "ArrowLeft",
      "→": "ArrowRight",
    };
    // 2×2 の盤面の左上から、下・右・上・左と動かすと、左下・右下・右上・左上と巡る。
    const arrowTour = [
      ["↓", "2行1列 空き"],
      ["→", "2行2列 空き"],
      ["↑", "1行2列 空き"],
      ["←", "1行1列 空き"],
    ] as const;

    let keyRows: { keys: string[]; description: string }[] = [];

    function readKeyRows(): { keys: string[]; description: string }[] {
      const panel = openTab("操作");
      const terms = within(panel).getAllByRole("term");
      const definitions = within(panel).getAllByRole("definition");
      return terms.map((term, index) => ({
        keys: [...term.querySelectorAll("kbd")].map(
          (key) => key.textContent ?? "",
        ),
        description: definitions[index]?.textContent ?? "",
      }));
    }

    // 遊び方の層は開いている間ほかの所を読み上げとフォーカスから外すので、表を読んでから閉じ、本番の盤面を描く。
    beforeEach(() => {
      onPlaceCell.mockClear();
      render(<TakuzuHowToPlayDialog open onClose={vi.fn()} />);
      keyRows = readKeyRows();
      cleanup();
      render(
        <TakuzuBoard
          size={2}
          cells={cellViews}
          lineViolations={[]}
          operation={null}
          interactionDisabled={false}
          onCycleCell={vi.fn()}
          onPlaceCell={onPlaceCell}
        />,
      );
      screen.getByRole("button", { name: "1行1列 空き" }).focus();
    });

    test("置くキーを本番の盤面で押すと、表の説明どおりのものを置くこと", () => {
      const rows = keyRows.filter(
        ({ description }) => description in placedCellByDescription,
      );
      const board = screen.getByRole("group", { name: "バイナリパズル盤面" });

      const placed = rows.flatMap(({ keys }) =>
        keys.map((key) => {
          onPlaceCell.mockClear();
          fireEvent.keyDown(board, { key });
          return onPlaceCell.mock.calls[0]?.[1];
        }),
      );

      expect(placed).toEqual(
        rows.flatMap(({ keys, description }) =>
          keys.map(() => placedCellByDescription[description]),
        ),
      );
      expect(rows.map(({ keys }) => keys)).toEqual([
        ["1"],
        ["2"],
        ["0", "Delete", "Backspace"],
      ]);
    });

    test("矢印キーを本番の盤面で押すと、表の説明どおりマスを選ぶこと", () => {
      const arrowRow = keyRows.find(
        ({ description }) => description === "マスを選びます。",
      );
      const board = screen.getByRole("group", { name: "バイナリパズル盤面" });

      const focused = arrowTour.map(([label]) => {
        fireEvent.keyDown(board, { key: arrowKeyByLabel[label] });
        return document.activeElement?.getAttribute("aria-label");
      });

      expect([...(arrowRow?.keys ?? [])].sort()).toEqual(
        Object.keys(arrowKeyByLabel).sort(),
      );
      expect(focused).toEqual(arrowTour.map(([, cell]) => cell));
    });
  });
});
