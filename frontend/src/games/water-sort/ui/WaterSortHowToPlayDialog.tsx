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
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import {
  WATER_SORT_SCORE_MAXIMUMS,
  WATER_SORT_SPEED_ZERO_SCORE_RATIO,
} from "@/games/water-sort/score";
import { DEADLOCK_NOTICE_LABEL } from "@/games/water-sort/ui/DeadlockNotice";
import { BacktrackExamples } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/BacktrackExamples";
import { DeadlockFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/DeadlockFigure";
import {
  amountRuleExamples,
  backtrackFigures,
  completeRuleExamples,
  destinationRuleExamples,
  pourDestinationExample,
  pourOperationExample,
  type WaterSortHowToPlayExample,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/GoalPlayback";
import {
  TouchableExample,
  type TouchableExampleCaption,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample";

type WaterSortHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: WATER_SORT_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 対の2つの例を、左と右の別の盤面として並べるルール。 */
function renderRule(
  text: string,
  [left, right]: readonly [
    WaterSortHowToPlayExample,
    WaterSortHowToPlayExample,
  ],
  caption: TouchableExampleCaption,
) {
  return (
    <HowToPlayRule
      text={text}
      examples={
        <>
          <TouchableExample example={left} caption={caption} pairSide="left" />
          <TouchableExample
            example={right}
            caption={caption}
            pairSide="right"
          />
        </>
      }
    />
  );
}

function ignoreFigurePress() {}

/** 3つの違い（時間と手数を残すか、0に戻すか、問題を変えるか）を一文ずつで言う。本番のセッションと同じく、盤面を戻すは時間と手数を残し、リセットと別の問題は0から数える。 */
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
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(WATER_SORT_SCORE_MAXIMUMS) as [
  keyof typeof WATER_SORT_SCORE_MAXIMUMS,
  number,
][];

/**
 * 点ごとの、何が多いと下がり、どこで0点になるか。score.ts の数え方と同じく、効率はクリア手数が最短の手数の2倍、
 * 正確さは手戻りが最短の手数と同じ数、速さは基準時間の `WATER_SORT_SPEED_ZERO_SCORE_RATIO` 倍で0点になる。
 * どれも最短の手数や基準時間との比で決まり、1回ごとに決まった点を引くものは無い。
 */
const scoreLeads = {
  efficiency:
    "クリア手数が/最短の手数より/多いほど/下がります。/最短の手数の/2倍で/0点です。",
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${WATER_SORT_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
  accuracy:
    "手戻りが/多いほど/下がります。/最短の手数と/同じ数に/なると/0点です。",
} as const satisfies Record<keyof typeof WATER_SORT_SCORE_MAXIMUMS, string>;

/** 点ごとに数えるものを、結果画面の採点基準と同じ呼び名で並べる。 */
function renderScoreRows(item: keyof typeof WATER_SORT_SCORE_MAXIMUMS) {
  switch (item) {
    case "efficiency":
      return (
        <HowToPlayScoreRow
          measure="クリア手数"
          text="そろうまでに/注いだ手を/数えます。/取り消した手は/数えません。"
        />
      );
    case "speed":
      return (
        <HowToPlayScoreRow
          measure="基準時間"
          text="色の数と/最短の手数が/多い問題ほど/長くなります。"
        />
      );
    case "accuracy":
      return (
        <>
          <HowToPlayScoreRow
            measure="総手数"
            text="取り消した手も/含めて/注いだ手を/すべて数えます。/プレイ画面の/「手数」と/同じです。"
          />
          <HowToPlayScoreRow
            measure="手戻り"
            text="総手数のうち/取り消した手を/数えます。"
            figure={
              <BacktrackExamples
                examples={[
                  {
                    figure: backtrackFigures.undo,
                    flow: "1手ずつ/取り消す",
                  },
                  {
                    figure: backtrackFigures.restart,
                    flow: "まとめて/取り消す",
                  },
                ]}
              />
            }
          />
          <HowToPlayScoreRow
            measure={`「${undo}」・/「${restart}」`}
            // 正確さは手戻りの手数だけで決まり、押した回数では点を引かない（score.ts）。
            text="押した回数では/下がりません。"
          />
        </>
      );
  }
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じボトルの触れる例と話し言葉の一文を並べる。
 * ルールの例は、本番の盤面と同じく選び・注ぎ・揺れ、どこに注げるかの答えや、選べるかの判定を、本番の判定から求めて添える。
 */
export function WaterSortHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: WaterSortHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="ボトルの水を/注ぎ分けて/色ごとに/1本のボトルに/そろえる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="いちばん上の色が/同じで/まだ入るボトルに/注げます。/空のボトルにも/注げます。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={pourDestinationExample}
                caption={{ kind: "destinations" }}
              />
            }
          />
          {renderRule(
            "上から/同じ色が/重なっていれば/入るだけ/まとめて/注ぎます。",
            amountRuleExamples,
            { kind: "amount" },
          )}
          {renderRule(
            "1色で/いっぱいになった/ボトルは/もう選べません。",
            completeRuleExamples,
            { kind: "selection", rule: "complete" },
          )}
          {renderRule(
            "どこにも/注げない/ボトルは/選べません。",
            destinationRuleExamples,
            { kind: "selection", rule: "no-destination" },
          )}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="注ぎ方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="注ぐ元のボトルを/押して選んでから/注ぐ先のボトルを/押します。/同じボトルを/もう一度押すと/選ぶ前に/戻ります。"
                arrangement="stacked"
                examples={<TouchableExample example={pourOperationExample} />}
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
              text={`「${undo}」で/最後に注いだ1手を/取り消します。`}
              note="時間と手数は/そのままで/押した回数が/増えます。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          {/* 見出しは、プレイ画面の知らせの言葉にそろえる。 */}
          <HowToPlaySection title={DEADLOCK_NOTICE_LABEL}>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="どう注いでも/先へ進めなくなると/盤面の下に/出ます。/注いだ手を/取り消せば/続けられます。"
                arrangement="stacked"
                examples={<DeadlockFigure />}
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
