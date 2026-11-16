import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { isSlidePuzzleSolved } from "@/games/slide-puzzle/puzzle/state";
import {
  findSlidePuzzleExampleHintTile,
  judgeSlidePuzzleExampleTiles,
  type SlidePuzzleHintedExample,
  type SlidePuzzleHowToPlayExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/example-board";
import { HowToPlayBoard } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/HowToPlayBoard";
import {
  CarryCaption,
  slideRejectionReason,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/TouchableExample/CarryCaption";
import { useTouchableExample } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/TouchableExample/use-touchable-example";

/**
 * 図の下に添える言葉（`caption`）。渡さない例（操作の例）は、言葉を添えない。
 * - `tile-verdicts`: どのタイルが今押すとスライドするかを、タイルの右上の札（✓ / ✕）で今の盤面から示し、札の凡例を添える。
 * - `carry`: 押すと何枚スライドするか、押した後は何枚スライドしたか。押す前に言う枚数のため、手がかりを持つ例で使う。
 * - `solved`: 今の盤面が完成か（✓ 完成 / ✕ 未完成）。動かないタイルを押したときは、判定の下に破ったルールを添える。
 */
type TouchableExampleProps =
  | {
      example: SlidePuzzleHowToPlayExample;
      caption?: "tile-verdicts" | "solved";
    }
  | { example: SlidePuzzleHintedExample; caption: "carry" };

const solvedLabels = { allowed: "完成", disallowed: "未完成" };

const tileVerdictLabels = {
  allowed: "スライドする",
  disallowed: "スライドしない",
};

/**
 * 触れる例。押すと本番と同じにスライドし、動かないタイルは揺れ、完成させるとクリアの波を返す。
 * 図の下の言葉と札は、本番の判定で今の盤面から求め直す。
 * 押す所の手がかりは、例が見せる手を順に押していく途中の盤面でだけ付け、弾かれたら盤面が変わるまで消す。
 */
export function TouchableExample(props: TouchableExampleProps) {
  const { example, caption } = props;
  const { state, operation, clearing, tap, finishClearing } =
    useTouchableExample(example);
  const tileVerdicts = judgeSlidePuzzleExampleTiles(state.board);

  function renderCaption() {
    switch (props.caption) {
      case undefined:
        return undefined;
      case "tile-verdicts":
        return (
          <HowToPlayMarkLegend
            labels={tileVerdictLabels}
            shownMarks={{
              allowed: [...tileVerdicts.values()].includes(true),
              disallowed: [...tileVerdicts.values()].includes(false),
            }}
          />
        );
      case "carry":
        return <CarryCaption example={props.example} state={state} />;
      case "solved":
        return (
          <HowToPlayVerdict
            verdict={
              isSlidePuzzleSolved(state.board) ? "allowed" : "disallowed"
            }
            labels={solvedLabels}
            reason={
              state.lastMove?.type === "rejected"
                ? slideRejectionReason
                : undefined
            }
          />
        );
    }
  }

  return (
    <HowToPlayExample
      figure={
        <HowToPlayBoard
          board={state.board}
          size="example"
          operation={operation}
          clearing={clearing}
          hintTile={
            clearing ? null : findSlidePuzzleExampleHintTile(example, state)
          }
          tileVerdicts={caption === "tile-verdicts" ? tileVerdicts : undefined}
          onSlideTile={tap}
          onClearAnimationComplete={finishClearing}
        />
      }
      caption={renderCaption()}
    />
  );
}
