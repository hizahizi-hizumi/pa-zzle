import {
  type HowToPlayKey,
  HowToPlayKeyTable,
} from "@/components/HowToPlayKeyTable";
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
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import {
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
import {
  carRuleExample,
  type ParkingJamHowToPlayExample,
  planterRuleExample,
  roadRuleExample,
  straightRuleExample,
  swipeOperationExample,
  tapOperationExample,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/GoalPlayback";
import { TouchableExample } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/TouchableExample";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type ParkingJamHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: PARKING_JAM_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 出られるかのルール。1つの盤面で、残っている車の両端に出られるかの印を付ける。 */
function renderRule(text: string, example: ParkingJamHowToPlayExample) {
  return (
    <HowToPlayRule
      text={text}
      arrangement="stacked"
      examples={<TouchableExample example={example} judged />}
    />
  );
}

/** 出し方の操作。印と言葉を添えず、押す所の手がかりで手を示す。 */
function renderOperation(text: string, example: ParkingJamHowToPlayExample) {
  return (
    <li>
      <HowToPlayRule
        headingLevel={4}
        text={text}
        arrangement="stacked"
        examples={<TouchableExample example={example} />}
      />
    </li>
  );
}

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間とミス・待ったの回数を引き継ぎ、
// リセットは新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `盤面を/最初に/戻します。/時間・ミス・/「${undo}」の回数は/そのままです。`,
  },
  {
    item: playMenuOperationItems.replay,
    text: `同じ問題を/最初から/やり直します。/時間・ミス・/「${undo}」の回数も/0に戻します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/**
 * キーボードの表。Tab の止まり先は車と、車の両端に出した矢印。矢印キーは車の向きに沿うものだけを受ける。
 * Enter・Space は、車の上では矢印を出し入れし、矢印の上ではその向きへ出す。
 */
const keyboardKeys: readonly HowToPlayKey[] = [
  { keys: ["Tab"], description: "次の/車へ/移ります。" },
  {
    keys: ["↑", "↓", "←", "→"],
    description:
      "車を/その向きへ/出します。/縦向きの車は/上下・/横向きの車は/左右の/キーを/使います。",
  },
  {
    keys: ["Enter", "Space"],
    description:
      "車の/両端に/矢印を/出します。/矢印に/移って/押すと/その向きへ/出します。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(PARKING_JAM_SCORE_MAXIMUMS) as [
  keyof typeof PARKING_JAM_SCORE_MAXIMUMS,
  number,
][];

function toSeconds(ms: number): number {
  return ms / 1000;
}

// 一文は、すぐ下の数えるものの行（1回ごとの減点）と同じことを言わず、点の決まり方とどこで0点になるかを言う。
const scoreLeads = {
  accuracy: `満点から/ミス1回ごとに/引きます。/${PARKING_JAM_ACCURACY_ZERO_FAILED_MOVE_COUNT}回で/0点です。`,
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${PARKING_JAM_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
  stability: `満点から/「${undo}」・/「${restart}」を/使うたびに/引きます。/0点より/下がりません。`,
} as const satisfies Record<keyof typeof PARKING_JAM_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ式と呼び名で並べる。 */
function renderScoreRows(item: keyof typeof PARKING_JAM_SCORE_MAXIMUMS) {
  switch (item) {
    case "accuracy":
      return (
        <HowToPlayScoreRow
          measure="ミス"
          deduction={`1回 −${PARKING_JAM_FAILED_MOVE_PENALTY}点`}
          // 本番の session は、出られなかった手を履歴に積まないので、待った・盤面を戻すでミスは減らない。
          text={`出られない/向きへ/動かすと/1回です。/「${undo}」・/「${restart}」でも/減りません。`}
        />
      );
    case "speed":
      return (
        <HowToPlayScoreRow
          measure="基準時間"
          text={`盤面を読む/${toSeconds(PARKING_JAM_SPEED_BOARD_READING_MS)}秒に/車1台ごとに/${toSeconds(PARKING_JAM_SPEED_PER_VEHICLE_MS)}秒を/足します。/初めに/出られない車は/1台ごとに/さらに/${toSeconds(PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS)}秒/足します。`}
        />
      );
    case "stability":
      return (
        <>
          <HowToPlayScoreRow
            measure={`「${undo}」`}
            deduction={`1回 −${PARKING_JAM_UNDO_PENALTY}点`}
            text="出した車を/1台戻すと/1回です。"
          />
          <HowToPlayScoreRow
            measure={`「${restart}」`}
            deduction={`1回 −${PARKING_JAM_RESTART_PENALTY}点`}
          />
        </>
      );
  }
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ駐車場の触れる例と話し言葉の一文を並べる。
 * 例は本番の盤面部品と session で動き、スワイプか矢印で車を出し、出られない向きでは車を当てて揺らす。
 * ルールの例は、残っている車の両端に、今の盤面からその向きへ出られるかの印を本番の判定で付ける。
 */
export function ParkingJamHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: ParkingJamHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="駐車場の車を/すべて/道路へ出す/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderRule(
            "車を/前か後ろへ/まっすぐ進めて/道路へ出します。",
            straightRuleExample,
          )}
          {renderRule("進む先に/道路がないと/出られません。", roadRuleExample)}
          {renderRule("植え込みがあると/通れません。", planterRuleExample)}
          {renderRule(
            "ほかの車があると/通れません。/じゃまな車から/出します。",
            carRuleExample,
          )}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="出し方">
            {renderOperation(
              "車を/出したい向きへ/スワイプします。",
              swipeOperationExample,
            )}
            {renderOperation(
              "車を押すと/両端に/矢印が出ます。/矢印を押して/その向きへ/車を出します。",
              tapOperationExample,
            )}
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後に出した車を/元の場所に/戻します。`}
              note={`時間・/ミスは/そのままで/「${undo}」の回数が/増えます。`}
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          <HowToPlaySection title="キーボード" availability="fine-pointer">
            <li>
              <HowToPlayKeyTable keys={keyboardKeys} />
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
