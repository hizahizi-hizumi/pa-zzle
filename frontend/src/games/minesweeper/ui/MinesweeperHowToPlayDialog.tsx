import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { howToPlayAvailabilityClassNames } from "@/components/how-to-play-availability";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
  MINESWEEPER_SPEED_ZERO_SCORE_RATIO,
} from "@/games/minesweeper/score";
import { createMinesweeperExampleBoard } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import {
  chordOperationExample,
  completionRuleExample,
  flagOperationExample,
  mineCountRuleExample,
  numberRuleExample,
  revealOperationExample,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/GoalPlayback";
import { HowToPlayBoard } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayBoard";
import { MistakeCountFlows } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/MistakeCountFlows";
import { TouchableExample } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/TouchableExample";
import { SCORE_ITEM_LABELS } from "@/games/play-vocabulary";

type MinesweeperHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: MINESWEEPER_DISPLAY_NAME, pictogramSvg };

/** 採点の数えるもの。結果画面の採点基準と同じ呼び名にする。 */
const steppedMineMeasure = "踏んだ地雷";

/** 旗のマスの静止の図。本番の旗のマスと同じ見た目にする。 */
const flagCellFigure = createMinesweeperExampleBoard(["f"]);

// プレイ中のメニューには待ったと盤面を戻すが無く、リセットと別の問題だけがある。
// 何が0に戻るかは本番に合わせ、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.replay,
    text: "同じ問題を/最初から/やり直します。/時間と/ミスも/0に/戻ります。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(MINESWEEPER_SCORE_MAXIMUMS) as [
  keyof typeof MINESWEEPER_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  // 何を数えて何点引くかは直後の行が言うので、引いていく元と下限だけを言う。
  accuracy: `${MINESWEEPER_SCORE_MAXIMUMS.accuracy}点から/引いていきます。/0点より/下には/なりません。`,
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${MINESWEEPER_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof MINESWEEPER_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ順に並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof MINESWEEPER_SCORE_MAXIMUMS) {
  if (item === "speed") {
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        // score.ts の基準時間は、盤面把握の時間に、地雷の数と、地雷ではないマスをすべて開くのに要る開く操作の最小回数に応じた時間を足す。
        text="地雷が/多い問題ほど/長くなります。/すべて/開くまでに/要る/手数が/多い問題も/長くなります。"
      />
    );
  }
  return (
    <HowToPlayScoreRow
      measure={steppedMineMeasure}
      deduction={`1個 −${MINESWEEPER_MISTAKE_PENALTY}点`}
      // 本番の session は、1回の操作で踏んだ地雷をすべてミスに足す。
      text="上の「ミス」に/出る数です。/1回/押して/2個/踏むと/2個と/数えます。"
      figure={<MistakeCountFlows measure={steppedMineMeasure} />}
    />
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * ルールの例は、閉じたマスごとに、開くと地雷ではないか（✓）地雷か（✕）の札を付け、本番と同じに開いたり踏んだりできる。
 */
export function MinesweeperHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: MinesweeperHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="数字を/手がかりに/地雷ではない/マスを/すべて/開く/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="数字の/周りの8マスには/その数だけ/地雷があります。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={numberRuleExample}
                caption="candidates"
              />
            }
          />
          <HowToPlayRule
            text="地雷が/全部で/いくつかは/上の「地雷」に/出ます。/数字と/この数だけで/推測しなくても/どのマスも/地雷か/どうかが/分かります。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={mineCountRuleExample}
                caption="candidates"
                showsMineCount
              />
            }
          />
          <HowToPlayRule
            text="地雷を/踏んでも/続けられます。/地雷ではない/マスが/すべて/開けば/完成です。"
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
          <HowToPlaySection title="開き方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="マスを押すと/開きます。/周りに/地雷が/なければ/周りの/マスも/続けて/開きます。"
                arrangement="stacked"
                examples={<TouchableExample example={revealOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="数字の/周りに/同じ数だけ/旗を/置いて/その数字を/押すと/残りの/マスが/まとめて/開きます。/旗の/場所が/違うと/地雷を/踏みます。"
                arrangement="stacked"
                examples={<TouchableExample example={chordOperationExample} />}
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="旗">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="旗に/切り替えて/マスを押すか/マスを/長押しすると/旗を/置けます。/もう一度/同じように/押すと/外せます。"
                arrangement="stacked"
                // 切り替えて押すのも長押しも、同じ盤面の同じマスに旗を置く入力の違いなので、1つの例で両方を試せるようにする。
                examples={
                  <TouchableExample
                    example={flagOperationExample}
                    showsModeToggle
                  />
                }
              />
            </li>
            <li className={howToPlayAvailabilityClassNames["fine-pointer"]}>
              <HowToPlayRule
                headingLevel={4}
                text="右クリックでも/旗を/置いたり/外したり/できます。"
                arrangement="stacked"
                examples={
                  <TouchableExample
                    example={flagOperationExample}
                    hintPress="secondary-press"
                  />
                }
              />
            </li>
            <HowToPlayOperationRow
              visual={
                // 本番の旗のマスそのままの、押しても何も起きない静止の図。
                <span className="flex [--minesweeper-figure-cell:32px]">
                  <HowToPlayBoard example={flagCellFigure} size="inherited" />
                </span>
              }
              text="旗は/目印として/自由に/置けます。/違う所に/置いても/ミスには/なりません。"
              note="旗の/マスは/押しても/開きません。/置いた数は/上の「旗」に/出ます。"
            />
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
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
