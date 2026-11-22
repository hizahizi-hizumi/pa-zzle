import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/magic-square/assets/pictogram.svg?raw";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import { listMagicSquareValueStates } from "@/games/magic-square/puzzle/rules";
import {
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
  MAGIC_SQUARE_WITHDRAWAL_PENALTY,
} from "@/games/magic-square/score";
import {
  goalFigureBoard,
  overreachedFigureBoard,
  selectedFigureBoard,
  unmatchedFigureBoard,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import { HowToPlayBoardFigure } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/HowToPlayBoardFigure";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
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

function ignoreFigurePress(): void {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と取り下げの回数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間と/取り下げの回数は/そのままで/最初の盤面に/戻します。",
    note: "盤面にあった/置いた数は/どれも/取り下げに/数えます。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と/取り下げの回数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(MAGIC_SQUARE_SCORE_MAXIMUMS) as [
  keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: `問題ごとの/基準時間以内なら/満点です。/超えるほど/点が下がり/基準時間の${MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
  accuracy: `置いた数を/取り下げるたびに/${MAGIC_SQUARE_WITHDRAWAL_PENALTY}点/下がります。`,
} as const satisfies Record<keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS, string>;

function renderScoreRows(item: keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、読み始めの時間に、空きマスごとの時間を足す。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text="空きマスが/多い問題ほど/長くなります。"
      />
    );
  }
  return (
    <HowToPlayScoreRow
      measure="取り下げ"
      deduction={`1回 −${MAGIC_SQUARE_WITHDRAWAL_PENALTY}点`}
      // 本番の session は、置いた数がそのマスから外れた事実を数え、ほかのマスに触れる前の同じマスでの直しを除く。
      text={`外す・/置き換える・/「${undo}」・/「${restart}」の/どれで/外れても/数えます。/同じマスで/ほかのマスに/触れる前に/直した数は/数えません。`}
    />
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番の盤面部品と数の欄で描いた押せない図と、話し言葉の一文を並べる。
 * 図はどれもレベル1と同じ 4×4 で描き、5×5・6×6 の合計は一文で言う。
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
      description="1から/順の数を/1回ずつ/マスに置いて/縦・横・斜めの/どの列も/同じ合計に/そろえる/パズルです。"
      goal={<HowToPlayBoardFigure figure={goalFigureBoard} size="goal" />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="縦・横・斜めの/どの列も/合計を/そろえれば/完成です。/合計は/4×4なら34、/5×5なら65、/6×6なら111で/盤面の左上に/出ています。"
            examples={
              <HowToPlayExample
                figure={
                  <HowToPlayBoardFigure
                    figure={goalFigureBoard}
                    size="example"
                  />
                }
                caption={
                  <HowToPlayPhrases text="そろった列の/端の数は/緑になります。" />
                }
              />
            }
          />
          <HowToPlayRule
            text="4×4なら/1から16までの/数を/1回ずつ/使います。/使った数は/数の欄で/薄くなり/ほかのマスには/置けません。"
            arrangement="stacked"
            examples={
              <HowToPlayExample
                figure={
                  <div inert className="w-[min(100cqw,22rem)]">
                    <MagicSquareNumberPad
                      size={selectedFigureBoard.board.size}
                      valueStates={listMagicSquareValueStates(
                        selectedFigureBoard.givens,
                        selectedFigureBoard.board,
                        null,
                      )}
                      interactionDisabled
                      onEnterValue={ignoreFigurePress}
                    />
                  </div>
                }
              />
            }
          />
          <HowToPlayRule
            text="列の端の数は/その列に/今置いてある数の/合計です。/埋まったのに/合計と違う列と/空きがあるのに/合計に届いた列は/赤い数に/下線が付きます。"
            examples={
              <>
                <HowToPlayExample
                  figure={
                    <HowToPlayBoardFigure
                      figure={unmatchedFigureBoard}
                      size="example"
                    />
                  }
                  caption={<HowToPlayPhrases text="1行目が/埋まって/36" />}
                />
                <HowToPlayExample
                  figure={
                    <HowToPlayBoardFigure
                      figure={overreachedFigureBoard}
                      size="example"
                    />
                  }
                  caption={
                    <HowToPlayPhrases text="1列目に/空きが/あるのに/34" />
                  }
                />
              </>
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
                text="マスを押して選び/下の数の欄で/数を押すと/置けます。/選んだマスを通る列は/明るくなります。/選んだまま/同じ数を押すと外し/別の数を押すと/置き換えます。"
                arrangement="stacked"
                examples={
                  <HowToPlayExample
                    figure={
                      <HowToPlayBoardFigure
                        figure={selectedFigureBoard}
                        size="example"
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
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後の/操作を/1つ/取り消します。`}
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
