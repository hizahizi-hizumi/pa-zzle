import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { listMagicSquareSessionValueStates } from "@/games/magic-square/session/session";
import { getMagicSquareFrameUnits } from "@/games/magic-square/ui/board/board-layout";
import {
  ExampleBoard,
  MAGIC_SQUARE_EXAMPLE_CELL,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/ExampleBoard";
import { MAGIC_SQUARE_EXAMPLE_SIZE } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import {
  flowCellIndex,
  type MagicSquareHowToPlayFlowFigure,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";

type CorrectionCountExample = {
  figure: MagicSquareHowToPlayFlowFigure;
  /** 図の下に、数え方の前に添える流れ。 */
  flow: string;
  /**
   * 流れで置いた2つの数を、本番の盤面の下に並んだ数の中で囲んで添えるか。数え方が2つの数の並びの上の位置で決まる流れで添える。
   */
  showPlacedValues?: boolean;
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
 * 数を置いたマスと押した数の印。押せない図なので、本番の選んだマスの縁と通る列の帯は描かず、テーマによらない盤の色のうち、
 * そろっていない合計の字と同じ無彩に近い色の枠で囲む。枠はマスと札の角の丸みに沿わせる。
 */
const operatedFrameStyle = {
  boxShadow: `inset 0 0 0 var(--border-width-strong) ${magicSquareTone.sumInk}`,
};

function OperatedFrame() {
  return (
    <span
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={operatedFrameStyle}
    />
  );
}

function renderOperatedCellFrame(cellIndex: number) {
  return cellIndex === flowCellIndex ? <OperatedFrame /> : null;
}

function ignoreValue(): void {}

/** 流れの始まりの盤面の下に並んだ数を、押せない図で描き、流れで置いた2つの数を囲む。幅は流れの図の幅にそろえる。 */
function PlacedValues({ figure }: { figure: MagicSquareHowToPlayFlowFigure }) {
  const [start] = figure.frames;
  if (start === undefined) {
    return null;
  }
  const valueStates = listMagicSquareSessionValueStates(
    { ...start, selectedCellIndex: null },
    "value",
  );
  return (
    <div inert className="w-full">
      <MagicSquareNumberPad
        size={MAGIC_SQUARE_EXAMPLE_SIZE}
        valueStates={valueStates}
        interactionDisabled
        onEnterValue={ignoreValue}
        renderValueOverlay={(value) =>
          figure.placedValues.includes(value) ? <OperatedFrame /> : null
        }
      />
    </div>
  );
}

/**
 * 置き直しに数える直し方と数えない直し方を、置く前から直した後までの姿の流れで並べる。
 * どの姿も、数を置くマスを含む縦の列と、その下の端の合計だけを見せ、数を置くマスを無彩の枠で示す。
 * 数え方が盤面の下に並んだ数の位置で決まる流れには、その並びに置いた2つの数を同じ枠で囲んだ図を添える。
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
            selectedCellIndex={null}
            renderCellOverlay={renderOperatedCellFrame}
            width={getFrameWidth(
              getMagicSquareFrameUnits(MAGIC_SQUARE_EXAMPLE_SIZE, region)
                .columns,
              frameCount,
              stepChars,
            )}
          />
        </span>
      )}
      figures={examples.map(({ figure, flow, showPlacedValues }) => ({
        frames: figure.frames.map((session) => ({
          session,
          region: figure.region,
        })),
        steps: figure.steps,
        caption: flow,
        count: { label: "置き直し", value: `${figure.correctionCount}回` },
        ...(showPlacedValues && { detail: <PlacedValues figure={figure} /> }),
      }))}
    />
  );
}
