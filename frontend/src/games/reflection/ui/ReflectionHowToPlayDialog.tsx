import {
  type HowToPlayKey,
  HowToPlayKeyTable,
} from "@/components/HowToPlayKeyTable";
import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import pictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  REFLECTION_SCORE_MAXIMUMS,
  REFLECTION_SPEED_ZERO_SCORE_RATIO,
} from "@/games/reflection/score";
import {
  blackHoleRuleExamples,
  completionRuleExample,
  countRuleExamples,
  doubleMirrorRuleExamples,
  exitRuleExamples,
  laserOperationExample,
  mirrorRuleExamples,
  moveOperationExample,
  placeOperationExample,
  type ReflectionHowToPlayExample,
  type ReflectionHowToPlayExamplePair,
  reflectorRuleExamples,
  swapOperationExample,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/reflection/ui/ReflectionHowToPlayDialog/GoalPlayback";
import {
  TouchableExample,
  type TouchableExampleCaption,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/TouchableExample";

type ReflectionHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: REFLECTION_DISPLAY_NAME, pictogramSvg };

const { restart } = PLAY_OPERATION_LABELS;

/** 対の2つの例を、左と右の別の盤面として並べるルール。 */
function renderPairRule(
  text: string,
  [left, right]: ReflectionHowToPlayExamplePair,
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

/** 操作の例1つ。まとまりの見出しの下に、一文と、言葉を添えない触れる例を置く。 */
function renderOperation(text: string, example: ReflectionHowToPlayExample) {
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

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と置き直しの回数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。待ったは本番に無いので並べない。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "置いたピースを/すべて/ストックに/戻します。/時間と/置き直しの回数は/そのままです。",
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
 * キーボードの表。矢印キーは盤面の中のフォーカスを、マスと外周の数字の間で動かす。
 * 数字キーと Esc は、プレイ画面がどこにフォーカスがあっても受ける。
 */
const keyboardKeys: readonly HowToPlayKey[] = [
  {
    keys: ["↑", "↓", "←", "→"],
    description: "枠を/上下左右の/マスや数字へ/1つずつ/動かします。",
  },
  { keys: ["Enter", "Space"], description: "枠の付いた所を/押します。" },
  {
    keys: ["1〜9"],
    description: "ストックで/左から/その番号の/ピースを/押します。",
  },
  {
    keys: ["Delete", "Backspace"],
    description: "枠の付いたマスの/ピースを/ストックに/戻します。",
  },
  { keys: ["Esc"], description: "ピースを/選ぶのを/やめます。" },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(REFLECTION_SCORE_MAXIMUMS) as [
  keyof typeof REFLECTION_SCORE_MAXIMUMS,
  number,
][];

// 結果画面の採点基準と同じく、問題ごとの基準時間との差で決まり、どこまで下がるかを言う。
const scoreLeads = {
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/点が/下がります。/基準時間の/${REFLECTION_SPEED_ZERO_SCORE_RATIO}倍かかると/0点です。`,
} as const satisfies Record<keyof typeof REFLECTION_SCORE_MAXIMUMS, string>;

/**
 * 結果画面の採点基準と同じく、点に入らないものを評価の項目の後に別のまとまりで並べる。
 * 置き直しは結果に示すが評価には使わず（score.ts は経過時間だけで採点する）、盤面を戻して回収したピースは本番の session でも数えない。
 */
const notScoredLead = `置き直し・/「${restart}」・/光路の確認は/何回でも/点は下がりません。`;

/**
 * 遊び方。触れる例は、本番の盤面とストックの部品と session の操作で動かす（`TouchableExample`）。
 */
export function ReflectionHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: ReflectionHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="外周の数字どおりに/光が進むように/手持ちのピースを/すべて盤面に置く/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderPairRule(
            "数字から/入れた光が/その数だけ/マスを通り/印のとおりに/進むように/ピースを置きます。/合った数字は/緑になります。",
            countRuleExamples,
            "match",
          )}
          {renderPairRule(
            "別の所から/出る光は/出た先の数字も/同じ数字に/そろえます。",
            exitRuleExamples,
            "match",
          )}
          {renderPairRule(
            "斜め鏡は/光を/直角に/曲げます。",
            mirrorRuleExamples,
            "light",
          )}
          {renderPairRule(
            "反射鏡は/どの向きの光も/はね返します。/戻る分の/マスも/数えます。",
            reflectorRuleExamples,
            "light",
          )}
          {renderPairRule(
            "両面鏡は/鏡に沿って進む光を/そのまま通します。/正面から当たる光は/はね返します。",
            doubleMirrorRuleExamples,
            "light",
          )}
          {renderPairRule(
            "ブラックホールは/光を/吸い込みます。/ブラックホールの/マスまで/数えます。",
            blackHoleRuleExamples,
            "light",
          )}
          <HowToPlayRule
            text="手持ちのピースを/すべて置いて/どの数字も/緑になれば/完成です。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={completionRuleExample}
                caption="completion"
              />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="置き方">
            {renderOperation(
              "ストックで/ピースを選んでから/空いたマスを/押して置きます。/同じピースが/残っていれば/選び直さずに/続けて置けます。",
              placeOperationExample,
            )}
            {renderOperation(
              "置いたピースを/押して選んでから/ほかのマスを押すと/そこへ/移ります。/ピースのあるマスなら/入れ替わります。",
              moveOperationExample,
            )}
            {renderOperation(
              "置いたピースを/選んで/ストックの/別のピースを押すと/そのピースに/置き換わります。/同じピースを押すと/ストックに/戻ります。",
              swapOperationExample,
            )}
          </HowToPlaySection>
          <HowToPlaySection title="光路">
            {renderOperation(
              "数字を押すと/そこから入れた光の/今の光路が/見えます。/合っていない数字には/その光が通る/マスの数も/出ます。",
              laserOperationExample,
            )}
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          <HowToPlaySection title="キーボード" availability="fine-pointer">
            <li>
              <HowToPlayKeyTable keys={keyboardKeys} />
            </li>
          </HowToPlaySection>
        </>
      }
      scoring={
        <>
          {scoreItems.map(([item, maximum]) => (
            <HowToPlaySection
              key={item}
              title={SCORE_ITEM_LABELS[item]}
              value={`${maximum}点`}
              lead={scoreLeads[item]}
            >
              <HowToPlayScoreRow
                measure="基準時間"
                // score.ts の基準時間は、外周の数字の本数・ピースの数と、外周の数字から読んで決める手間（照らし直す局面・仮に置く回数）から決まる。
                text="外周の数字と/ピースが/多くて/解く手間の/かかる問題ほど/長くなります。"
              />
            </HowToPlaySection>
          ))}
          <HowToPlaySection title="点に入らないもの" lead={notScoredLead}>
            <HowToPlayScoreRow
              measure="置き直し"
              text={`置いたピースを/移す・/入れ替える・/置き換える・/ストックに戻す/たびに/1回と数えます。/「${restart}」で/戻したピースは/数えません。`}
            />
          </HowToPlaySection>
        </>
      }
    />
  );
}
