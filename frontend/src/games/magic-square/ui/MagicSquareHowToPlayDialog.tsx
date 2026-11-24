import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { HowToPlayValueTable } from "@/components/HowToPlayValueTable";
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

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と置き直しの回数を引き継ぎ、置いた数を外してメモも消し、
// 外した数をどれも置き直しに数える。リセットと別の問題は新しいプレイを始める。時間が戻らないことは、待ったではなくここで言う
// （最初の盤面に戻す操作なので、時間も戻ると読まれやすい）。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "置いた数を/外して/メモも/消して/最初の盤面に/戻します。/時間は/戻りません。/外した数の分だけ/置き直しが/増えます。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と/置き直しの回数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルのまま/問題を/変えます。",
  },
];

/**
 * 例の盤面（レベル1と同じ大きさ）のほかの大きさの盤面。置く数と合計は例で見せられないので、ルールの後ろに表で並べ、
 * 大きさごとに値を見比べられるようにする。
 */
const otherBoardSizes = magicSquareBoardSizes.filter(
  (size) => size !== MAGIC_SQUARE_EXAMPLE_SIZE,
);
const otherBoardSizesTitle = `${otherBoardSizes.map((size) => `${size}×${size}`).join("と")}の盤面`;
const otherBoardSizesColumns = ["盤面", "置く数", "左上の合計"] as const;
const otherBoardSizesRows = otherBoardSizes.map((size) => [
  `${size}×${size}`,
  `1〜${getMagicSquareMaxValue(size)}`,
  String(getMagicSquareMagicSum(size)),
]);

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(MAGIC_SQUARE_SCORE_MAXIMUMS) as [
  keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: `問題ごとの基準時間/以内なら/満点です。/超えるほど/下がって/基準時間の${MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO}倍で/0点に/なります。`,
  // 1回に何点引くかと何を1回と数えるかは直後の行が言うので、何で引くかと引いていく元と下限だけを言う。
  accuracy: `置き直しのたびに/${MAGIC_SQUARE_SCORE_MAXIMUMS.accuracy}点から/引きます。/0点より下には/なりません。`,
} as const satisfies Record<keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ呼び名で並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、盤面を読み始める時間に、空いたマスごとの時間を足す。足していく時間を先に言い、元の時間を後ろに置いて、
    // どの語も前の語と組に読まれないようにする。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text={`空いたマス/1つにつき/${MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS / SECOND_MS}秒を/${MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS / SECOND_MS}秒に/足します。`}
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="置き直し"
        deduction={`1回 −${MAGIC_SQUARE_CORRECTION_PENALTY}点`}
        // 本番の session は、置いた数がそのマスから外れたときにその場で数え、回数は減らない。ほかのマスを選ぶ前に同じマスで直した数は、
        // その数で列の端の色が変わっていなければ数えない。文は数え方の決まりと1つの例外を言い、流れの図は例外に当たる直し方と
        // 当たらない直し方を対で見せる。
        text="置いた数が/外れるたびに/画面の上の/「置き直し」が/1回/増えます。/ただし/置いてから/ほかのマスを/選ぶ前に/直した数は/その数で/列の端の色が/変わっていなければ/数えません。"
        figure={
          <CorrectionCountExamples
            examples={[
              {
                figure: correctionCountFlows.changed,
                flow: "列の端の色を/変えた数を/置き換える",
              },
              {
                figure: correctionCountFlows.unchanged,
                flow: "列の端の色を/変えなかった数を/置き換える",
              },
            ]}
          />
        }
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・「${restart}」`}
        // 待ったは同じマスを直す操作の1つなので、上の例外もそのまま当てはまる。盤面を戻すは同じマスを直す操作ではないので、
        // 盤面にあった置いた数をどれも数える。押した回数そのものでは点を引かない（score.ts）。
        text={`「${undo}」で/外れた数も/同じに/数えます。/「${restart}」で/外れた数は/どれも/数えます。`}
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番の盤面部品と盤面の下に並んだ数で描いた触れる例と、話し言葉の一文を並べる。
 * 例は本番と同じく、マスを選んで数を押すと置き・置き換え・外し、列の端の合計と色・受け付けない押し方の揺れと音をその場で返す。
 * 例はどれもレベル1と同じ 4×4 の盤面か、その1行か1列だけで描き、5×5・6×6 の数と合計はルールの後ろのまとまりで言う。
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
      description="マスに/数を/置いて/縦・横・斜めのどの列も/同じ合計に/そろえる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="縦・横・斜めのどの列も/足して/左上の合計に/なれば/完成です。/列の端の合計は/そろうと/緑に/なります。/このままでは/そろわないと/赤に/なります。"
            arrangement={lineRuleExample.arrangement}
            examples={
              <TouchableExample example={lineRuleExample} caption="line" />
            }
          />
          <HowToPlayRule
            text="盤面の下に/並んだ数を/どれも/1回ずつ/置きます。"
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
          <HowToPlaySection title={otherBoardSizesTitle}>
            <li>
              <HowToPlayValueTable
                columns={otherBoardSizesColumns}
                rows={otherBoardSizesRows}
              />
            </li>
          </HowToPlaySection>
        </>
      }
      operations={
        <>
          <HowToPlaySection title="置き方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="マスを押して/選ぶと/そのマスを通る/列が/濃くなります。/盤面の下に/並んだ数を/押すと/そのマスに/置けます。"
                arrangement={placeOperationExample.arrangement}
                examples={<TouchableExample example={placeOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="置いた数を/選んで/別の数を/押すと/置き換えられます。/同じ数を/もう一度/押すと/外せます。"
                arrangement={replaceOperationExample.arrangement}
                examples={
                  <TouchableExample example={replaceOperationExample} />
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
              text={`「${undo}」で/置いた数も/メモも/1つ前に/戻せます。`}
              // 待ったで外れた数を置き直しに数えるかは、ほかの外し方と同じく採点のタブの例外に当たるかで決まる。
              note="外れた数は/ほかの外し方と/同じく/置き直しに/数えます。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          <HowToPlaySection title="メモ">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text={`空いたマスを/選んで/鉛筆のボタンを/押してから/数を/押すと/メモを/1マスに/${MAGIC_SQUARE_MEMO_CAPACITY}つまで/書けます。/同じ数を/もう一度/押すと/消えます。/鉛筆のボタンを/もう一度/押すと/また/数を/置けます。`}
                arrangement={memoOperationExample.arrangement}
                examples={
                  <TouchableExample
                    example={memoOperationExample}
                    caption="memo-limit"
                  />
                }
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="数を/置くと/同じ数のメモは/どのマスからも/消えます。"
                arrangement={memoClearedOperationExample.arrangement}
                examples={
                  <TouchableExample example={memoClearedOperationExample} />
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
