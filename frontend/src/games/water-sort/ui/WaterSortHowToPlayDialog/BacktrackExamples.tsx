import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { PLAY_OPERATION_PHRASES } from "@/games/play-vocabulary";
import { BottleSizeScope } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/BottleSizeScope";
import type {
  WaterSortHowToPlayBacktrackFigure,
  WaterSortHowToPlayFlowStep,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/HowToPlayFigure";

type BacktrackExample = {
  figure: WaterSortHowToPlayBacktrackFigure;
  /** 図の下に、数え方の前に添える流れ。 */
  flow: string;
};

type BacktrackExamplesProps = {
  examples: readonly BacktrackExample[];
};

/**
 * 矢印に添える操作の名前。1手を注ぐときは「注ぐ」、まとめて注ぐときは手数を添え、やり直しはプレイ画面と同じ名前にする。
 * どの矢印の列も、いちばん長い行の幅にそろうので、やり直しの名前は文節で行を分けた呼び名を使い、ボトルを小さくしない。
 */
function describeBacktrackStep(step: WaterSortHowToPlayFlowStep): string {
  if (step.kind !== "pour") {
    return PLAY_OPERATION_PHRASES[step.kind];
  }
  return step.moves.length === 1 ? "注ぐ" : `${step.moves.length}手/注ぐ`;
}

/**
 * 手戻りに数える流れを、操作の前から後までの姿を左から順に、操作の名前を添えた矢印でつないだ図で並べる。
 * 注ぐときは、前のコマで注ぐ元を本番の選んだ姿（持ち上げ）で示す。図の下には流れと、その右に手戻りの手数を添える。
 */
export function BacktrackExamples({ examples }: BacktrackExamplesProps) {
  return (
    <BottleSizeScope size="flowFrame">
      <HowToPlayFlowFigures
        renderFrame={(frame) => <HowToPlayFigure frame={frame} />}
        figures={examples.map(({ figure, flow }) => ({
          frames: figure.frames,
          steps: figure.steps.map(describeBacktrackStep),
          caption: flow,
          count: { label: "手戻り", value: `${figure.backtrackMoveCount}手` },
        }))}
      />
    </BottleSizeScope>
  );
}
