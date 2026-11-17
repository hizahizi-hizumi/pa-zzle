import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
  MINESWEEPER_SPEED_ZERO_SCORE_RATIO,
} from "@/games/minesweeper/score";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "マインスイーパーの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

function listHeadings(panel: HTMLElement, level: 3 | 4): (string | null)[] {
  return within(panel)
    .getAllByRole("heading", { level })
    .map((heading) => heading.textContent);
}

describe("MinesweeperHowToPlayDialog", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<MinesweeperHowToPlayDialog open onClose={vi.fn()} />);
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

    test("ルールのタブで、数字・地雷の数・完成のルールを順に並べること", () => {
      const panel = openTab("ルール");

      const rules = listHeadings(panel, 3);

      expect(rules).toEqual([
        "数字の周りの8マスにはその数だけ地雷があります。",
        "地雷が全部でいくつかは上の「地雷」に出ます。数字とこの数だけで推測しなくてもどのマスも地雷かどうかが分かります。",
        "地雷を踏んでも続けられます。地雷ではないマスがすべて開けば完成です。",
      ]);
    });

    test("操作のタブを、開き方・旗・やり直しのまとまりに分けること", () => {
      const panel = openTab("操作");

      const titles = listHeadings(panel, 3);

      expect(titles).toEqual(["開き方", "旗", "やり直し"]);
    });

    test("やり直しには、本番のメニューにあるリセットと別の問題だけを置くこと", () => {
      const panel = openTab("操作");

      const items = [
        PLAY_OPERATION_LABELS.replay,
        PLAY_OPERATION_LABELS.startNewProblem,
        PLAY_OPERATION_LABELS.undo,
        PLAY_OPERATION_LABELS.restart,
      ].map((label) => within(panel).queryByText(label) !== null);

      expect(items).toEqual([true, true, false, false]);
    });

    test("採点のタブで、結果画面と同じ順と満点の見出しを並べ、踏んだ地雷に score.ts と同じ1個ごとの減点を添えること", () => {
      const panel = openTab("採点");

      const titles = listHeadings(panel, 3);
      const measures = within(panel)
        .getAllByRole("listitem")
        .map((item) => item.firstElementChild?.textContent);

      expect(titles).toEqual([
        `正確さ ${MINESWEEPER_SCORE_MAXIMUMS.accuracy}点`,
        `速さ ${MINESWEEPER_SCORE_MAXIMUMS.speed}点`,
      ]);
      expect(measures).toEqual([
        `踏んだ地雷 1個 −${MINESWEEPER_MISTAKE_PENALTY}点`,
        "基準時間",
      ]);
    });

    test("採点のタブで、点の決まり方の文の数を score.ts の満点と速さが0点になる倍率から出すこと", () => {
      const panel = openTab("採点");

      const leads = [
        `${MINESWEEPER_SCORE_MAXIMUMS.accuracy}点から引いていきます。0点より下にはなりません。`,
        `問題ごとの基準時間以内なら満点です。超えると下がります。基準時間の${MINESWEEPER_SPEED_ZERO_SCORE_RATIO}倍で0点です。`,
      ].map((lead) =>
        // 文は文節ごとに分けて描くので、段落の文字の全体で探す。
        within(panel).queryByText(
          (_, element) =>
            element?.tagName === "P" && element.textContent === lead,
        ),
      );

      expect(leads.every((lead) => lead !== null)).toBe(true);
    });
  });
});
