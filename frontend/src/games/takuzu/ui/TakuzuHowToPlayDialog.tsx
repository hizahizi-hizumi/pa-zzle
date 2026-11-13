import type { HowToPlayExampleArrangement } from "@/components/HowToPlayExamplePanel";
import {
  type HowToPlayKey,
  HowToPlayKeyTable,
} from "@/components/HowToPlayKeyTable";
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
import { UndoButton } from "@/components/UndoButton";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import { TAKUZU_BOARD_SIZE } from "@/games/takuzu/problem/problem";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import {
  TAKUZU_CORRECTION_PENALTY,
  TAKUZU_RESTART_PENALTY,
  TAKUZU_SCORE_MAXIMUMS,
  TAKUZU_SPEED_ZERO_SCORE_RATIO,
  TAKUZU_UNDO_PENALTY,
} from "@/games/takuzu/score";
import {
  type TakuzuArrowKeyMove,
  takuzuArrowKeys,
  takuzuPlacementKeys,
} from "@/games/takuzu/ui/board/keyboard-input";
import {
  backwardCycleFigures,
  backwardCycleTouchBoard,
  countRuleExamples,
  cycleFigures,
  cycleTouchBoard,
  duplicateRuleExamples,
  givenTileStrip,
  goalFigure,
  replacementCountFigures,
  runRuleExamples,
  type TakuzuHowToPlayRuleExample,
  type TakuzuHowToPlayViolation,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/GoalPlayback";
import { ReplacementCountExamples } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/ReplacementCountExamples";
import { TouchableCycleExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableCycleExample";
import { TouchableGivenTileExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableGivenTileExample";
import { TouchableRuleExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableRuleExample";

type TakuzuHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: TAKUZU_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 1本の行を丸ごと見せる例は横に長いので、2列に並べず縦2段にする。 */
function getArrangement(
  examples: readonly TakuzuHowToPlayRuleExample[],
): HowToPlayExampleArrangement {
  return examples.some(
    ({ board }) => (board.rows[0]?.length ?? 0) >= TAKUZU_BOARD_SIZE,
  )
    ? "stacked"
    : "side-by-side";
}

type RuleExampleOptions = {
  showsTileCounts?: boolean;
  marksRowDifferences?: boolean;
};

function renderRule(
  text: string,
  rule: TakuzuHowToPlayViolation,
  examples: readonly TakuzuHowToPlayRuleExample[],
  {
    showsTileCounts = false,
    marksRowDifferences = false,
  }: RuleExampleOptions = {},
) {
  const arrangement = getArrangement(examples);
  // 横に並べた例は、盤面の縦の中央を、いちばん行の多い例の盤面の縦の中央にそろえる。判定の言葉は面が下でそろえる。
  const centeredInRowCount =
    arrangement === "side-by-side"
      ? Math.max(...examples.map(({ board }) => board.rows.length))
      : undefined;
  return (
    <HowToPlayRule
      text={text}
      arrangement={arrangement}
      examples={examples.map((ruleExample) => (
        <TouchableRuleExample
          key={ruleExample.board.rows.join("/")}
          board={ruleExample.board}
          rule={rule}
          showsTileCounts={showsTileCounts}
          marksRowDifferences={marksRowDifferences}
          centeredInRowCount={centeredInRowCount}
        />
      ))}
    />
  );
}

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間・置き直し・/「${undo}」の回数は/そのままで/最初の盤面に/戻します。`,
  },
  {
    item: playMenuOperationItems.replay,
    text: `時間・置き直し・/「${undo}」の回数も/0に戻して/同じ問題を/最初から/やり直します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

const arrowKeyLabels = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
} as const satisfies Record<TakuzuArrowKeyMove["key"], string>;

const placementDescriptions = [
  { cell: "a", description: "四角を置きます。" },
  { cell: "b", description: "丸を置きます。" },
  { cell: null, description: "空きにします。" },
] as const satisfies readonly { cell: TakuzuCell; description: string }[];

/**
 * キーボードの表。盤面のキーは本番の盤面の入力と同じ定義から組む。
 * Tab と Enter・Space は、盤面のマスがボタンなので、ブラウザのボタンの操作そのもの。
 */
const keyboardKeys: readonly HowToPlayKey[] = [
  { keys: ["Tab"], description: "盤面まで進みます。" },
  {
    keys: takuzuArrowKeys.map(({ key }) => arrowKeyLabels[key]),
    description: "マスを選びます。",
  },
  {
    keys: ["Enter", "Space"],
    description: "選んだマスを空き・四角・丸の順に変えます。",
  },
  ...placementDescriptions.map(({ cell, description }) => ({
    keys: takuzuPlacementKeys
      .filter((placement) => placement.cell === cell)
      .map(({ key }) => key),
    description,
  })),
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(TAKUZU_SCORE_MAXIMUMS) as [
  keyof typeof TAKUZU_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  // 何を数えて何点引くかは直後の行が言うので、引いていく元と下限だけを言う。
  accuracy: `${TAKUZU_SCORE_MAXIMUMS.accuracy}点から/引いていきます。/0点より/下には/なりません。`,
  // 結果画面の採点基準と同じく、問題ごとの基準時間との差で決まり、どこまで下がるかを言う。
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${TAKUZU_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof TAKUZU_SCORE_MAXIMUMS, string>;

/** 1回ごとに引く点。score.ts の減点と同じ値から出す。 */
function formatDeduction(penalty: number): string {
  return `1回 −${penalty}点`;
}

/** 点ごとに、数えるものを結果画面の採点基準と同じ順に並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof TAKUZU_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、空きのマスの数と、次の一手を探し直す局面と、行・列を丸ごと読む局面の数で長くなる。
    // 行・列を丸ごと読む局面は、残りの空きに入る並べ方を比べて決める局面なので、遊ぶ人が盤面でする考え方で言う。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text="空きのマスが/多い問題ほど/長くなります。/行や列の/並べ方を/考えて/決める所が/多い問題も/長くなります。"
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="置き直し"
        deduction={formatDeduction(TAKUZU_CORRECTION_PENALTY)}
        text="ほかのマスを押してから/戻って変えると/1回と数えます。"
        figure={
          <ReplacementCountExamples
            examples={[
              {
                figure: replacementCountFigures.uncounted,
                howToPress: "同じマスを/続けて押す",
              },
              {
                figure: replacementCountFigures.counted,
                howToPress: "ほかのマスから/戻って変える",
              },
            ]}
          />
        }
      />
      <HowToPlayScoreRow
        measure={restart}
        deduction={formatDeduction(TAKUZU_RESTART_PENALTY)}
        text="戻して消えたタイルは/置き直しに/数えません。"
      />
      <HowToPlayScoreRow
        measure={undo}
        deduction={formatDeduction(TAKUZU_UNDO_PENALTY)}
        text="取り消した操作は/置き直しに/数えません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * ルールの例は、本番の判定と遷移で動き、ルールに反すると本番と同じ印と ✕ がその場で付く。
 */
export function TakuzuHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: TakuzuHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="四角と丸の/タイルで/盤面を/埋める/パズルです。"
      goal={<GoalPlayback goal={goalFigure} />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderRule(
            "同じタイルが続くのは/縦も横も/2つまでです。",
            "run",
            runRuleExamples,
          )}
          {renderRule(
            `どの行にも/列にも/四角と丸を/${TAKUZU_BOARD_SIZE / 2}つずつ置きます。`,
            "overfilled",
            countRuleExamples,
            { showsTileCounts: true },
          )}
          {renderRule(
            "行どうし・列どうしは/どれも/違う並びにします。",
            "duplicate",
            duplicateRuleExamples,
            { marksRowDifferences: true },
          )}
          <HowToPlayRule
            text="最初からあるタイルは/変えられません。"
            arrangement="stacked"
            examples={<TouchableGivenTileExample board={givenTileStrip} />}
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="置き方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="マスを押すたびに/空き・四角・丸の順に/変わります。"
                arrangement="stacked"
                examples={
                  <TouchableCycleExample
                    cycle={cycleFigures}
                    board={cycleTouchBoard}
                  />
                }
              />
            </li>
            <li className={howToPlayAvailabilityClassNames["fine-pointer"]}>
              <HowToPlayRule
                headingLevel={4}
                text="右クリックでは/逆の順に/変わります。"
                arrangement="stacked"
                examples={
                  <TouchableCycleExample
                    cycle={backwardCycleFigures}
                    board={backwardCycleTouchBoard}
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
              text={`「${undo}」で/1つ前の盤面に/戻します。`}
              // 本番の session では、待ったは経過時間を変えず、置き直しの記録も操作の前に戻すので、取り消した置き直しは数えない。
              note={`時間は/そのままです。/取り消した置き直しは/数えず/「${undo}」の回数が/増えます。`}
            />
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
