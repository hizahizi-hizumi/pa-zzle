import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { getMagicSquareFrameUnits } from "@/games/magic-square/ui/board/board-layout";
import {
  ExampleBoard,
  MAGIC_SQUARE_EXAMPLE_CELL_MAX_PX,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/ExampleBoard";
import { MAGIC_SQUARE_EXAMPLE_SIZE } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import type { MagicSquareHowToPlayFlowFigure } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

type CorrectionCountExample = {
  figure: MagicSquareHowToPlayFlowFigure;
  /** 図の下に、数え方の前に添える流れ。 */
  flow: string;
};

type CorrectionCountExamplesProps = {
  examples: readonly CorrectionCountExample[];
};

/**
 * 姿1つの幅。ルールの例と同じマスの大きさを上限にし、姿と矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、姿と、姿の間の矢印（`HowToPlayFlowFigures` は、矢印の名前のいちばん長い行の字数を、補いの文字の大きさで取り、
 * 1.75rem を下回らない）と、姿と矢印の間（0.5rem）。
 */
function getFrameWidth(
  columns: number,
  frameCount: number,
  stepChars: number,
): string {
  const arrowCount = frameCount - 1;
  const arrowWidth = `max(${stepChars} * var(--text-supporting), 1.75rem)`;
  const gaps = `${frameCount + arrowCount - 1} * 0.5rem`;
  return `min(${MAGIC_SQUARE_EXAMPLE_CELL_MAX_PX * columns}px, (100cqw - ${arrowCount} * ${arrowWidth} - ${gaps}) / ${frameCount})`;
}

/**
 * 置き直しに数える直し方と数えない直し方を、ルールの例と同じ面に、置く前から直した後までの姿の流れで並べる。
 * どの姿も、操作するマス1つとその縦の列の合計だけを見せ、操作したマスは本番の選んだマスと同じ縁で示す。
 * 図の下に、流れと、本番の数え方で数えた置き直しの回数を「→ 置き直し 1回」の形で添える。
 */
export function CorrectionCountExamples({
  examples,
}: CorrectionCountExamplesProps) {
  const frameCount = Math.max(
    ...examples.map(({ figure }) => figure.frames.length),
  );
  const stepChars = Math.max(
    ...examples.flatMap(({ figure }) =>
      figure.steps.flatMap((step) =>
        step.split("/").map((line) => [...line].length),
      ),
    ),
  );
  return (
    <HowToPlayFlowFigures
      renderFrame={({ session, region }) => (
        <span inert className="flex">
          <ExampleBoard
            session={session}
            region={region}
            selectedCellIndex={session.selectedCellIndex}
            width={getFrameWidth(
              getMagicSquareFrameUnits(MAGIC_SQUARE_EXAMPLE_SIZE, region)
                .columns,
              frameCount,
              stepChars,
            )}
          />
        </span>
      )}
      figures={examples.map(({ figure, flow }) => ({
        frames: figure.frames.map((session) => ({
          session,
          region: figure.region,
        })),
        steps: figure.steps,
        caption: flow,
        count: { label: "置き直し", value: `${figure.correctionCount}回` },
      }))}
    />
  );
}
