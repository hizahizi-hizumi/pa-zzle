import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  calculateParkingJamPlayScore,
  calculateParkingJamSpeedFullScoreMs,
  PARKING_JAM_ACCURACY_ZERO_FAILED_MOVE_COUNT,
  PARKING_JAM_FAILED_MOVE_PENALTY,
  PARKING_JAM_RESTART_PENALTY,
  PARKING_JAM_SCORE_MAXIMUMS,
  PARKING_JAM_SPEED_BOARD_READING_MS,
  PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS,
  PARKING_JAM_SPEED_PER_VEHICLE_MS,
  PARKING_JAM_SPEED_ZERO_SCORE_RATIO,
  PARKING_JAM_UNDO_PENALTY,
} from "@/games/parking-jam/score";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(cleanup);

const { undo, restart } = PLAY_OPERATION_LABELS;

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "パーキングジャムの遊び方" });
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
  return function matchesWholeText(
    _content: string,
    element: Element | null,
  ): boolean {
    return (
      element !== null &&
      element.textContent === text &&
      Array.from(element.children).every((child) => child.textContent !== text)
    );
  };
}

function listHeadings(panel: HTMLElement): (string | null)[] {
  return within(panel)
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
}

function toSeconds(ms: number): number {
  return ms / 1000;
}

describe("ParkingJamHowToPlayDialog", () => {
  beforeEach(() => {
    render(<ParkingJamHowToPlayDialog open onClose={vi.fn()} />);
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

  test("ルールのタブに、ルールの一文をチュートリアルと同じ順に並べること", () => {
    const panel = within(getDialog()).getByRole("tabpanel", { name: "ルール" });

    const rules = listHeadings(panel);

    expect(rules).toEqual([
      "車を前か後ろへまっすぐ進めて道路へ出します。",
      "進む先に道路がないと出られません。",
      "植え込みがあると通れません。",
      "ほかの車があると通れません。じゃまな車から出します。",
    ]);
  });

  test("操作のタブを、出し方・やり直し・キーボードのまとまりに分けること", () => {
    const panel = openTab("操作");

    const titles = listHeadings(panel);

    expect(titles).toEqual(["出し方", "やり直し", "キーボード"]);
  });

  describe("採点のタブを開いた場合", () => {
    const measures = [
      `ミス 1回 −${PARKING_JAM_FAILED_MOVE_PENALTY}点`,
      "基準時間",
      `「${undo}」 1回 −${PARKING_JAM_UNDO_PENALTY}点`,
      `「${restart}」 1回 −${PARKING_JAM_RESTART_PENALTY}点`,
    ];
    const leads = [
      `満点からミス1回ごとに引きます。${PARKING_JAM_ACCURACY_ZERO_FAILED_MOVE_COUNT}回で0点です。`,
      `問題ごとの基準時間以内なら満点です。超えると下がります。基準時間の${PARKING_JAM_SPEED_ZERO_SCORE_RATIO}倍で0点です。`,
      `満点から「${undo}」・「${restart}」を使うたびに引きます。0点より下がりません。`,
    ];
    const speedReferenceText = `盤面を読む${toSeconds(PARKING_JAM_SPEED_BOARD_READING_MS)}秒に車1台ごとに${toSeconds(PARKING_JAM_SPEED_PER_VEHICLE_MS)}秒を足します。初めに出られない車は1台ごとにさらに${toSeconds(PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS)}秒足します。`;
    /** 0点になると言う所を確かめる問題。 */
    const speedReference = { vehicleCount: 3, initialBlockedVehicleCount: 1 };
    let panel: HTMLElement;

    beforeEach(() => {
      panel = openTab("採点");
    });

    test("結果画面と同じ順と満点の見出しを並べること", () => {
      const titles = listHeadings(panel);

      expect(titles).toEqual([
        `正確さ ${PARKING_JAM_SCORE_MAXIMUMS.accuracy}点`,
        `速さ ${PARKING_JAM_SCORE_MAXIMUMS.speed}点`,
        `安定性 ${PARKING_JAM_SCORE_MAXIMUMS.stability}点`,
      ]);
    });

    test("数えるものを、score.ts と同じ1回ごとの減点を添えて結果画面と同じ順に並べること", () => {
      const named = within(panel)
        .getAllByRole("listitem")
        .map((item) => item.firstElementChild?.textContent);

      expect(named).toEqual(measures);
    });

    test("点の決まり方と、どこで0点になるかを点ごとの文で言うこと", () => {
      const shown = leads.map(
        (lead) => within(panel).queryByText(hasWholeText(lead)) !== null,
      );

      expect(shown).toEqual(leads.map(() => true));
    });

    test("基準時間を、score.ts と同じ式で言うこと", () => {
      const shown = within(panel).queryByText(hasWholeText(speedReferenceText));

      expect(shown).not.toBeNull();
    });

    test("0点になると言う所で、本番の点の計算も0点になること", () => {
      const { breakdown } = calculateParkingJamPlayScore({
        speedReference,
        elapsedMs:
          calculateParkingJamSpeedFullScoreMs(speedReference) *
          PARKING_JAM_SPEED_ZERO_SCORE_RATIO,
        failedMoveCount: PARKING_JAM_ACCURACY_ZERO_FAILED_MOVE_COUNT,
        undoCount: Math.ceil(
          PARKING_JAM_SCORE_MAXIMUMS.stability / PARKING_JAM_UNDO_PENALTY,
        ),
        restartCount: 0,
      });

      expect(breakdown).toEqual({ accuracy: 0, speed: 0, stability: 0 });
    });

    test("0点になると言う回数の1回手前では、正確さがまだ0点にならないこと", () => {
      const { breakdown } = calculateParkingJamPlayScore({
        speedReference,
        elapsedMs: 0,
        failedMoveCount: PARKING_JAM_ACCURACY_ZERO_FAILED_MOVE_COUNT - 1,
        undoCount: 0,
        restartCount: 0,
      });

      expect(breakdown.accuracy).toBeGreaterThan(0);
    });
  });
});
