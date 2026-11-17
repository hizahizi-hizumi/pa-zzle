import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  calculateNanpureSpeedScoreRule,
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import { calculateSpeedScore } from "@/games/score";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

const MINUTE_MS = 60 * 1_000;
const speedRule = calculateNanpureSpeedScoreRule();
const speedStepMs = speedRule.overtimeStepMs ?? MINUTE_MS;
const speedPointsPerStep =
  NANPURE_SCORE_MAXIMUMS.speed -
  calculateSpeedScore(
    NANPURE_SCORE_MAXIMUMS.speed,
    speedRule.fullScoreMs + speedStepMs,
    speedRule,
  );

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "ナンプレの遊び方" });
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

describe("NanpureHowToPlayDialog", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<NanpureHowToPlayDialog open onClose={vi.fn()} />);
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

    test("ルールのタブに、行・列・ブロックと最初からある数字のルールを、この順に並べること", () => {
      const panel = within(getDialog()).getByRole("tabpanel", {
        name: "ルール",
      });

      const rules = listSectionTitles(panel);

      expect(rules).toEqual([
        "どの行にも1〜9が1つずつ入ります。",
        "どの列にも1〜9が1つずつ入ります。",
        "太線で区切ったブロックにも1〜9が1つずつ入ります。",
        "最初からある数字は変えられません。",
      ]);
    });

    test("操作のタブを、入れ方・メモ・消し方・やり直しのまとまりに分けること", () => {
      const panel = openTab("操作");

      const titles = listSectionTitles(panel);

      expect(titles).toEqual(["入れ方", "メモ", "消し方", "やり直し"]);
    });

    test("採点のタブで、結果画面と同じ順と満点の見出しを並べること", () => {
      const panel = openTab("採点");

      const titles = listSectionTitles(panel);

      expect(titles).toEqual([
        `${SCORE_ITEM_LABELS.accuracy} ${NANPURE_SCORE_MAXIMUMS.accuracy}点`,
        `${SCORE_ITEM_LABELS.speed} ${NANPURE_SCORE_MAXIMUMS.speed}点`,
        `${SCORE_ITEM_LABELS.stability} ${NANPURE_SCORE_MAXIMUMS.stability}点`,
      ]);
    });

    test("採点のタブで、数えるものを結果画面の採点基準と同じ順に score.ts と同じ1回ごとの減点を添えて並べること", () => {
      const panel = openTab("採点");

      const measures = within(panel)
        .getAllByRole("listitem")
        .map((item) => item.firstElementChild?.textContent);

      expect(measures).toEqual([
        `ミス 1回 −${NANPURE_MISTAKE_PENALTY}点`,
        "基準時間",
        "超えた時間",
        `${PLAY_OPERATION_LABELS.undo} 1回 −${NANPURE_UNDO_PENALTY}点`,
        `${PLAY_OPERATION_LABELS.restart} 1回 −${NANPURE_RESTART_PENALTY}点`,
        `${PLAY_OPERATION_LABELS.replay}・${PLAY_OPERATION_LABELS.startNewProblem}`,
      ]);
    });

    test("採点のタブの速さで、score.ts の規則と同じ基準時間・刻み・0点になる時間を言うこと", () => {
      const panel = openTab("採点");

      const text = panel.textContent ?? "";

      expect(text).toContain(
        `どの問題も${speedRule.fullScoreMs / MINUTE_MS}分です。`,
      );
      expect(text).toContain(
        `超えると${speedStepMs / MINUTE_MS}分ごとに${speedPointsPerStep}点下がって${speedRule.zeroScoreMs / MINUTE_MS}分で0点です。`,
      );
    });

    test("採点のタブのミスの図に、流れごとの数え方を添えること", () => {
      const panel = openTab("採点");

      const captions = within(panel)
        .getAllByRole("figure")
        .map((figure) => figure.querySelector("figcaption")?.textContent);

      expect(captions).toEqual([
        `入れてから「${PLAY_OPERATION_LABELS.undo}」で取り消す → ミス 1回`,
        "入れてから正しい数字に入れ替える → ミス 1回",
      ]);
    });
  });
});
