import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { createTakuzuExampleBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type { TakuzuHowToPlayReplacementCountFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";

type ReplacementCountExample = {
  figure: TakuzuHowToPlayReplacementCountFigure;
  /** 図の下に、数え方の前に添える押し方。 */
  howToPress: string;
};

type ReplacementCountExamplesProps = {
  examples: readonly ReplacementCountExample[];
};

/**
 * 図のマスの大きさ。広い画面ではルールの例と同じ 56px にする。
 * 狭い画面でも、ルールの例と同じ大きさ（40px）を上限にし、3つの姿と2つの矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、6マスと、姿の格子の線と外枠（3 × 5px）、矢印のまとまり（2 × 28px）、その間（4 × 8px）。
 */
const figureCellSizeClassName =
  "[--takuzu-figure-cell:min(39px,calc((100cqw-106px)/6))] lg:[--takuzu-figure-cell:55px]";

/** 矢印に添える、姿を進める操作。 */
const pressWord = "押す";

/**
 * 置き直しに数える押し方と数えない押し方を、ルールの例と同じ面に、押す前から押した後までの姿の流れで並べる。
 * 2つ目からの姿では、その前に押したマスを、本番のキーボードで選んだマスと同じ地と輪郭で示す。
 * 図の下に、押し方と、本番の数え方で数える置き直しの回数を「→ 置き直し 1回」の形で添える。
 */
export function ReplacementCountExamples({
  examples,
}: ReplacementCountExamplesProps) {
  return (
    // 図のマスの大きさを CSS 変数で渡す。自分では箱を作らず、図の並びを変えない。
    <div className={`contents ${figureCellSizeClassName}`}>
      <HowToPlayFlowFigures
        renderFrame={(board, previous) => (
          <HowToPlayFigure
            example={createTakuzuExampleBoard(board)}
            size="inherited"
            currentCells={previous?.pressedCells}
          />
        )}
        figures={examples.map(({ figure, howToPress }) => ({
          frames: figure.frames,
          steps: figure.frames.slice(1).map(() => pressWord),
          caption: howToPress,
          count: { label: "置き直し", value: `${figure.correctionCount}回` },
        }))}
      />
    </div>
  );
}
