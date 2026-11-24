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
 * 図のマスの大きさ。ルールの例と同じ大きさを上限にし、3つの姿と2つの矢印が1行に収まらない幅でだけ、収まる大きさまで小さくする。
 * 1行の幅は、3つの姿（マスと行の合計の帯）と、矢印のまとまり（2 × 3文字ほど）と、その間（4 × 8px）。
 */
function getFrameWidth(columns: number): string {
  return `min(${MAGIC_SQUARE_EXAMPLE_CELL_MAX_PX * columns}px, (100cqw - 7em - 32px) / 3)`;
}

/**
 * 置き直しに数える直し方と数えない直し方を、ルールの例と同じ面に、置く前から直した後までの姿の流れで並べる。
 * どの姿も、1行目の右端のマスとその行の合計だけを見せ、操作したマスは本番の選んだマスと同じ縁で示す。
 * 図の下に、流れと、本番の数え方で数えた置き直しの回数を「→ 置き直し 1回」の形で添える。
 */
export function CorrectionCountExamples({
  examples,
}: CorrectionCountExamplesProps) {
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
