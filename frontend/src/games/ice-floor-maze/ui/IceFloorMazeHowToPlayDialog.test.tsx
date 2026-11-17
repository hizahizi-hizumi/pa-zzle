import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  calculateIceFloorMazePlayScore,
  calculateIceFloorMazeSpeedFullScoreMs,
  ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
  ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/ice-floor-maze/score";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { TRAPPED_NOTICE_LABEL } from "@/games/ice-floor-maze/ui/IceFloorMazeTrappedNotice";
import { SCORE_ITEM_LABELS } from "@/games/play-vocabulary";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
}));

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "アイスフロア迷路の遊び方" });
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

describe("IceFloorMazeHowToPlayDialog", () => {
  describe("開いた場合", () => {
    const onOpenTutorial = vi.fn();

    beforeEach(() => {
      onOpenTutorial.mockClear();
      render(
        <IceFloorMazeHowToPlayDialog
          open
          onClose={vi.fn()}
          onOpenTutorial={onOpenTutorial}
        />,
      );
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

    test("ルールのタブに、中心のルールから要素のルールの順に並べること", () => {
      const panel = openTab("ルール");

      const rules = listHeadings(panel, 3);

      expect(rules).toEqual([
        "駒は岩か壁にぶつかるまで止まらずに滑ります。",
        "ゴールで止まれば完成です。通り過ぎるだけでは完成しません。",
        "駒は床に入ると止まります。床からはまた滑り出せます。",
        "薄い氷は駒が通ると割れて水面になります。駒は水面の手前で止まります。",
        "もろい岩は駒が滑ってきてぶつかると崩れて通れるようになります。すぐ隣にいる駒がぶつかっても崩れません。",
        "駒は雪に入ると止まり雪を1マス先へ押し出して雪山にします。雪山と押し出せない雪は動かず駒はその手前で止まります。",
        "駒は氷の塊にぶつかると塊を押しながら滑ります。すぐ隣からは押せません。",
        "雪山が載ったゴールにはもう止まれません。氷の塊が載っている間も止まれません。",
      ]);
    });

    test("ルールの例を触れる盤面にし、本番のルールから求めたその手で起きることを添えること", () => {
      const panel = openTab("ルール");

      const names: string[] = [];
      within(panel).getAllByRole("figure", {
        name: (name) => {
          names.push(name);
          return true;
        },
      });

      expect(names).toEqual([
        "岩の手前で止まる",
        "ゴールで止まる",
        "通り過ぎる",
        "床で止まる",
        "薄い氷が割れる",
        "崩せる",
        "崩せない",
        "押し出せる",
        "押し出せない",
        "押せる",
        "押せない",
        "雪山がゴールに載る",
        "塊がゴールに載る",
      ]);
      expect(
        within(panel).getAllByRole("group", { name: "盤面" }),
      ).toHaveLength(names.length);
    });

    test("操作のタブを、滑らせ方・やり直し・知らせ・キーボードのまとまりに分けること", () => {
      const panel = openTab("操作");

      const titles = listHeadings(panel, 3);

      expect(titles).toEqual([
        "滑らせ方",
        "やり直し",
        TRAPPED_NOTICE_LABEL,
        "キーボード",
      ]);
    });

    test("知らせのまとまりに、本番と同じ知らせを押せない図で置くこと", () => {
      const panel = openTab("操作");

      const figure = within(panel).getByRole("img", {
        name: `${TRAPPED_NOTICE_LABEL}盤面と知らせ`,
      });

      expect(figure.querySelector("[inert]")).not.toBeNull();
    });

    test("採点のタブに、結果画面と同じ順に評価の項目を満点と並べること", () => {
      const panel = openTab("採点");

      const items = listHeadings(panel, 3);

      expect(items).toEqual(
        Object.entries(ICE_FLOOR_MAZE_SCORE_MAXIMUMS).map(
          ([item, maximum]) =>
            `${SCORE_ITEM_LABELS[item as keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS]} ${maximum}点`,
        ),
      );
    });

    describe("採点のタブの点の決まり方", () => {
      const optimalMoveCount = 8;
      const speedReference = { drawnCellCount: 30, elementCount: 2 };
      const halfScoreMoveCount =
        optimalMoveCount * 2 + ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES;
      const halfScore = calculateIceFloorMazePlayScore({
        elapsedMs: 0,
        moveCount: halfScoreMoveCount,
        speedReference,
        optimalMoveCount,
      }).breakdown.efficiency;
      const manyMovesScore = calculateIceFloorMazePlayScore({
        elapsedMs: 0,
        moveCount: 1000,
        speedReference,
        optimalMoveCount,
      }).breakdown.efficiency;
      const zeroSpeedScore = calculateIceFloorMazePlayScore({
        elapsedMs:
          calculateIceFloorMazeSpeedFullScoreMs({
            speedReference,
            optimalMoveCount,
          }) * ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO,
        moveCount: optimalMoveCount,
        speedReference,
        optimalMoveCount,
      }).breakdown.speed;

      test("効率と速さの一文で言う手数・点・倍率が、score.ts の採点と同じであること", () => {
        const text = openTab("採点").textContent ?? "";

        expect(text).toContain(
          `最短の2倍より${ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES}手多いと${halfScore}点になりそれより多くても0点にはなりません。`,
        );
        expect(manyMovesScore).toBeGreaterThan(0);
        expect(text).toContain(
          `基準時間の${ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO}倍で${zeroSpeedScore}点です。`,
        );
      });
    });

    test("手数の数え方を、待ったで取り消しても数えることと、動けない向きは数えないことの流れで見せること", () => {
      const panel = openTab("採点");

      const counts = within(panel)
        .getAllByText(/^→ 手数/)
        .map((count) => count.textContent);

      expect(counts).toEqual(["→ 手数 1手", "→ 手数 0手"]);
    });
  });
});
