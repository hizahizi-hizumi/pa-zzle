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
import { SolitaireCardBack } from "@/games/solitaire/ui/board/SolitaireCardBack";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { ColumnPlacementExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/ColumnPlacementExample";
import { FigureColumn } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureColumn";
import { FoundationPlacementExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FoundationPlacementExample";
import {
  clubSeven,
  heartFive,
  heartFour,
  heartJack,
  heartKing,
  heartSeven,
  heartsUpToThree,
  heartTen,
  placeLabels,
  runColumn,
  runStart,
  spadeAce,
  spadeEight,
  spadeQueen,
  stackLabels,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-examples";
import { GoalFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/GoalFigure";
import { StockFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/StockFigure";
import { SOLITAIRE_RETRACTED_MOVE_LABEL } from "@/games/solitaire/ui/score-vocabulary";
import { SOLITAIRE_STUCK_NOTICE_LABEL } from "@/games/solitaire/ui/stuck-notice";

type SolitaireHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const game = { name: SOLITAIRE_DISPLAY_NAME, pictogramSvg };

const { undo } = PLAY_OPERATION_LABELS;

function ignoreFigurePress() {}

/** 3つの違い（時間を残すか、0に戻すか、問題を変えるか）を一文ずつで言う。盤面を戻すは時間を残し、リセットと別の問題は0から数える。 */
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間は/そのままで/配った直後の/盤面に/戻します。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間も/0に戻して/同じ問題を/最初から/やり直します。",
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

const scoreLeads = {
  stability:
    "打った手を/取り消さずに/運び切るほど/高くなります。/山札をめくった手は/取り消しても/下がりません。",
  speed: `基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${SOLITAIRE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof SOLITAIRE_SCORE_MAXIMUMS, string>;

function renderScoreRows(item: keyof typeof SOLITAIRE_SCORE_MAXIMUMS) {
  switch (item) {
    case "stability":
      return (
        <HowToPlayScoreRow
          measure={SOLITAIRE_RETRACTED_MOVE_LABEL}
          deduction={`1手 −${SOLITAIRE_RETRACTED_MOVE_PENALTY}点`}
          text={`「${PLAY_OPERATION_PHRASES.undo}」で/戻した手と、/「${PLAY_OPERATION_PHRASES.restart}」で/なくなった手を/数えます。`}
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
 * 遊び方。ルール・操作・採点のタブで、本番と同じ札の図と一文を並べる。
 * 置けるかの判定は、本番の規則の関数で求める。
 */
export function SolitaireHowToPlayDialog({
  open,
  onClose,
}: SolitaireHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="7つの列と/山札の札を/動かして、/4つのマークの札を/AからKまで/組札に/積み上げる/パズルです。"
      goal={<GoalFigure />}
      onClose={onClose}
      rules={
        <>
          <HowToPlayRule
            text="列の一番手前には、/数が1つ小さく/色の違う札を/重ねられます。"
            examples={
              <>
                <ColumnPlacementExample
                  base={[spadeEight]}
                  placed={[heartSeven]}
                  labels={stackLabels}
                />
                <ColumnPlacementExample
                  base={[spadeEight]}
                  placed={[clubSeven]}
                  labels={stackLabels}
                />
              </>
            }
          />
          <HowToPlayRule
            text="そう重なった/並びは、/途中の札から/手前の札ごと/まとめて/動かせます。"
            arrangement="stacked"
            examples={
              <HowToPlayExample
                figure={<FigureColumn cards={runColumn} selected />}
                caption={`${runColumn.length - runStart}枚まで、まとめて動かせる`}
              />
            }
          />
          <HowToPlayRule
            text="空いた列には、/Kから始まる/並びだけを/置けます。"
            examples={
              <>
                <ColumnPlacementExample
                  base={[]}
                  placed={[heartKing, spadeQueen]}
                  labels={placeLabels}
                />
                <ColumnPlacementExample
                  base={[]}
                  placed={[spadeQueen, heartJack]}
                  labels={placeLabels}
                />
              </>
            }
          />
          <HowToPlayRule
            text="組札には、/同じマークの札を/Aから/数の順に/置きます。/組札の一番上の札は/列へ戻せます。"
            examples={
              <>
                <FoundationPlacementExample
                  foundations={heartsUpToThree}
                  card={heartFour}
                />
                <FoundationPlacementExample
                  foundations={heartsUpToThree}
                  card={heartFive}
                />
              </>
            }
          />
          <HowToPlayRule
            text="山札は/1枚ずつ/めくって/捨て札に/重ねます。/捨て札の一番上の札を/使えます。/山札が/空になったら/捨て札を/山札へ戻して、/何周でも/めくれます。"
            arrangement="stacked"
            examples={<HowToPlayExample figure={<StockFigure />} />}
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="動かし方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="動かす元の山を/押して選んでから、/置く先の山を/押します。/列は/どの札を押しても/その列を選び、/動かす札は/置く先に合わせて/決まります。/同じ山を/もう一度押すと/選ぶ前に/戻ります。"
                arrangement="stacked"
                examples={
                  <HowToPlayExample
                    figure={
                      <span className="flex items-start gap-3">
                        <FigureColumn cards={runColumn} selected />
                        <FigureColumn cards={[heartTen]} />
                      </span>
                    }
                  />
                }
              />
            </li>
            <HowToPlayOperationRow
              visual={
                <span aria-hidden="true" className="flex">
                  <SolitaireCardBack width={34} />
                </span>
              }
              text="山札を押すと/1枚めくります。/空の山札を押すと/捨て札を/山札へ戻します。"
            />
            <HowToPlayOperationRow
              visual={
                <span aria-hidden="true" className="flex">
                  <SolitaireCardFace card={spadeAce} width={34} />
                </span>
              }
              text="組札へ置くときは、/4つの組札の/どれを押しても、/札のマークの/組札へ置きます。"
            />
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後に打った1手を/取り消します。/山札をめくった手も/1手です。`}
              note="時間は/そのままで/押した回数が/増えます。"
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
          {/* 見出しは、プレイ画面の知らせの言葉にそろえる。 */}
          <HowToPlaySection
            title={SOLITAIRE_STUCK_NOTICE_LABEL}
            lead="どう動かしても/今より多くの札を/組札へ/運べなくなると、/盤面の下に/出ます。/打った手を/取り消せば/続けられます。"
          />
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
