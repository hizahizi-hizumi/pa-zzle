import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import { SLIDE_PUZZLE_BOARD_SIZES } from "@/games/slide-puzzle/puzzle/state";
import {
  calculateSlidePuzzlePlayScore,
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
  SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
  SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO,
  slidePuzzleSpeedInitialRecognitionMsByBoardSize,
} from "@/games/slide-puzzle/score";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { moveCountFlows } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

const { restart, replay, startNewProblem, undo } = PLAY_OPERATION_LABELS;

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "スライドパズルの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

/** 文節ごとに区切って描いた文も1つの文として探す、文字の一致。文全体を持つ要素のうち、いちばん内側のものに当たる。 */
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

/** 手数が最短の手数の `times` 倍のときの効率の点。 */
function getEfficiencyAt(times: number): number {
  return calculateSlidePuzzlePlayScore({
    elapsedMs: 0,
    moveCount: 10 * times,
    optimalMoveCount: 10,
    boardSize: 4,
  }).breakdown.efficiency;
}

describe("SlidePuzzleHowToPlayDialog", () => {
  const purpose = "タイルをスライドさせて左上から番号順に並べるパズルです。";
  const efficiencyLead = `手数が最短の手数より多いほど下がります。最短の手数の2倍なら${getEfficiencyAt(2)}点です。3倍なら${getEfficiencyAt(3)}点です。`;
  const speedLead = `基準時間以内なら満点です。超えると下がります。基準時間の${SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO}倍かかると0点です。`;
  const [small, medium, large] = SLIDE_PUZZLE_BOARD_SIZES.map(
    (size) => slidePuzzleSpeedInitialRecognitionMsByBoardSize[size] / 1000,
  );
  const speedFullScoreText = `盤面の大きさで決まる時間（3×3は${small}秒・4×4は${medium}秒・5×5は${large}秒）に最短の手数1手ごとに${SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒を足した時間です。`;
  const moveCountText =
    "プレイ画面の「手数」と同じくスライドしたタイルの枚数を数えます。スライドしなかったタップは数えません。";
  const keyboardText = "矢印の向きへ空白の隣のタイルをスライドさせます。";

  beforeEach(() => {
    render(<SlidePuzzleHowToPlayDialog open onClose={vi.fn()} />);
  });

  test("何をするパズルかの一文と、ゴールの盤面を1つだけ置くこと", () => {
    const goals = within(getDialog()).getAllByRole("img", {
      name: "ゴールの盤面",
    });
    // 読み上げ用の説明にも同じ一文を置くので、目に見える段落を探す。
    const shownPurposes = within(getDialog())
      .getAllByText(hasWholeText(purpose))
      .filter((element) => element.closest("p:not(.sr-only)") !== null);

    expect(goals).toHaveLength(1);
    expect(shownPurposes).toHaveLength(1);
  });

  test("ルールを、スライドするタイル・まとめてスライド・完成の順に並べること", () => {
    const headings = listHeadings(openTab("ルール"), 3);

    expect(headings).toEqual([
      "空白と同じ行・列のタイルをタップするとスライドします。",
      "離れたタイルをタップすると間のタイルもスライドします。",
      "左上から番号順に並んで右下が空白になったら完成です。4×4・5×5の盤面も同じです。",
    ]);
  });

  test("操作のタブに、動かし方・やり直し・キーボードを置き、やり直しに待ったを置かないこと", () => {
    const panel = openTab("操作");

    const headings = listHeadings(panel, 3);
    const menuItems = [restart, replay, startNewProblem].map((label) =>
      within(panel).queryByText(label),
    );
    const undoItem = within(panel).queryByText(new RegExp(undo));
    const keyboardDescription = within(panel).queryByText(
      hasWholeText(keyboardText),
    );

    expect(headings).toEqual(["動かし方", "やり直し", "キーボード"]);
    expect(menuItems).not.toContain(null);
    expect(undoItem).toBeNull();
    expect(keyboardDescription).not.toBeNull();
  });

  test("採点のタブに、結果画面と同じ順で満点と、score.ts から求めた点の決まり方を置くこと", () => {
    const panel = openTab("採点");

    const headings = listHeadings(panel, 3);
    const leads = [efficiencyLead, speedLead].map((lead) =>
      within(panel).queryByText(hasWholeText(lead)),
    );

    expect(headings).toEqual([
      `効率 ${SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency}点`,
      `速さ ${SLIDE_PUZZLE_SCORE_MAXIMUMS.speed}点`,
    ]);
    expect(leads).not.toContain(null);
  });

  test("基準時間を、score.ts の盤面ごとの時間と1手ごとの時間で言うこと", () => {
    const panel = openTab("採点");

    const text = within(panel).queryByText(hasWholeText(speedFullScoreText));

    expect(text).not.toBeNull();
  });

  test("手数の行で、スライドしなかったタップを数えないと言うこと", () => {
    const panel = openTab("採点");

    const text = within(panel).queryByText(hasWholeText(moveCountText));

    expect(text).not.toBeNull();
  });

  test("手数の流れの図に、押したタイルを囲み、本番の数え方で数えた手数を添えること", () => {
    const panel = openTab("採点");

    const counts = within(panel)
      .getAllByText(/^→ 手数/)
      .map((count) => count.textContent);
    const pressedTiles = Array.from(
      panel.querySelectorAll("[data-pressed-tile]"),
      (frame) => frame.parentElement?.textContent,
    );

    expect(counts).toEqual(["→ 手数 1手", "→ 手数 2手"]);
    expect(pressedTiles).toEqual(
      [moveCountFlows.adjacent, moveCountFlows.distant].map(({ frames }) =>
        String(frames[0].tappedTile),
      ),
    );
  });
});
