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
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/fukumenzan/assets/pictogram.svg?raw";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import {
  FUKUMENZAN_SCORE_MAXIMUMS,
  FUKUMENZAN_SPEED_ZERO_SCORE_RATIO,
} from "@/games/fukumenzan/score";
import { EquationFigure } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/EquationFigure";
import { PanelGround } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/ExampleGround";
import {
  createExamplePuzzleState,
  judgeExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  candidateCountFigure,
  crossOperationExample,
  crossShownOperationExample,
  type FukumenzanExampleVerdict,
  type FukumenzanHowToPlayExample,
  leadingZeroRuleExamples,
  moveOperationExample,
  placeOperationExample,
  replaceOperationExample,
  returnOperationExample,
  sameLetterRuleExample,
  sumRuleExamples,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { GoalPlayback } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/GoalPlayback";
import { ignoreFigureEvent } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";
import {
  TouchableExample,
  verdictLabels,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/TouchableExample";
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

/** 例と図を並べる面に敷く地。式のマスは地を透かして描くので、面そのものを本番と同じ方眼の紙にする。 */
const panelGround = <PanelGround />;

/**
 * 形のルール。できる形を触れる例、できない形を押せない図にして対で並べる。できない形は最初から崩れた盤面なので、触る手が無い。
 * 図は札の並びを持たないので、対を短くして見比べやすくする。
 */
function renderPairRule(
  text: string,
  [allowed, disallowed]: readonly [
    FukumenzanHowToPlayExample & { verdict: FukumenzanExampleVerdict },
    FukumenzanHowToPlayExample & { verdict: FukumenzanExampleVerdict },
  ],
  disallowedLabel: string,
) {
  return (
    <HowToPlayRule
      text={text}
      ground={panelGround}
      examples={
        <>
          <TouchableExample example={allowed} />
          <HowToPlayExample
            figure={
              <EquationFigure figure={disallowed} label={disallowedLabel} />
            }
            caption={
              <HowToPlayVerdict
                verdict={judgeExample(
                  disallowed.verdict,
                  createExamplePuzzleState(disallowed),
                )}
                labels={verdictLabels[disallowed.verdict]}
              />
            }
          />
        </>
      }
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
        ground={panelGround}
        examples={<TouchableExample example={example} />}
      />
    </li>
  );
}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、別の問題は新しいプレイを始める。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `札と×を/全部/外して/最初の式に/戻します。/時間と/「${undo}」の回数は/そのまま/続きます。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(FUKUMENZAN_SCORE_MAXIMUMS) as [
  keyof typeof FUKUMENZAN_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: "問題ごとの基準時間以内なら/満点です。/超えると/点が/下がります。",
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
      description="文字に/0〜9の数字を/入れて/足し算を/正しい式に/する/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="同じ文字には/同じ数字を/入れます。/札は/0〜9が/1枚ずつしか/ないので/違う文字には/違う数字が/入ります。"
            arrangement="stacked"
            ground={panelGround}
            examples={<TouchableExample example={sameLetterRuleExample} />}
          />
          {renderPairRule(
            "2桁以上の数の/いちばん左には/1〜9を/入れます。",
            leadingZeroRuleExamples,
            "D に 0 を入れて DDX の先頭が 0 になった式",
          )}
          {renderPairRule(
            "どの桁も/上の数字と/右の桁からの繰り上がりを/足すと/答えの数字に/なるように/します。/3つの数の足し算では/繰り上がりが/2に/なることも/あります。",
            sumRuleExamples,
            "R に 7 を入れて十の位が合わない式",
          )}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="札の入れ方">
            {renderOperation(
              "札を/文字へ/運ぶと/同じ文字の所に/まとめて/入ります。/札を/押してから/文字を/押しても/入ります。",
              placeOperationExample,
            )}
            {renderOperation(
              "札の入った文字に/別の札を/入れると/前の札は/元の所へ/戻ります。",
              replaceOperationExample,
            )}
            {renderOperation(
              "文字に入った札も/別の文字へ/運べます。",
              moveOperationExample,
            )}
            {renderOperation(
              "札の入った文字を/押してから/点線の枠を/押すと/札が/元の所へ/戻ります。/札の並びへ/運んでも/戻ります。",
              returnOperationExample,
            )}
          </HowToPlaySection>
          <HowToPlaySection title="×の付け方">
            {renderOperation(
              "文字を/押してから/札を/押すと/その札に/×が/付きます。/もう一度/押すと/外れます。",
              crossOperationExample,
            )}
            {renderOperation(
              "×は/その文字を/選んでいる間だけ/札に/出ます。/同じ文字を/もう一度/押すか/式と札の/外を/押すと/選ぶのを/やめます。",
              crossShownOperationExample,
            )}
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="×を/付けた/空の文字の/右上の/点線の丸には/×の付いていない/札の数が/出ます。/ほかの文字に/入った札も/数に/入ります。"
                arrangement="stacked"
                resettable={false}
                ground={panelGround}
                examples={
                  <HowToPlayExample
                    figure={
                      <EquationFigure
                        figure={candidateCountFigure}
                        selectedLetter="U"
                        label="D に 8 を入れ U を選んで 2〜7 と 9 に × を付けた式。U の右上に 3"
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
              text={`「${undo}」を/押すと/最後に/動かした札か/付け外しした×が/元に/戻ります。`}
              note={`時間は/そのまま/進み/「${undo}」の回数が/増えます。`}
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
            text="文字の種類が/多く/式の長い問題ほど/長く/なります。"
          />
          <HowToPlayScoreRow
            measure="0点になる時間"
            text={`基準時間の${FUKUMENZAN_SPEED_ZERO_SCORE_RATIO}倍です。`}
          />
          <HowToPlayScoreRow
            measure={`「${undo}」・/「${restart}」・/札の入れ直し・/×の付け外し`}
            text="何回/しても/点は/下がりません。"
          />
        </HowToPlaySection>
      ))}
    />
  );
}
