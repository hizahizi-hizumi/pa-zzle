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
import pictogramSvg from "@/games/magic-square/assets/pictogram.svg?raw";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import { magicSquareBoardSizes } from "@/games/magic-square/problem/problem";
import {
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
} from "@/games/magic-square/puzzle/board";
import { MAGIC_SQUARE_MEMO_CAPACITY } from "@/games/magic-square/puzzle/rules";
import {
  MAGIC_SQUARE_CORRECTION_PENALTY,
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
  MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
  MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/magic-square/score";
import { CorrectionCountExamples } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/CorrectionCountExamples";
import { MAGIC_SQUARE_EXAMPLE_SIZE } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import {
  correctionCountFlows,
  givenRuleExample,
  lineRuleExample,
  memoClearedOperationExample,
  memoOperationExample,
  placeOperationExample,
  replaceOperationExample,
  usedValueRuleExample,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/GoalPlayback";
import { TouchableExample } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/TouchableExample";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type MagicSquareHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: MAGIC_SQUARE_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

const SECOND_MS = 1_000;

function ignoreFigurePress(): void {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と置き直しの回数を引き継いでメモも消し、
// リセットと別の問題は新しいプレイを始める。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間と/置き直しの回数は/そのままで/置いた数も/メモも/消して/最初の盤面に/戻します。",
    note: "盤面にあった/置いた数は/どれも/置き直しに/数えます。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と/置き直しの回数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/**
 * 使う数のルール。例の盤面（レベル1と同じ大きさ）の数と合計は例が見せるので、ほかの大きさの盤面の数と合計を続けて言う。
 */
const otherBoardSizes = magicSquareBoardSizes.filter(
  (size) => size !== MAGIC_SQUARE_EXAMPLE_SIZE,
);
const valueRangeText = [
  "数の欄の/数を/どれも/1回ずつ/置きます。",
  `${otherBoardSizes
    .map(
      (size) =>
        `${size}×${size}は/1から${getMagicSquareMaxValue(size)}までで/合計${getMagicSquareMagicSum(size)}`,
    )
    .join("・/")}です。`,
].join("/");

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(MAGIC_SQUARE_SCORE_MAXIMUMS) as [
  keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: `問題ごとの/基準時間/以内なら/満点です。/超えるほど/下がり/基準時間の${MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
  // 何を数えて何点引くかは直後の行が言うので、引いていく元と下限だけを言う。
  accuracy: `${MAGIC_SQUARE_SCORE_MAXIMUMS.accuracy}点から/引いていきます。/0点より/下には/なりません。`,
} as const satisfies Record<keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ呼び名で並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、読み始めの時間に、空きマスごとの時間を足す。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text={`読み始めの/${MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS / SECOND_MS}秒に/空きマス/1つにつき/${MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS / SECOND_MS}秒を/足した/時間です。`}
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="置き直し"
        deduction={`1回 −${MAGIC_SQUARE_CORRECTION_PENALTY}点`}
        // 本番の session は、置いた数がそのマスから外れた事実を数える。列の端の数の色を変えなかった数のほかのマスを選ぶ前の直しと、
        // 色を変えた数を数の欄の隣り合う数へすぐ直した1回は、押し間違いの直しとして除く。後者は流れの図で見せる。
        text={`置いた数を/外す・/置き換える・/「${undo}」・/「${restart}」の/どれで/外しても/1回です。/置いても/列の端の数の/色が/変わらなかった数は/ほかのマスを/選ぶ前に/直せば/数えません。`}
        figure={
          <CorrectionCountExamples
            examples={[
              {
                figure: correctionCountFlows.changed,
                flow: "色が/変わった数を/別の数に/置き換える",
              },
              {
                figure: correctionCountFlows.mistyped,
                flow: "色が/変わった数を/数の欄で/隣の数に/すぐ/置き換える",
              },
            ]}
          />
        }
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・/「${restart}」`}
        // 正確さは置き直しの回数だけで決まり、待った・盤面を戻すを使った回数では点を引かない（score.ts）。
        text="使った回数では/点は下がりません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番の盤面部品と数の欄で描いた触れる例と、話し言葉の一文を並べる。
 * 例は本番と同じく、マスを選んで数を押すと置き・置き換え・外し、列の端の合計と色・受け付けない押し方の揺れと音をその場で返す。
 * 例はどれもレベル1と同じ 4×4 の盤面か、その1行だけで描き、5×5・6×6 の数と合計は一文で言う。
 */
export function MagicSquareHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: MagicSquareHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="1から/順の数を/1つずつ/マスに置いて/縦・横・斜めの/どの列も/同じ合計に/そろえる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="縦・横・斜めの/どの列も/足すと/左上の/合計に/なれば/完成です。/列の端に/その列の/今の合計が/出ます。"
            arrangement={lineRuleExample.arrangement}
            examples={
              <TouchableExample example={lineRuleExample} caption="line" />
            }
          />
          <HowToPlayRule
            text={valueRangeText}
            arrangement={usedValueRuleExample.arrangement}
            examples={
              <TouchableExample
                example={usedValueRuleExample}
                caption="used-values"
              />
            }
          />
          <HowToPlayRule
            text="最初から/置いてある数は/変えられません。"
            arrangement={givenRuleExample.arrangement}
            examples={
              <TouchableExample example={givenRuleExample} caption="given" />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="置き方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="マスを押して/選ぶと/そのマスを通る/列に/色が付きます。/下の数の欄で/数を押すと/置けます。"
                arrangement={placeOperationExample.arrangement}
                examples={<TouchableExample example={placeOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="置いた数を/選んで/別の数を/押すと/置き換わります。/同じ数を/もう一度/押すと/外れます。"
                arrangement={replaceOperationExample.arrangement}
                examples={
                  <TouchableExample example={replaceOperationExample} />
                }
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="メモ">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text={`鉛筆の/ボタンを/押してから/数を押すと/空いたマスに/${MAGIC_SQUARE_MEMO_CAPACITY}つまで/メモを/書けます。/同じ数を/もう一度/押すと/消えます。`}
                arrangement={memoOperationExample.arrangement}
                examples={<TouchableExample example={memoOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="数を/置くと/同じ数の/メモは/どのマスからも/消えます。"
                arrangement={memoClearedOperationExample.arrangement}
                examples={
                  <TouchableExample example={memoClearedOperationExample} />
                }
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
              text={`「${undo}」で/数も/メモも/1つ前に/戻します。`}
              note="時間は/そのままです。"
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
