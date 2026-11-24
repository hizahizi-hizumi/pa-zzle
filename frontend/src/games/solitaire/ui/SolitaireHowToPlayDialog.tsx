import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import type { HowToPlayVerdictLabels } from "@/components/HowToPlayVerdict";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import {
  PLAY_OPERATION_LABELS,
  PLAY_OPERATION_PHRASES,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import pictogramSvg from "@/games/solitaire/assets/pictogram.svg?raw";
import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import {
  SOLITAIRE_RETRACTED_MOVE_PENALTY,
  SOLITAIRE_SCORE_MAXIMUMS,
  SOLITAIRE_SPEED_FULL_SCORE_MS,
  SOLITAIRE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/solitaire/score";
import {
  emptyColumnExamples,
  foundationOrderExamples,
  foundationPressExample,
  foundationReturnExamples,
  moveOperationExample,
  runAmountExamples,
  type SolitaireHowToPlayExample,
  stackDestinationExample,
  stockDrawExample,
  stockRecycleExample,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/GoalPlayback";
import { RetractionFlows } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/RetractionFlows";
import { StuckNoticeFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/StuckNoticeFigure";
import {
  TouchableExample,
  type TouchableExampleCaption,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample";
import { SOLITAIRE_RETRACTED_MOVE_LABEL } from "@/games/solitaire/ui/score-vocabulary";
import { SOLITAIRE_STUCK_NOTICE_LABEL } from "@/games/solitaire/ui/stuck-notice";

type SolitaireHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const game = { name: SOLITAIRE_DISPLAY_NAME, pictogramSvg };

const { undo } = PLAY_OPERATION_LABELS;

/** 置けるかの判定の言葉。置いた後は、試した手の結果として「置けた」と言う。 */
const placeCaption = {
  kind: "verdict",
  labels: { allowed: "置ける", disallowed: "置けない" },
  movedLabels: { allowed: "置けた", disallowed: "置けない" },
} as const satisfies TouchableExampleCaption;

const returnLabels: HowToPlayVerdictLabels = {
  allowed: "戻せる",
  disallowed: "戻せない",
};

/** 戻せるかの判定の言葉。戻した後は、試した手の結果として「戻せた」と言う。 */
const returnCaption = {
  kind: "verdict",
  labels: returnLabels,
  movedLabels: { allowed: "戻せた", disallowed: "戻せない" },
} as const satisfies TouchableExampleCaption;

/** 対の2つの例を、左と右の別の盤面として並べるルール。 */
function renderPairRule(
  text: string,
  [left, right]: readonly [
    SolitaireHowToPlayExample,
    SolitaireHowToPlayExample,
  ],
  caption: TouchableExampleCaption,
) {
  return (
    <HowToPlayRule
      text={text}
      examples={
        <>
          <TouchableExample example={left} caption={caption} />
          <TouchableExample example={right} caption={caption} />
        </>
      }
    />
  );
}

function ignoreFigurePress() {}

/** 2つの違い（時間を残して配り直すか、問題を変えるか）を一文ずつで言う。プレイ中のメニューにリセットは置かない。 */
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間は/そのままで/配った直後の/盤面に/戻します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(SOLITAIRE_SCORE_MAXIMUMS) as [
  keyof typeof SOLITAIRE_SCORE_MAXIMUMS,
  number,
][];

const speedFullScoreMinutes = SOLITAIRE_SPEED_FULL_SCORE_MS / 60_000;

/** 点ごとの決まり方。安定性は満点から取り消した手の数だけ引き、速さは基準時間との比で決まる（score.ts）。 */
const scoreLeads = {
  stability: "満点から/取り消した手の/数だけ/下がります。",
  speed: `基準時間/以内なら/満点です。/超えると/下がります。/基準時間の/${SOLITAIRE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof SOLITAIRE_SCORE_MAXIMUMS, string>;

/** 点ごとに数えるものを、結果画面の採点基準と同じ呼び名で並べる。 */
function renderScoreRows(item: keyof typeof SOLITAIRE_SCORE_MAXIMUMS) {
  switch (item) {
    case "stability":
      return (
        <HowToPlayScoreRow
          measure={SOLITAIRE_RETRACTED_MOVE_LABEL}
          deduction={`1手 −${SOLITAIRE_RETRACTED_MOVE_PENALTY}点`}
          text={`「${PLAY_OPERATION_PHRASES.undo}」で/戻した手と/「${PLAY_OPERATION_PHRASES.restart}」で/なくなった手を/数えます。/山札を/押した手は/数えません。`}
          figure={<RetractionFlows />}
        />
      );
    case "speed":
      return (
        <HowToPlayScoreRow
          measure="基準時間"
          text={`どの問題も/${speedFullScoreMinutes}分です。`}
        />
      );
  }
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ札の触れる例と話し言葉の一文を並べる。
 * ルールの例は、本番の盤面と同じく選び・札を移し・当てて戻し、置けるかの判定や動く枚数を、本番の判定から求めて添える。
 */
export function SolitaireHowToPlayDialog({
  open,
  onClose,
}: SolitaireHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="札を/動かして/4つのマークを/それぞれ/Aから/Kまで/組札に/積み上げる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      rules={
        <>
          <HowToPlayRule
            text="列の/いちばん手前の札には/数が/1つ小さく/色の違う札を/重ねられます。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={stackDestinationExample}
                caption={{ kind: "columns" }}
              />
            }
          />
          {renderPairRule(
            "手前から/続く並びは/途中の札から/まとめて/動かせます。/動く枚数は/置く先で/決まります。",
            runAmountExamples,
            { kind: "amount" },
          )}
          {renderPairRule(
            "空いた列には/Kから始まる/札か並びだけを/置けます。",
            emptyColumnExamples,
            placeCaption,
          )}
          {renderPairRule(
            "組札には/同じマークの札を/Aから/数の順に/重ねます。",
            foundationOrderExamples,
            placeCaption,
          )}
          {renderPairRule(
            "組札の/いちばん上の札は/列へ/戻せます。",
            foundationReturnExamples,
            returnCaption,
          )}
          <HowToPlayRule
            text="山札を/押すと/1枚めくって/捨て札に/重ねます。/捨て札は/いちばん上の札だけ/使えます。"
            arrangement="stacked"
            examples={<TouchableExample example={stockDrawExample} />}
          />
          <HowToPlayRule
            text="山札が/なくなったら/空の山札を/押すと/捨て札が/山札に/戻ります。/何周でも/めくれます。"
            arrangement="stacked"
            examples={<TouchableExample example={stockRecycleExample} />}
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="動かし方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="動かす札を/押して選んでから/置く先を/押します。/選んだ札を/もう一度押すと/選ぶ前に/戻ります。"
                arrangement="stacked"
                examples={<TouchableExample example={moveOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="組札は/4つの/どれを押しても/札と同じ/マークの組札に/置けます。"
                arrangement="stacked"
                examples={<TouchableExample example={foundationPressExample} />}
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
              text={`「${undo}」で/最後に打った1手を/取り消します。/山札を/押した手も/1手です。`}
              note="時間は/そのままで/押した回数が/増えます。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          {/* 見出しは、プレイ画面の知らせの言葉にそろえる。 */}
          <HowToPlaySection title={SOLITAIRE_STUCK_NOTICE_LABEL}>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="どう動かしても/今より多くの札を/組札へ/運べなくなると/出ます。/打った手を/取り消せば/続けられます。"
                arrangement="stacked"
                examples={<StuckNoticeFigure />}
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
