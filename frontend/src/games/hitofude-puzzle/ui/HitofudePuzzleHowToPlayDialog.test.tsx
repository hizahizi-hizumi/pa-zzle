import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
  HITOFUDE_PUZZLE_SCORE_MAXIMUMS,
} from "@/games/hitofude-puzzle/score";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "一筆パズルの遊び方" });
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

describe("HitofudePuzzleHowToPlayDialog", () => {
  describe("開いた場合", () => {
    const onOpenTutorial = vi.fn();

    beforeEach(() => {
      onOpenTutorial.mockClear();
      render(
        <HitofudePuzzleHowToPlayDialog
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
      expect(onOpenTutorial).toHaveBeenCalledTimes(1);
    });

    test("ルールのタブに、チュートリアルと同じ言い方のルールを、同じマス・すべてのマス・穴の順に並べること", () => {
      const panel = openTab("ルール");

      const rules = listHeadings(panel, 3);

      expect(rules).toEqual([
        "同じマスは2回通れません。",
        "すべてのマスを通れば完成です。",
        "穴は通れません。",
      ]);
    });

    test("ルールの例に、本番の判定から求めた言葉を添えること（通れないマスのルールは手ごとの印の凡例、すべてのマスのルールは完成と、行き止まりと残りのマスの数）", () => {
      const panel = openTab("ルール");

      const names: string[] = [];
      within(panel).getAllByRole("figure", {
        name: (name) => {
          names.push(name);
          return true;
        },
      });

      expect(names).toEqual([
        "通れる、通れない",
        "完成",
        "行き止まり・1マス残る",
        "通れる、通れない",
      ]);
    });

    test("操作のタブを、引き方・やり直し・キーボードのまとまりに分けること", () => {
      const panel = openTab("操作");

      const titles = listHeadings(panel, 3);

      expect(titles).toEqual(["引き方", "やり直し", "キーボード"]);
    });

    test("採点のタブで、結果画面と同じ順と満点の見出しを並べ、引き直しに score.ts と同じ1回ごとの減点を添えること", () => {
      const panel = openTab("採点");

      const titles = listHeadings(panel, 3);
      const measures = within(panel)
        .getAllByRole("listitem")
        .map((item) => item.firstElementChild?.textContent);

      expect(titles).toEqual([
        `速さ ${HITOFUDE_PUZZLE_SCORE_MAXIMUMS.speed}点`,
        `正確さ ${HITOFUDE_PUZZLE_SCORE_MAXIMUMS.accuracy}点`,
      ]);
      expect(measures).toEqual([
        "基準時間",
        `引き直し 1回 −${HITOFUDE_PUZZLE_BACKTRACK_PENALTY}点`,
        `「${PLAY_OPERATION_LABELS.undo}」・「${PLAY_OPERATION_LABELS.restart}」`,
      ]);
    });

    test("採点のタブの正確さの一文で、score.ts の満点と1回ごとの減点から求めた0点になる引き直しの回数を言うこと", () => {
      const panel = openTab("採点");

      const zero = Math.ceil(
        HITOFUDE_PUZZLE_SCORE_MAXIMUMS.accuracy /
          HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
      );

      expect(panel.textContent).toContain(`引き直し${zero}回で0点です。`);
    });

    test("採点のタブの引き直しの図に、本番の session で数えた回数を、流れごとに添えること", () => {
      const panel = openTab("採点");

      const captions = within(panel)
        .getAllByRole("figure")
        .map((figure) => figure.querySelector("figcaption")?.textContent);

      expect(captions).toEqual([
        "戻して同じマスへ引く → 引き直し 0回",
        "戻して違うマスへ引く → 引き直し 1回",
        `違う道へ引いてから「${PLAY_OPERATION_LABELS.undo}」で戻す → 引き直し 2回`,
      ]);
    });

    test("採点のタブの引き直しの図で、押す手のコマに押したマスの枠を付け、引き直しが増えた操作の矢印に増えた回数を添えること", () => {
      const panel = openTab("採点");

      const figures = within(panel)
        .getAllByRole("figure")
        .map((figure) => ({
          arrows: figure.textContent?.replace(
            figure.querySelector("figcaption")?.textContent ?? "",
            "",
          ),
          pressed: Array.from(
            figure.querySelectorAll("[data-pressed-cell]"),
            (frame) => frame.getAttribute("data-pressed-cell"),
          ),
        }));

      expect(figures).toEqual([
        { arrows: "押すなぞる", pressed: ["1"] },
        { arrows: "押すなぞる＋1回", pressed: ["0"] },
        {
          arrows: `押してなぞる＋1回${PLAY_OPERATION_LABELS.undo}＋1回`,
          pressed: ["0"],
        },
      ]);
    });
  });
});
