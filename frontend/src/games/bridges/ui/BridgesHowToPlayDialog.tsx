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
import { howToPlayAvailabilityClassNames } from "@/components/how-to-play-availability";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import {
  BRIDGES_SCORE_MAXIMUMS,
  BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE,
} from "@/games/bridges/score";
import type { BridgesHowToPlayExample } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import {
  backwardCycleOperationExample,
  connectionRuleExamples,
  countRuleExamples,
  crossingOperationExample,
  crossingRuleExample,
  cycleOperationExample,
  dragOperationExample,
  pairOperationExample,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/bridges/ui/BridgesHowToPlayDialog/GoalPlayback";
import {
  type BridgesTouchableExampleCaption,
  TouchableExample,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type BridgesHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: BRIDGES_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 形のルール。できる形とできない形の対を横に並べる。 */
function renderPairRule(
  text: string,
  examples: readonly BridgesHowToPlayExample[],
  caption: BridgesTouchableExampleCaption,
) {
  return (
    <HowToPlayRule
      text={text}
      examples={examples.map((example) => (
        <TouchableExample
          key={example.bridges.join(",")}
          example={example}
          caption={caption}
        />
      ))}
    />
  );
}

/** 操作の例1つ。まとまりの見出しの下に、一文と触れる例を置く。 */
function renderOperation(text: string, example: BridgesHowToPlayExample) {
  return (
    <HowToPlayRule
      headingLevel={4}
      text={text}
      arrangement="stacked"
      examples={<TouchableExample example={example} />}
    />
  );
}

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間と/「${undo}」の回数は/そのままで/橋の無い/最初の盤面に/戻します。`,
  },
  {
    item: playMenuOperationItems.replay,
    text: `時間と/「${undo}」の回数も/0に戻して/同じ問題を/最初から/やり直します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/**
 * キーボードの表。本番の盤面は、島ごとの見えないボタンに Tab で止まり、矢印キーで隣の島へ移り、
 * Shift と矢印キーでその向きの橋を回す。Esc は島を押して選んだ選びを解く。
 */
const keyboardKeys: readonly HowToPlayKey[] = [
  { keys: ["Tab"], description: "盤面の/島に/移ります。" },
  { keys: ["↑", "↓", "←", "→"], description: "隣の/島へ/移ります。" },
  {
    keys: ["Shift", "↑", "↓", "←", "→"],
    description: "その向きの/橋が/1本・2本・なしの/順に/変わります。",
  },
  { keys: ["Esc"], description: "島を/選ぶのを/やめます。" },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(BRIDGES_SCORE_MAXIMUMS) as [
  keyof typeof BRIDGES_SCORE_MAXIMUMS,
  number,
][];

// 結果画面の採点基準と同じく、問題ごとの基準時間との差で決まることを言う。どこで0点になるかは、すぐ下の行で言う。
const scoreLeads = {
  speed: "問題ごとの/基準時間以内なら/満点です。/超えると/点が/下がります。",
} as const satisfies Record<keyof typeof BRIDGES_SCORE_MAXIMUMS, string>;

/**
 * 速さの、数えるものの行。score.ts の基準時間は、島の数・橋の本数と、数字の読みで決まらない所を読む時間で長くなる。
 * 考える所は、どんな問題かが浮かぶよう、数字だけでは決まらず島のつながりを読んで決める所（PZL-010 のつながりの読み）として言う。
 * 待った・盤面を戻す・架け直し・阻まれた回数は、結果画面の注記と同じく、減点しないと名指しで言う。
 */
function renderScoreRows() {
  return (
    <>
      <HowToPlayScoreRow
        measure="基準時間"
        text="島と橋が/多い問題ほど/長くなります。/島のつながりまで/考えないと/決まらない所が/多い問題も/長くなります。"
      />
      <HowToPlayScoreRow
        measure="0点になる時間"
        text={`基準時間の/${BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE.min}〜${BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE.max}倍です。/島のつながりまで/考える所が/多い問題ほど/${BRIDGES_SPEED_ZERO_SCORE_RATIO_RANGE.max}倍に近づきます。`}
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・/「${restart}」・/架け直し`}
        text="何回/しても/点は/下がりません。/交差して/架けられなかった/ときも/同じです。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * 例は本番の盤面部品と遷移で動き、島の数字の色・交わる橋に阻まれた反応・完成の光を本番と同じに返す。
 */
export function BridgesHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: BridgesHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="縦か横に/橋を架けて/数字の付いた島を/1つに/つなげる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderPairRule(
            "島から出す/橋は/数字と/同じ本数に/します。",
            countRuleExamples,
            "count",
          )}
          {renderPairRule(
            "全部の/島を/1つに/つなげます。",
            connectionRuleExamples,
            "connection",
          )}
          <HowToPlayRule
            text="ほかの橋と/交差する/橋は/架けられません。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={crossingRuleExample}
                caption="crossing"
              />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="架け方">
            <li>
              {renderOperation(
                "島と島の/間を/押すたびに/橋が/1本・2本・なしの/順に/変わります。",
                cycleOperationExample,
              )}
            </li>
            <li>
              {renderOperation(
                "島から/相手の島へ/なぞっても/架かります。",
                dragOperationExample,
              )}
            </li>
            <li>
              {renderOperation(
                "島を/押してから/相手の島を/押しても/架かります。",
                pairOperationExample,
              )}
            </li>
            <li>
              {renderOperation(
                "縦と横の/橋が/交差する所を/押しても/どちらの橋も/架かりません。/島から/なぞると/架かります。",
                crossingOperationExample,
              )}
            </li>
            <li className={howToPlayAvailabilityClassNames["fine-pointer"]}>
              {renderOperation(
                "右クリックすると/なし・2本・1本の/順に/変わります。",
                backwardCycleOperationExample,
              )}
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
              text={`「${undo}」を/押すと/最後に/変えた橋が/元に戻ります。`}
              // 本番の session では、待ったは経過時間を変えず、待ったの回数を1つ増やす。
              note={`時間は/そのままで/「${undo}」の回数が/増えます。`}
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
          {renderScoreRows()}
        </HowToPlaySection>
      ))}
    />
  );
}
