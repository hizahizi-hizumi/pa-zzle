import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import pictogramSvg from "@/games/shuttle-parking/assets/pictogram.svg?raw";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import {
  SHUTTLE_PARKING_SCORE_MAXIMUMS,
  SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO,
  SHUTTLE_PARKING_TRAP_PENALTY,
} from "@/games/shuttle-parking/score";
import {
  baysRuleExample,
  boardOrderExample,
  boardRuleExample,
  exitOperationExample,
  exitRuleExamples,
} from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";
import { GoalPlayback } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/GoalPlayback";
import { TouchableExample } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/TouchableExample";
import {
  ShuttleParkingStuckNotice,
  STUCK_NOTICE_LABEL,
} from "@/games/shuttle-parking/ui/ShuttleParkingStuckNotice";

type ShuttleParkingHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: SHUTTLE_PARKING_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

function ignoreFigurePress() {}

const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間と回数は/そのままで/最初の盤面に/戻します。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と回数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

const scoreItems = Object.entries(SHUTTLE_PARKING_SCORE_MAXIMUMS) as [
  keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  accuracy: `満点から/引いていきます。/${Math.ceil(SHUTTLE_PARKING_SCORE_MAXIMUMS.accuracy / SHUTTLE_PARKING_TRAP_PENALTY)}回で/0点です。`,
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<
  keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS,
  string
>;

function renderScoreRows(item: keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS) {
  switch (item) {
    case "accuracy":
      return (
        <>
          <HowToPlayScoreRow
            measure="罠"
            deduction={`1回 −${SHUTTLE_PARKING_TRAP_PENALTY}点`}
            text="まだ全員を/送り出せる盤面で/送り出せなくなる車を/出した回数です。/出した時点で/数えます。/「待った」や/「盤面を戻す」で/戻しても/減りません。/戻して/同じ車を/また出すと/もう1回/数えます。/詰んだ後に/出した車は/数えません。"
          />
          <HowToPlayScoreRow
            measure={`「${undo}」・/「${restart}」`}
            text="押した回数では/下がりません。"
          />
        </>
      );
    case "speed":
      return (
        <HowToPlayScoreRow
          measure="基準時間"
          text="車と乗客が/多い問題ほど/長くなります。"
        />
      );
  }
}

export function ShuttleParkingHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: ShuttleParkingHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="駐車場の車を/待機枠へ出して/列の乗客を/同じ色の車に/乗せて/全員を/送り出す/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="車は/向いている方へ/まっすぐ進み/矢印の道路から/出て/待機枠に/入ります。/前に車があると/出られません。"
            examples={
              <>
                <TouchableExample
                  example={exitRuleExamples[0]}
                  caption="exit"
                />
                <TouchableExample
                  example={exitRuleExamples[1]}
                  caption="exit"
                />
              </>
            }
          />
          <HowToPlayRule
            text="乗客は/列の先頭から/順に/同じ色の/待っている車に/1人ずつ/乗ります。/同じ色の車が/2台あれば/先に入った車に/乗ります。/席が埋まった車は/出発して/枠が空きます。"
            arrangement="stacked"
            examples={
              <>
                <TouchableExample example={boardRuleExample} caption="board" />
                <TouchableExample example={boardOrderExample} caption="board" />
              </>
            }
          />
          <HowToPlayRule
            text="待機枠が/埋まっていると/次の車を/出せません。/先頭の乗客が/乗れる車が/無いまま/埋まると/詰みです。"
            arrangement="stacked"
            examples={
              <TouchableExample example={baysRuleExample} caption="exit" />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="出し方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="車を/タップすると/前が/空いていれば/待機枠へ/出ます。"
                arrangement="stacked"
                examples={
                  <TouchableExample
                    example={exitOperationExample}
                    caption="none"
                  />
                }
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後に出した/1台を/駐車場に/戻します。`}
              note="時間は/そのままで/「待った」の/回数が/増えます。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          <HowToPlaySection title={STUCK_NOTICE_LABEL}>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="どの車も/出せなくなると/駐車場の上に/出ます。/原因は/何台か前の/出し方の/こともあります。"
                arrangement="stacked"
                examples={
                  <span aria-hidden="true" inert className="flex">
                    <ShuttleParkingStuckNotice
                      canUndo
                      onUndo={ignoreFigurePress}
                      onRestart={ignoreFigurePress}
                    />
                  </span>
                }
              />
            </li>
          </HowToPlaySection>
        </>
      }
      scoring={scoreItems.map(([item, maximum]) => (
        <HowToPlaySection
          key={item}
          title={SCORE_ITEM_LABELS[item]}
          value={`${maximum}点`}
          lead={scoreLeads[item]}
        >
          {renderScoreRows(item)}
        </HowToPlaySection>
      ))}
    />
  );
}
