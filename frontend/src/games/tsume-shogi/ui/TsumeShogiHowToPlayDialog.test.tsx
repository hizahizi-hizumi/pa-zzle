import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import {
  calculateTsumeShogiPlayScore,
  countTsumeShogiWrongChecksToZeroAccuracy,
  TSUME_SHOGI_SCORE_MAXIMUMS,
  TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO,
  TSUME_SHOGI_WRONG_CHECK_PENALTY,
} from "@/games/tsume-shogi/score";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

const { undo } = PLAY_OPERATION_LABELS;

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "詰将棋の遊び方" });
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

function pressEscape(): void {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
}

/** ルールのタブの最初の例（王手だけを指せるルール）の盤の升。 */
function getCheckRuleSquare(panel: HTMLElement, name: string): HTMLElement {
  const [board] = within(panel).getAllByRole("group", { name: "盤" });
  return within(board as HTMLElement).getByRole("button", {
    name: new RegExp(`^${name}( |$)`),
  });
}

describe("TsumeShogiHowToPlayDialog", () => {
  const onOpenTutorial = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    render(
      <TsumeShogiHowToPlayDialog
        open
        onClose={onClose}
        onOpenTutorial={onOpenTutorial}
      />,
    );
  });

  test("ゴールの盤面を1つ描き、その下にチュートリアルの入口を置くこと", () => {
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

  test("ルールのタブに、中心のルールから順に一文を並べること", () => {
    const panel = openTab("ルール");

    const headings = listHeadings(panel, 3);

    expect(headings).toEqual([
      "次に玉を取れる手（王手）だけを指せます。",
      "「3手詰」なら玉方の手も入れて3手で詰ませます。",
      "玉の逃げ道をふさぐ王手で詰ませます。",
      "玉方は盤の上にも攻方の持駒にも無い駒を全部持っています。",
      "駒は図の向きへ動けます。成った銀・桂馬・香車・歩は金と同じように動きます。",
      "上の3段から動くか上の3段へ動くと成れます。",
      "歩は攻方の歩が無い縦の列にだけ打てます。",
      "歩を打って王手をかけられるのはその手で詰まないときだけです。",
      "上の2段へ動く桂馬といちばん上の段へ動く香車・歩は必ず成ります。打つときはそれより下の段に打ちます。",
    ]);
  });

  describe("ルールのタブを開いた場合", () => {
    let panel: HTMLElement;

    beforeEach(() => {
      panel = openTab("ルール");
    });

    test("例に触れる前の Esc で、最初から選んで見せる金があっても遊び方を閉じること", () => {
      pressEscape();

      const closed = onClose.mock.calls.length;

      expect(closed).toBe(1);
    });

    describe("王手の例で、金を選んだまま王手にならない升を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getCheckRuleSquare(panel, "3四"));
      });

      test("Esc で、遊び方を閉じずに本番と同じく金を選ぶのをやめること", () => {
        pressEscape();

        const result = {
          pressed: getCheckRuleSquare(panel, "3三").getAttribute(
            "aria-pressed",
          ),
          closed: onClose.mock.calls.length,
        };

        expect(result).toEqual({ pressed: "false", closed: 0 });
      });
    });
  });

  test("操作のタブに、指し方・やり直し・キーボードのまとまりを置き、待ったの戻り方を言うこと", () => {
    const panel = openTab("操作");

    const sections = listHeadings(panel, 3);

    expect(sections).toEqual(["指し方", "やり直し", "キーボード"]);
    expect(within(panel).getByText(new RegExp(`「${undo}」で`))).toBeTruthy();
  });

  describe("採点のタブの場合", () => {
    const zeroAt = countTsumeShogiWrongChecksToZeroAccuracy();
    const workload = {
      plies: 3,
      rootChecks: 1,
      plausibleWrong: 0,
      deepDecoyCount: 0,
    };

    test("0点になると言う誤王手の回数が、score.ts の採点で正確さを初めて0点にする回数であること", () => {
      const atZero = calculateTsumeShogiPlayScore({
        elapsedMs: 0,
        wrongCheckCount: zeroAt,
        workload,
      });
      const beforeZero = calculateTsumeShogiPlayScore({
        elapsedMs: 0,
        wrongCheckCount: zeroAt - 1,
        workload,
      });

      expect(atZero.breakdown.accuracy).toBe(0);
      expect(beforeZero.breakdown.accuracy).toBeGreaterThan(0);
    });

    test("結果画面と同じ順で満点を並べ、誤王手の減点と0点になる回数と、速さが0点になる倍率を score.ts の値で言うこと", () => {
      const panel = openTab("採点");

      const sections = listHeadings(panel, 3);

      expect(sections).toEqual([
        `正確さ ${TSUME_SHOGI_SCORE_MAXIMUMS.accuracy}点`,
        `速さ ${TSUME_SHOGI_SCORE_MAXIMUMS.speed}点`,
      ]);
      expect(within(panel).getByText(`${zeroAt}回で`)).toBeTruthy();
      expect(
        within(panel).getByText(`1回 −${TSUME_SHOGI_WRONG_CHECK_PENALTY}点`),
      ).toBeTruthy();
      expect(
        within(panel).getByText(`${TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO}倍で`),
      ).toBeTruthy();
    });
  });
});
