import { Undo2 } from "lucide-react";

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
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  calculateNanpureSpeedScoreRule,
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";
import {
  blockRuleExample,
  columnRuleExample,
  completedDigitAssistExample,
  enterOperationExample,
  eraseOperationExample,
  givenRuleExample,
  mistakeAssistExample,
  mistakeCountFlows,
  notesClearedAssistExample,
  notesOperationExample,
  replaceOperationExample,
  rowRuleExample,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/nanpure/ui/NanpureHowToPlayDialog/GoalPlayback";
import { MistakeCountExamples } from "@/games/nanpure/ui/NanpureHowToPlayDialog/MistakeCountExamples";
import { TouchableExample } from "@/games/nanpure/ui/NanpureHowToPlayDialog/TouchableExample";
import { NANPURE_INPUT_LABELS } from "@/games/nanpure/ui/play/input-labels";
import { PlayActionButton } from "@/games/nanpure/ui/play/PlayActionButton";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import { calculateSpeedScore } from "@/games/score";

type NanpureHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: NANPURE_DISPLAY_NAME, pictogramSvg };

const { undo, restart, replay, startNewProblem } = PLAY_OPERATION_LABELS;
const { erase, notes } = NANPURE_INPUT_LABELS;

const MINUTE_MS = 60 * 1_000;

const speedRule = calculateNanpureSpeedScoreRule();

