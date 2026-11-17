import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  BRIDGES_SCORE_MAXIMUMS,
  BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE,
} from "@/games/bridges/score";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "ブリッジパズルの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

function listHeadings(panel: HTMLElement, level: number): (string | null)[] {
  return within(panel)
    .getAllByRole("heading", { level })
    .map((heading) => heading.textContent);
}

describe("BridgesHowToPlayDialog", () => {
  describe("開いた場合", () => {
    const onOpenTutorial = vi.fn();
    const menuItems = Object.values(PLAY_OPERATION_LABELS).filter(
      (label) => label !== PLAY_OPERATION_LABELS.undo,
    );

    beforeEach(() => {
      onOpenTutorial.mockClear();
      render(
        <BridgesHowToPlayDialog
          open
          onClose={vi.fn()}
          onOpenTutorial={onOpenTutorial}
        />,
      );
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

    test("ゴールの盤面を1つだけ描き、その下からチュートリアルを始められること", () => {
      const goals = within(getDialog()).getAllByRole("img", {
        name: "ゴールの盤面",
      });

      fireEvent.click(
        within(getDialog()).getByRole("button", {
          name: "チュートリアルで遊んで覚える",
        }),
      );

      expect(goals).toHaveLength(1);
      expect(onOpenTutorial).toHaveBeenCalledOnce();
    });

    test("ルールのタブに、数字・つながり・交差のルールを、この順に並べること", () => {
      const panel = openTab("ルール");

      expect(listHeadings(panel, 3)).toEqual([
        "島から出す橋は数字と同じ本数にします。",
        "全部の島を1つにつなげます。",
        "ほかの橋と交差する橋は架けられません。",
      ]);
    });

    test("ルールのタブに、例の盤面を5つ並べること", () => {
      const panel = openTab("ルール");
      const boards = within(panel).getAllByRole("group", { name: /盤面/ });

      expect(boards).toHaveLength(5);
    });

    test("操作のタブに、架け方・やり直し・キーボードのまとまりを並べること", () => {
      const panel = openTab("操作");

      expect(listHeadings(panel, 3)).toEqual([
        "架け方",
        "やり直し",
        "キーボード",
      ]);
      expect(listHeadings(panel, 4)).toEqual([
        "島と島の間を押すたびに橋が1本・2本・なしの順に変わります。",
        "島から相手の島へなぞっても架かります。",
        "島を押してから相手の島を押しても架かります。",
        "縦と横の橋が交差する所を押してもどちらの橋も架かりません。島からなぞると架かります。",
        "右クリックするとなし・2本・1本の順に変わります。",
      ]);
    });

    test("やり直しのまとまりに、本番の待ったのボタンとメニューの操作を並べること", () => {
      const panel = openTab("操作");
      const undoText = within(panel).queryByText(
        `「${PLAY_OPERATION_LABELS.undo}」を`,
      );
      const menuTexts = menuItems.map((label) =>
        within(panel).queryByText(label),
      );

      expect(undoText).not.toBeNull();
      expect(menuTexts.every((text) => text !== null)).toBe(true);
    });

    test("採点のタブに、結果画面と同じ速さの満点を出すこと", () => {
      const panel = openTab("採点");

      expect(listHeadings(panel, 3)).toEqual([
        `速さ ${BRIDGES_SCORE_MAXIMUMS.speed}点`,
      ]);
    });

    test("採点のタブに、0点になる時間の幅を score.ts の倍率から出すこと", () => {
      const panel = openTab("採点");
      // 文は文節ごとの要素に分けて描くので、まとまりの文字として確かめる。
      const scoringText = panel.textContent;

      expect(scoringText).toContain(
        `基準時間の${BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE.min}〜${BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE.max}倍です。`,
      );
    });
  });

  describe("操作のタブで、島を選んでから押す例の島を選んだ場合", () => {
    const onClose = vi.fn();
    let pairBoard: HTMLElement;

    beforeEach(() => {
      onClose.mockClear();
      render(<BridgesHowToPlayDialog open onClose={onClose} />);
      const panel = openTab("操作");
      pairBoard = within(panel).getAllByRole("group", { name: /盤面/ })[2]!;
      // 3×3 の盤面（周りに 0.4 マスの海）を、マス1つ 100px で置き、右上の3を押して離す。
      vi.spyOn(pairBoard, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 380, 380),
      );
      const islandThree = {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: 290,
        clientY: 90,
      };
      fireEvent.pointerDown(pairBoard, islandThree);
      fireEvent.pointerUp(pairBoard, islandThree);
    });

    test("Esc を押すと、遊び方を閉じずに島の選びを解き、島を選ぶ手がかりに戻すこと", () => {
      const hintBefore = pairBoard.parentElement
        ?.querySelector("[data-hint]")
        ?.getAttribute("data-hint");
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      const hintAfter = pairBoard.parentElement
        ?.querySelector("[data-hint]")
        ?.getAttribute("data-hint");

      expect(hintBefore).toBe("pair");
      expect(onClose).not.toHaveBeenCalled();
      expect(hintAfter).toBe("select");
    });

    test("選びを解いた後にもう一度 Esc を押すと、遊び方を閉じること", () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
