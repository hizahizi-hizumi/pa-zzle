import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
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
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BOARD_SIZES,
} from "@/games/slide-puzzle/puzzle/state";
import {
  calculateSlidePuzzlePlayScore,
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
  SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
  SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO,
  slidePuzzleSpeedInitialRecognitionMsByBoardSize,
} from "@/games/slide-puzzle/score";
import {
  carryRuleExamples,
  lineRuleExample,
  moveCountFlows,
  type SlidePuzzleFlowFrame,
  type SlidePuzzleMoveCountFlow,
  solvedRuleExamples,
  tapOperationExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/GoalPlayback";
import { HowToPlayFigure } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/HowToPlayFigure";
import { TouchableExample } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/TouchableExample";

type SlidePuzzleHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: SLIDE_PUZZLE_DISPLAY_NAME, pictogramSvg };

const { restart } = PLAY_OPERATION_LABELS;

/** 本番の session は、盤面を戻しても開始時刻と手数を残し、リセットと別の問題は新しいプレイを始める。待ったは無い。 */
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

const keyboardKeys: readonly HowToPlayKey[] = [
  {
    keys: ["↑", "↓", "←", "→"],
    description: "矢印の/向きへ/空白の隣の/タイルを/スライドさせます。",
  },
];

/** 手数が最短の手数の `times` 倍のときの効率の点。本番の採点の式で求める。 */
function getEfficiencyAt(times: number): number {
  const optimalMoveCount = 12;
  return calculateSlidePuzzlePlayScore({
    elapsedMs: 0,
    moveCount: optimalMoveCount * times,
    optimalMoveCount,
    boardSize: 3,
  }).breakdown.efficiency;
}

function formatBoardSize(size: number): string {
  return `${size}×${size}`;
}

/** 例の盤面より大きい、レベルが上がると出る盤面。 */
const largerBoardNames = SLIDE_PUZZLE_BOARD_SIZES.filter(
  (size) => size > getSlidePuzzleBoardSize(lineRuleExample.board),
)
  .map(formatBoardSize)
  .join("・");

/** score.ts の基準時間は、盤面の大きさで決まる時間に、最短の手数1手ごとの時間を足す。 */
const speedFullScoreText = `盤面の/大きさで/決まる/時間/（${SLIDE_PUZZLE_BOARD_SIZES.map(
  (size) =>
    `${formatBoardSize(size)}は/${slidePuzzleSpeedInitialRecognitionMsByBoardSize[size] / 1000}秒`,
).join(
  "・/",
)}）に/最短の手数/1手ごとに/${SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒を/足した/時間です。`;

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(SLIDE_PUZZLE_SCORE_MAXIMUMS) as [
  keyof typeof SLIDE_PUZZLE_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  // 効率は最短の手数÷手数の比で配点するので、0点にはならず、倍になるごとの点を言う。
  efficiency: `手数が/最短の手数より/多いほど/下がります。/最短の手数の/2倍なら/${getEfficiencyAt(2)}点です。/3倍なら/${getEfficiencyAt(3)}点です。`,
  speed: `基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO}倍/かかると/0点です。`,
} as const satisfies Record<keyof typeof SLIDE_PUZZLE_SCORE_MAXIMUMS, string>;

function toFlowFigure(
  { frames, movedTileCount }: SlidePuzzleMoveCountFlow,
  caption: string,
) {
  return {
    frames,
    steps: [`${movedTileCount}枚/スライド`],
    caption,
    count: { label: "手数", value: `${movedTileCount}手` },
  };
}

const moveCountFigures = [
  toFlowFigure(moveCountFlows.adjacent, "空白の隣の/タイルを/タップする"),
  toFlowFigure(moveCountFlows.distant, "空白から/離れた/タイルを/タップする"),
];

function renderFlowFrame(frame: SlidePuzzleFlowFrame) {
  return <HowToPlayFigure board={frame.board} pressedTile={frame.tappedTile} />;
}

function renderScoreRows(item: keyof typeof SLIDE_PUZZLE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    return <HowToPlayScoreRow measure="基準時間" text={speedFullScoreText} />;
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="手数"
        text="プレイ画面の/「手数」と/同じく/スライドした/タイルの/枚数を/数えます。/スライドしなかった/タップは/数えません。"
        figure={
          <HowToPlayFlowFigures
            figures={moveCountFigures}
            renderFrame={renderFlowFrame}
          />
        }
      />
      <HowToPlayScoreRow
        measure={`「${restart}」`}
        // 本番の session は盤面を戻しても手数を残し、score.ts は戻した回数を使わない。
        text="戻す前の/手数も/足して/数えます。/戻した回数では/点は/下がりません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * ルールの例は本番の盤面と同じくスライドし、動かないタイルは揺れ、どのタイルがスライドするか・何枚スライドするか・完成かを、本番の判定から求めて添える。
 */
export function SlidePuzzleHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: SlidePuzzleHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="タイルを/スライドさせて/左上から/番号順に/並べる/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="空白と/同じ行・列の/タイルを/タップすると/スライドします。"
            arrangement="stacked"
            examples={
              <TouchableExample
                example={lineRuleExample}
                caption="tile-verdicts"
              />
            }
          />
          <HowToPlayRule
            text="離れたタイルを/タップすると/間のタイルも/スライドします。"
            examples={carryRuleExamples.map((example) => (
              <TouchableExample
                key={example.hintTiles.join()}
                example={example}
                caption="carry"
              />
            ))}
          />
          <HowToPlayRule
            text={`左上から/番号順に/並んで/右下が/空白に/なったら/完成です。/${largerBoardNames}の/盤面も/同じです。`}
            examples={solvedRuleExamples.map((example) => (
              <TouchableExample
                key={example.board.join()}
                example={example}
                caption="solved"
              />
            ))}
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="動かし方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="スライドさせたい/タイルを/タップします。"
                arrangement="stacked"
                examples={<TouchableExample example={tapOperationExample} />}
              />
            </li>
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
