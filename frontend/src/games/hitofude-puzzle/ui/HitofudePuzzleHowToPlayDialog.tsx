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
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/hitofude-puzzle/assets/pictogram.svg?raw";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type { HitofudePuzzleExtensionRejection } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
  HITOFUDE_PUZZLE_SCORE_MAXIMUMS,
  HITOFUDE_PUZZLE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/hitofude-puzzle/score";
import { BacktrackExamples } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/BacktrackExamples";
import {
  allCellsRuleExamples,
  backtrackFlows,
  extendOperationExample,
  type HitofudePuzzleHowToPlayExample,
  type HitofudePuzzleHowToPlayExamplePair,
  holeRuleExample,
  onceRuleExample,
  rewindOperationExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/GoalPlayback";
import { TouchableExample } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type HitofudePuzzleHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: HITOFUDE_PUZZLE_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 延ばせない手のルールで、例が教える理由。 */
type MoveRule = Extract<HitofudePuzzleExtensionRejection, "visited" | "hole">;

/**
 * すべてのマスのルール。完成した姿と、マスを残して行き止まりになった姿を見比べる対にする。
 * 判定の言葉は、できる・できないの代わりに、完成と、行き止まりと残ったマスの数で言う。
 */
function renderShapeRule(
  text: string,
  examples: HitofudePuzzleHowToPlayExamplePair,
) {
  return (
    <HowToPlayRule
      text={text}
      examples={examples.map((example) => (
        <TouchableExample
          key={example.path.join(",")}
          example={example}
          caption={{ kind: "shape" }}
        />
      ))}
    />
  );
}

/**
 * 通れないマスのルール。1つの盤面で、先端の隣の通れるマスと通れないマスに手ごとの印を付ける。
 * 例は本番の指の操作と同じに動き、通れるマスを押すと延び、穴を押すと×で弾かれ、通ったマスを押すとそこまで戻る（道が戻ったと言う）。
 */
function renderMoveRule(
  text: string,
  example: HitofudePuzzleHowToPlayExample,
  rule: MoveRule,
) {
  return (
    <HowToPlayRule
      text={text}
      arrangement="stacked"
      examples={
        <TouchableExample example={example} caption={{ kind: "move", rule }} />
      }
    />
  );
}

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、
// リセットと別の問題は新しいプレイを始める。数えるものは、プレイ画面の上部と同じ呼び名で言う。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間・引き直し・/「${undo}」の回数は/そのままで/最初の盤面に/戻します。`,
  },
  {
    item: playMenuOperationItems.replay,
    text: `時間・引き直し・/「${undo}」の回数も/0に戻して/同じ問題を/最初からやり直します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

/**
 * キーボードの表。矢印キーはプレイ画面がどこにフォーカスがあっても受け、先端を動かす。
 * Tab の止まり先は盤面の先端のマス1つで、マスの間は Shift と矢印キーで移り、Enter・Space はマスのボタンを押す。
 */
const keyboardKeys: readonly HowToPlayKey[] = [
  {
    keys: ["↑", "↓", "←", "→"],
    description: "道をその向きへ1マス延ばします。来た向きなら縮めます。",
  },
  { keys: ["Tab"], description: "輪の付いたマスを選びます。" },
  {
    keys: ["Shift", "↑", "↓", "←", "→"],
    description: "ほかのマスを選びます。",
  },
  { keys: ["Enter", "Space"], description: "選んだマスを押します。" },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(HITOFUDE_PUZZLE_SCORE_MAXIMUMS) as [
  keyof typeof HITOFUDE_PUZZLE_SCORE_MAXIMUMS,
  number,
][];

/** 正確さが0点になる引き直しの回数。score.ts は満点から1回ごとの減点を引き、0点より下げない。 */
const accuracyZeroBacktracks = Math.ceil(
  HITOFUDE_PUZZLE_SCORE_MAXIMUMS.accuracy / HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
);

// 一文は、すぐ下の数えるものの行（1回ごとの減点）と同じことを言わず、どこで0点になるかを言う。
const scoreLeads = {
  // 結果画面の採点基準と同じく、問題ごとの基準時間との差で決まり、どこまで下がるかを言う。
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${HITOFUDE_PUZZLE_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
  accuracy: `引き直し/${accuracyZeroBacktracks}回で/0点です。`,
} as const satisfies Record<
  keyof typeof HITOFUDE_PUZZLE_SCORE_MAXIMUMS,
  string
>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ呼び名で並べる。速さには基準時間の決まり方を置く。 */
function renderScoreRows(item: keyof typeof HITOFUDE_PUZZLE_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、盤面把握に、通るマス・分かれ道・先読み・先読みで追う手の数に応じた時間を足す。
    // 先読みは、結果画面の注記と同じく、試しに数手先までたどって向きを決める所として言う。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text="通るマス・/分かれ道・/試しに/先まで/たどって/向きを決める所が/多い問題ほど/長くなります。"
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="引き直し"
        deduction={`1回 −${HITOFUDE_PUZZLE_BACKTRACK_PENALTY}点`}
        // 本番の session は、押す前と離した後の道だけを比べ、延びなかった手では道を変えない。
        text="道を戻して/前と違うマスへ/引くと/1回です。/離さずに/行ったり来たりした分と/通れずに止まった分は/数えません。"
        figure={
          <BacktrackExamples
            examples={[
              { flow: backtrackFlows.same, caption: "戻して同じマスへ引く" },
              {
                flow: backtrackFlows.different,
                caption: "戻して違うマスへ引く",
              },
              {
                flow: backtrackFlows.undo,
                caption: `違う道へ/引いてから/「${undo}」で戻す`,
              },
            ]}
          />
        }
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・/「${restart}」`}
        // 正確さは引き直しの回数だけで決まり、待った・盤面を戻すを使った回数では点を引かない（score.ts）。
        // 違う道へ引いてから待ったで戻すと引き直しに数えることは、すぐ上の流れの図だけで見せ、ここでは繰り返さない。
        text="使った回数では/点は下がりません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面の触れる例と話し言葉の一文を並べる。
 * 例は本番の盤面部品と遷移で動き、なぞると道が延び、延ばせないマスでは×と先端の揺れを、行き止まりと完成も本番と同じに返す。
 */
export function HitofudePuzzleHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: HitofudePuzzleHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="穴をよけて/すべてのマスを/1回ずつ/通る道を/1本引く/パズルです。"
      goal={<GoalPlayback />}
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          {renderMoveRule(
            "同じマスは/2回通れません。",
            onceRuleExample,
            "visited",
          )}
          {renderShapeRule(
            "すべてのマスを/通れば/完成です。",
            allCellsRuleExamples,
          )}
          {renderMoveRule("穴は/通れません。", holeRuleExample, "hole")}
        </>
      }
      operations={
        <>
          <HowToPlaySection title="引き方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="輪の付いたマスから/隣のマスへ/なぞって/道を延ばします。/来た道を/なぞって戻ると/道が縮みます。"
                arrangement="stacked"
                examples={<TouchableExample example={extendOperationExample} />}
              />
            </li>
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="道の途中の/マスを押すと/道が/そこまで/縮みます。/離さずに/なぞれば/そこから/引き直せます。"
                arrangement="stacked"
                examples={<TouchableExample example={rewindOperationExample} />}
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
              text={`「${undo}」で/最後に/動かした道を/元に戻します。`}
              // 待ったで戻した道を引き直しに数えることは点に関わるので、採点のタブの流れの図だけで見せる。
              note={`時間は/そのままで/「${undo}」の回数が/増えます。`}
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
