import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import {
  getMagicSquareFrameUnits,
  MAGIC_SQUARE_SUM_BAND_RATIO,
} from "@/games/magic-square/ui/board/board-layout";
import {
  ExampleBoard,
  MAGIC_SQUARE_EXAMPLE_CELL,
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
  return `min(${columns} * ${MAGIC_SQUARE_EXAMPLE_CELL}, (100cqw - ${arrowCount} * ${arrowWidth} - ${gaps}) / ${frameCount})`;
}

/**
 * 置き直しに数える直し方と数えない直し方を、置く前から直した後までの姿の流れで並べる。
 * どの姿も、数を置くマスを含む縦の列と、その下の端の合計だけを見せる。数を置くマスは、本番と同じく選んだマスの縁と、
 * 通る列の帯で示す。矢印は、数を置く下の端のマスの高さにそろえる。
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
  const [first] = examples;
  const columns =
    first === undefined
      ? 1
      : getMagicSquareFrameUnits(MAGIC_SQUARE_EXAMPLE_SIZE, first.figure.region)
          .columns;
  const frameWidth = getFrameWidth(columns, frameCount, stepChars);
  // 姿の幅は列の数だけのマスの幅なので、マス1つの大きさは姿の幅を列の数で割った長さ。数を置くマスは範囲の下の端で、その下に合計の帯がある。
  const cell = `(${frameWidth}) / ${columns}`;
  return (
    <HowToPlayFlowFigures
      renderFrame={({ session, region }) => (
        <span inert className="flex">
          <ExampleBoard
            session={session}
            region={region}
            selectedCellIndex={session.selectedCellIndex}
            width={frameWidth}
          />
        </span>
      )}
      arrowCenterFromFrameBottom={`calc(${cell} * ${MAGIC_SQUARE_SUM_BAND_RATIO + 0.5})`}
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
