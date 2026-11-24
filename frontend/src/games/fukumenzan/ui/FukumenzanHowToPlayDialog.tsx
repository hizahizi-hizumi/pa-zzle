import { HowToPlayExample } from "@/components/HowToPlayExample";
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
import pictogramSvg from "@/games/fukumenzan/assets/pictogram.svg?raw";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import {
  FUKUMENZAN_SCORE_MAXIMUMS,
  FUKUMENZAN_SPEED_ZERO_SCORE_RATIO,
} from "@/games/fukumenzan/score";
import { EquationFigure } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/EquationFigure";
import {
  candidateCountFigure,
  crossOperationExample,
  dragOperationExample,
  type FukumenzanHowToPlayExample,
  leadingZeroRuleExamples,
  moveOperationExample,
  replaceOperationExample,
  returnOperationExample,
  sameLetterRuleExample,
  sumRuleExamples,
  tapOperationExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { GoalPlayback } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/GoalPlayback";
import { ignoreFigureEvent } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";
import { TouchableExample } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/TouchableExample";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type FukumenzanHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: FUKUMENZAN_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 形のルール。できる形とできない形の対を並べる。 */
function renderPairRule(
  text: string,
  examples: readonly FukumenzanHowToPlayExample[],
) {
  return (
    <HowToPlayRule
      text={text}
      examples={examples.map((example) => (
        <TouchableExample
          key={JSON.stringify(example.placed)}
          example={example}
        />
      ))}
    />
  );
}

/** 操作の例1つ。まとまりの見出しの下に、一文と触れる例を置く。 */
function renderOperation(text: string, example: FukumenzanHowToPlayExample) {
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

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、別の問題は新しいプレイを始める。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間と/「${undo}」の回数は/そのままで/札と/×を/全部/外した/最初の式に/戻します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(FUKUMENZAN_SCORE_MAXIMUMS) as [
  keyof typeof FUKUMENZAN_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: "問題ごとの/基準時間以内なら/満点です。/超えると/点が/下がります。",
} as const satisfies Record<keyof typeof FUKUMENZAN_SCORE_MAXIMUMS, string>;

/**
 * 遊び方。ルール・操作・採点のタブで、本番の式と札の列の部品で描いた触れる例と話し言葉の一文を並べる。
 * 例は本番の遷移で動き、先頭の0と計算違いの知らせとクリア演出を本番と同じに返す。
 */
export function FukumenzanHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: FukumenzanHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="文字ごとに/0〜9の/数字を/1つずつ/当てて/足し算を/成り立たせる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="同じ文字には/同じ数字を/当てます。/札は/0〜9が/1枚ずつ/なので/違う文字には/違う数字が/入ります。"
            arrangement="stacked"
            examples={<TouchableExample example={sameLetterRuleExample} />}
          />
          {renderPairRule(
            "2桁以上の/数の/先頭には/1〜9を/当てます。",
            leadingZeroRuleExamples,
          )}
          {renderPairRule(
            "どの桁も/右の桁からの/繰り上がりまで/足して/答えの/数字に/合わせます。/全部の/桁が/合えば/クリアです。",
            sumRuleExamples,
          )}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="札の入れ方">
            {renderOperation(
              "札を/文字へ/運ぶと/その文字の/全部の/場所に/入ります。",
              dragOperationExample,
            )}
            {renderOperation(
              "札を/押してから/文字を/押しても/入ります。",
              tapOperationExample,
            )}
            {renderOperation(
              "札の入った/文字へ/別の札を/入れると/前の札は/列へ/戻ります。",
              replaceOperationExample,
            )}
            {renderOperation(
              "札の入った/文字から/別の文字へ/運ぶと/札が/移ります。",
              moveOperationExample,
            )}
            {renderOperation(
              "札の入った/文字を/押してから/列の/空いた所を/押すと/札が/列へ/戻ります。/列へ/運んでも/戻ります。",
              returnOperationExample,
            )}
          </HowToPlaySection>
          <HowToPlaySection title="×の付け方">
            {renderOperation(
              "文字を/押してから/札を/押すと/その文字に/入らない/札に/×が/付きます。/もう一度/押すと/外れます。",
              crossOperationExample,
            )}
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="×は/その文字を/選んでいる間だけ/札に/出ます。/空の文字の/右上の/点線の/丸は/×の無い/札の/数です。"
                arrangement="stacked"
                resettable={false}
                examples={
                  <HowToPlayExample
                    figure={
                      <EquationFigure
                        figure={candidateCountFigure}
                        label="U に 2〜9 の × を付け、U の右上に 2 と出た式"
                      />
                    }
                  />
                }
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigureEvent} />
                </span>
              }
              text={`「${undo}」を/押すと/最後の/札か/×の/操作が/元に戻ります。`}
              note={`時間は/そのままで/「${undo}」の回数が/増えます。`}
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
          <HowToPlayScoreRow
            measure="基準時間"
            text="文字の/種類と/式に/書かれた/文字が/多い問題ほど/長くなります。"
          />
          <HowToPlayScoreRow
            measure="0点になる時間"
            text={`基準時間の/${FUKUMENZAN_SPEED_ZERO_SCORE_RATIO}倍です。`}
          />
          <HowToPlayScoreRow
            measure={`「${undo}」・/「${restart}」・/札の入れ直し・/×`}
            text="何回/しても/点は/下がりません。"
          />
        </HowToPlaySection>
      ))}
    />
  );
}