/** 基準時間・超えた時間を数える刻み・0点になる時間（分）と、1刻みで下がる点。score.ts の規則と採点の関数から出す。 */
const speedFullScoreMinutes = speedRule.fullScoreMs / MINUTE_MS;
const speedOvertimeStepMs = speedRule.overtimeStepMs ?? MINUTE_MS;
const speedPenaltyIntervalMinutes = speedOvertimeStepMs / MINUTE_MS;
const speedZeroScoreMinutes = speedRule.zeroScoreMs / MINUTE_MS;
const speedPointsPerInterval =
  NANPURE_SCORE_MAXIMUMS.speed -
  calculateSpeedScore(
    NANPURE_SCORE_MAXIMUMS.speed,
    speedRule.fullScoreMs + speedOvertimeStepMs,
    speedRule,
  );

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継いでメモも消し、
// リセットと別の問題は新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間・ミス・/「${undo}」の回数は/そのままで/メモも/消して/最初の盤面に/戻します。`,
  },
  {
    item: playMenuOperationItems.replay,
    text: `時間・ミス・/「${undo}」の回数も/0に戻して/同じ問題を/最初から/やり直します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(NANPURE_SCORE_MAXIMUMS) as [
  keyof typeof NANPURE_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  // 何を数えて何点引くかは直後の行が言うので、引いていく元と下限だけを言う。
  accuracy: `${NANPURE_SCORE_MAXIMUMS.accuracy}点から/引いていきます。/0点より/下には/なりません。`,
  // score.ts の速さは、基準時間を超えた時間を刻みで切り上げ、1刻みごとに1点引く。
  speed: `基準時間以内なら/満点です。/超えると/${speedPenaltyIntervalMinutes}分ごとに/${speedPointsPerInterval}点/下がって/${speedZeroScoreMinutes}分で/0点です。`,
  stability: `${NANPURE_SCORE_MAXIMUMS.stability}点から/引いていきます。/0点より/下には/なりません。`,
} as const satisfies Record<keyof typeof NANPURE_SCORE_MAXIMUMS, string>;

/** 1回ごとに引く点。score.ts の減点と同じ値から出す。 */
function formatDeduction(penalty: number): string {
  return `1回 −${penalty}点`;
}

/** 点ごとに、数えるものを結果画面の採点基準と同じ順に並べる。 */
function renderScoreRows(item: keyof typeof NANPURE_SCORE_MAXIMUMS) {
  switch (item) {
    case "accuracy":
      return (
        <HowToPlayScoreRow
          measure="ミス"
          deduction={formatDeduction(NANPURE_MISTAKE_PENALTY)}
          text={`答えと/違う/数字を/入れるたびに/数えます。/メモと/「${erase}」は/数えません。`}
          figure={
            <MistakeCountExamples
              examples={[
                {
                  figure: mistakeCountFlows.undo,
                  flow: `入れてから/「${undo}」で/取り消す`,
                },
                {
                  figure: mistakeCountFlows.replace,
                  flow: "入れてから/正しい数字に/入れ替える",
                },
              ]}
            />
          }
        />
      );
    case "speed":
      return (
        <>
          <HowToPlayScoreRow
            measure="基準時間"
            text={`レベルによらず/どの問題も/${speedFullScoreMinutes}分です。`}
          />
          <HowToPlayScoreRow
            measure="超えた時間"
            text={`${speedPenaltyIntervalMinutes}分に/満たなくても/${speedPenaltyIntervalMinutes}分と/数えます。`}
          />
        </>
      );
    case "stability":
      return (
        <>
          <HowToPlayScoreRow
            measure={undo}
            deduction={formatDeduction(NANPURE_UNDO_PENALTY)}
          />
          <HowToPlayScoreRow
            measure={restart}
            deduction={formatDeduction(NANPURE_RESTART_PENALTY)}
          />
          <HowToPlayScoreRow
            measure={`${replay}・/${startNewProblem}`}
            // 本番では新しい session を作るので、それまでの時間・ミス・回数は残らない。
            text="新しいプレイとして/時間も/回数も/0から/数え直します。"
          />
        </>
      );
  }
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面と入力の段の触れる例と、話し言葉の一文を並べる。
 * ルールの例は、本番と同じくマスを選んで数字を押すと変わり、行・列・ブロックで数字が重なると本番と同じ色と ✕ がその場で付く。
 */
export function NanpureHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: NanpureHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="空いたマスに/1〜9の数字を/入れて/盤面を/完成させる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="どの行にも/1〜9が/1つずつ/入ります。"
            arrangement="stacked"
            examples={
              <TouchableExample example={rowRuleExample} caption="unit" />
            }
          />
          <HowToPlayRule
            text="どの列にも/1〜9が/1つずつ/入ります。"
            arrangement={columnRuleExample.arrangement}
            examples={
              <TouchableExample example={columnRuleExample} caption="unit" />
            }
          />
          <HowToPlayRule
            text="太線で/区切った/ブロックにも/1〜9が/1つずつ/入ります。"
            arrangement={blockRuleExample.arrangement}
            examples={
              <TouchableExample example={blockRuleExample} caption="unit" />
            }
          />
          <HowToPlayRule
            text="最初からある数字は/変えられません。"
            arrangement="stacked"
            examples={
              <TouchableExample example={givenRuleExample} caption="given" />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="入れ方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="マスを/選んで/下の数字を/押します。"
                arrangement="stacked"
                examples={<TouchableExample example={enterOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="入れた数字は/別の数字を/押すと/変わります。"
                arrangement="stacked"
                examples={
                  <TouchableExample example={replaceOperationExample} />
                }
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="答えと/違う/数字は/入れると/すぐ/赤くなります。"
                arrangement="stacked"
                examples={<TouchableExample example={mistakeAssistExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="正しい所に/9つ/そろった数字は/下の数字を/押せなくなります。"
                arrangement="stacked"
                examples={
                  <TouchableExample example={completedDigitAssistExample} />
                }
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title={notes}>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text={`「${notes}」を/オンにして/数字を/押すと/小さく/書けます。/同じ数字を/もう一度/押すと/消えます。`}
                arrangement="stacked"
                examples={<TouchableExample example={notesOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="正しい数字を/入れると/同じ行・列・ブロックの/メモから/その数字が/消えます。"
                arrangement="stacked"
                examples={
                  <TouchableExample example={notesClearedAssistExample} />
                }
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="消し方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text={`「${erase}」で/選んだマスの/数字も/メモも/消します。`}
                arrangement="stacked"
                examples={<TouchableExample example={eraseOperationExample} />}
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <PlayActionButton
                    icon={<Undo2 />}
                    label={undo}
                    onClick={ignoreFigurePress}
                  />
                </span>
              }
              text={`「${undo}」で/数字も/メモも/1つ前に/戻します。`}
              // 本番の session では、待ったは経過時間とミスを変えない。
              note={`時間・ミスは/そのままで/「${undo}」の回数が/増えます。`}
            />
            <HowToPlayMenuOperations operations={menuOperations} />
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
