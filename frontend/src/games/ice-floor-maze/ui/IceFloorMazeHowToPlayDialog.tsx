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
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import {
  ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
  ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/ice-floor-maze/score";
import {
  brittleRockRuleExamples,
  coveredGoalRuleExamples,
  floorRuleExample,
  goalRuleExamples,
  type IceFloorMazeHowToPlayExample,
  slideOperationExample,
  slideRuleExample,
  slidingBlockRuleExamples,
  snowRuleExamples,
  thinIceRuleExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/GoalPlayback";
import { MoveCountExamples } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/MoveCountExamples";
import { moveCountFlows } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/move-count-flow";
import { TouchableExample } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/TouchableExample";
import { TrappedFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/TrappedFigure";
import { TRAPPED_NOTICE_LABEL } from "@/games/ice-floor-maze/ui/IceFloorMazeTrappedNotice";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type IceFloorMazeHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: ICE_FLOOR_MAZE_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 1つの盤面で、手がかりの手を順に試すルール。 */
function renderSingleRule(text: string, example: IceFloorMazeHowToPlayExample) {
  return (
    <HowToPlayRule
      text={text}
      arrangement="stacked"
      examples={<TouchableExample example={example} />}
    />
  );
}

/** 見比べる2つの盤面を、左と右の別の例として並べるルール。 */
function renderPairRule(
  text: string,
  examples: readonly [
    IceFloorMazeHowToPlayExample,
    IceFloorMazeHowToPlayExample,
  ],
) {
  return (
    <HowToPlayRule
      text={text}
      examples={examples.map((example, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 対の左と右は、並び順そのものが識別になる
        <TouchableExample key={index} example={example} />
      ))}
    />
  );
}

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と手数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間と手数は/そのままで/最初の盤面に/戻します。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と手数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの別の問題に/変えます。",
  },
];

/** キーボードの表。矢印キーはプレイ画面のどこにフォーカスがあっても受け、その向きへ滑らせる。 */
const keyboardKeys: readonly HowToPlayKey[] = [
  {
    keys: ["↑", "↓", "←", "→"],
    description: "その向きへ/駒を/滑らせます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(ICE_FLOOR_MAZE_SCORE_MAXIMUMS) as [
  keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
  number,
][];

/**
 * 点ごとの、何で満点になり、どこまで下がるか。効率は (最短 + ゆとり) ÷ (手数 + ゆとり) の比で下がり、0点にはならないので、
 * 結果画面の採点基準と同じく、半分になる手数（最短の2倍にゆとりを足した手数）と、0点にはならないことを言う。速さは基準時間の倍で0点になる。
 */
const scoreLeads = {
  efficiency: `手数が/最短なら/満点です。/最短の2倍より/${ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES}手/多いと/${ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency / 2}点に/なり/それより/多くても/0点には/なりません。`,
  speed: `問題ごとの基準時間以内なら/満点です。/超えるほど/点が下がり/基準時間の${ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものをプレイ画面と結果画面と同じ呼び名で並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、盤面として描くマスの数・最短の手数・初期盤面の要素の数に応じた時間を足す。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text="盤面のマス・/最短の手数・/もろい岩・薄い氷・雪・氷の塊の数が/多い問題ほど/長くなります。"
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="手数"
        // 本番の session は、成立した滑りだけを数え、待った・盤面を戻すでは減らさない。
        text={`駒が滑った/回数です。/「${undo}」で/取り消した手も/「${restart}」より/前に/滑った手も/数えます。`}
        figure={
          <MoveCountExamples
            examples={[
              {
                flow: moveCountFlows.undo,
                caption: `滑らせてから/「${undo}」で/取り消す`,
              },
              {
                flow: moveCountFlows.blocked,
                caption: "動けない/向きを/選ぶ",
              },
            ]}
          />
        }
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・/「${restart}」`}
        // 効率は手数だけで決まり、待った・盤面を戻すを使った回数では点を引かない（score.ts）。
        text="使った回数では/点が/下がりません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * 例は本番の盤面部品とスワイプで動き、滑る・止まる・崩れる・割れる・押し出す・押し戻されるを本番と同じに返し、
 * 例の下には、その手で起きることを本番のルールから求めて言う。
 * 床・もろい岩・薄い氷・雪・氷の塊はどのレベルにも出るわけではないが、レベルによって出し分けずに同じ遊び方を示す。
 */
export function IceFloorMazeHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: IceFloorMazeHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="駒を/氷の上で/滑らせて/ゴールで/ぴたりと止める/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderSingleRule(
            "駒は/岩か壁に/ぶつかるまで/止まらずに/滑ります。",
            slideRuleExample,
          )}
          {renderPairRule(
            "ゴールで/止まれば/完成です。/通り過ぎるだけでは/完成しません。",
            goalRuleExamples,
          )}
          {renderSingleRule(
            "駒は/床に入ると/止まります。/床からは/また/滑り出せます。",
            floorRuleExample,
          )}
          {renderSingleRule(
            "薄い氷は/駒が通ると/割れて/水面になります。/駒は/水面の手前で/止まります。",
            thinIceRuleExample,
          )}
          {renderPairRule(
            "もろい岩は/駒が/滑ってきて/ぶつかると/崩れて/通れるように/なります。/すぐ隣に/いる駒が/ぶつかっても/崩れません。",
            brittleRockRuleExamples,
          )}
          {renderPairRule(
            "駒は/雪に入ると/止まり/雪を/1マス先へ/押し出して/雪山にします。/雪山と/押し出せない雪は/動かず/駒は/その手前で/止まります。",
            snowRuleExamples,
          )}
          {renderPairRule(
            "駒は/氷の塊に/ぶつかると/塊を押しながら/滑ります。/すぐ隣からは/押せません。",
            slidingBlockRuleExamples,
          )}
          {renderPairRule(
            "雪山が/載ったゴールには/もう/止まれません。/氷の塊が/載っている間も/止まれません。",
            coveredGoalRuleExamples,
          )}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="滑らせ方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="盤面を/スワイプした/向きへ/駒が滑ります。"
                arrangement="stacked"
                examples={<TouchableExample example={slideOperationExample} />}
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後の/1手を/取り消します。/崩れた岩も/水面も/雪も/塊も/元の姿に/戻ります。`}
              note="時間と手数は/そのままです。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          <HowToPlaySection
            // 見出しは、プレイ画面の知らせの言葉にそろえる。
            title={TRAPPED_NOTICE_LABEL}
            lead={`ゴールに/止まれなくなったまま/何度か滑ると/盤面の下に/この知らせが/出ます。/「${undo}」か/「${restart}」で/まだ/ゴールに/止まれる/盤面まで/戻れます。`}
          >
            {/* 知らせの図は押せないので、触れる例の面に置かず、待ったのボタンの図と同じく地の上に置いて見分けられるようにする。 */}
            <li>
              <TrappedFigure />
            </li>
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
