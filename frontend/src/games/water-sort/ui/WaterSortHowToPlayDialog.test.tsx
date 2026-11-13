import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import {
  calculateWaterSortPlayScore,
  calculateWaterSortSpeedFullScoreMs,
  WATER_SORT_SCORE_MAXIMUMS,
  WATER_SORT_SPEED_ZERO_SCORE_RATIO,
} from "@/games/water-sort/score";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

const { undo, restart } = PLAY_OPERATION_LABELS;

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "ウォーターソートの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

/**
 * 文節ごとに区切って描いた文も1つの文として探す、文字の一致。文全体を持つ要素のうち、いちばん内側のものに当たる。
 */
function hasWholeText(text: string) {
  return (_content: string, element: Element | null): boolean =>
    element !== null &&
    element.textContent === text &&
    Array.from(element.children).every((child) => child.textContent !== text);
}

function listHeadings(panel: HTMLElement, level: 3 | 4): (string | null)[] {
  return within(panel)
    .getAllByRole("heading", { level })
    .map((heading) => heading.textContent);
}

describe("WaterSortHowToPlayDialog", () => {
  beforeEach(() => {
    render(<WaterSortHowToPlayDialog open onClose={vi.fn()} />);
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

  describe("ルールのタブの場合", () => {
    let panel: HTMLElement;

    beforeEach(() => {
      panel = within(getDialog()).getByRole("tabpanel", { name: "ルール" });
    });

    test("中心のルールから順に一文を並べること", () => {
      const rules = listHeadings(panel, 3);

      expect(rules).toEqual([
        "いちばん上の色が同じでまだ入るボトルに注げます。空のボトルにも注げます。",
        "上から同じ色が重なっていれば入るだけまとめて注ぎます。",
        "1色でいっぱいになったボトルはもう選べません。",
        "どこにも注げないボトルは選べません。",
      ]);
    });
  });

  describe("操作のタブを開いた場合", () => {
    let panel: HTMLElement;

    beforeEach(() => {
      panel = openTab("操作");
    });

    test("注ぎ方・やり直し・手詰まりのまとまりに分けること", () => {
      const titles = listHeadings(panel, 3);

      expect(titles).toEqual(["注ぎ方", "やり直し", "手詰まり"]);
    });

    test("手詰まりの知らせを、押せない1枚の絵として、プレイ画面と同じ姿で見せること", () => {
      const figure = within(panel).getByRole("img", {
        name: "手詰まりの盤面と知らせ",
      });
      const notice = within(figure).queryByText("手詰まり");
      const pressableButtons = within(figure).queryAllByRole("button");

      expect(notice).not.toBeNull();
      expect(pressableButtons).toEqual([]);
    });
  });

  describe("採点のタブを開いた場合", () => {
    const measures = [
      "クリア手数",
      "基準時間",
      "総手数",
      "手戻り",
      `「${undo}」・「${restart}」`,
    ];
    const leads = [
      "クリア手数が最短の手数より多いほど下がります。最短の手数の2倍で0点です。",
      `問題ごとの基準時間以内なら満点です。超えると下がります。基準時間の${WATER_SORT_SPEED_ZERO_SCORE_RATIO}倍で0点です。`,
      "手戻りが多いほど下がります。最短の手数と同じ数になると0点です。",
    ];
    /** 0点になると言う所を確かめる問題。 */
    const zeroScoreProblem = { optimalMoveCount: 4, colorCount: 3 };
    const stepLabels = [
      ["注ぐ", undo],
      ["2手注ぐ", restart],
    ];
    const flowCaptions = [
      "1手ずつ取り消す → 手戻り 1手",
      "まとめて取り消す → 手戻り 2手",
    ];
    let panel: HTMLElement;

    beforeEach(() => {
      panel = openTab("採点");
    });

    test("結果画面と同じ順と満点の見出しを並べること", () => {
      const titles = listHeadings(panel, 3);

      expect(titles).toEqual([
        `効率 ${WATER_SORT_SCORE_MAXIMUMS.efficiency}点`,
        `速さ ${WATER_SORT_SCORE_MAXIMUMS.speed}点`,
        `正確さ ${WATER_SORT_SCORE_MAXIMUMS.accuracy}点`,
      ]);
    });

    test("数えるものを結果画面の採点基準と同じ呼び名で、同じ順に並べること", () => {
      const named = within(panel)
        .getAllByRole("listitem")
        .map(
          (item, index) =>
            within(item).queryByText(hasWholeText(measures[index] ?? "")) !==
            null,
        );

      expect(named).toEqual(measures.map(() => true));
    });

    test("どこで0点になるかを、点ごとの文で言うこと", () => {
      const shown = leads.map(
        (lead) => within(panel).queryByText(hasWholeText(lead)) !== null,
      );

      expect(shown).toEqual(leads.map(() => true));
    });

    test("0点になると言う所で、本番の点の計算も0点になること", () => {
      const { breakdown } = calculateWaterSortPlayScore({
        ...zeroScoreProblem,
        elapsedMs:
          calculateWaterSortSpeedFullScoreMs(zeroScoreProblem) *
          WATER_SORT_SPEED_ZERO_SCORE_RATIO,
        completionMoveCount: zeroScoreProblem.optimalMoveCount * 2,
        moveCount: zeroScoreProblem.optimalMoveCount * 3,
      });

      expect(breakdown).toEqual({ efficiency: 0, speed: 0, accuracy: 0 });
    });

    test("手戻りの図で、コマの間の矢印に、注ぐ手と手数、プレイ画面と同じやり直しの名前を添えること", () => {
      const labeled = within(panel)
        .getAllByRole("figure")
        .map((figure, index) =>
          (stepLabels[index] ?? []).map(
            (label) => within(figure).queryByText(hasWholeText(label)) !== null,
          ),
        );

      expect(labeled).toEqual(
        stepLabels.map((labels) => labels.map(() => true)),
      );
    });

    test("手戻りの図に、流れごとの数え方を添えること", () => {
      const captioned = flowCaptions.map(
        (caption) => within(panel).queryByText(hasWholeText(caption)) !== null,
      );

      expect(captioned).toEqual(flowCaptions.map(() => true));
    });
  });
});
