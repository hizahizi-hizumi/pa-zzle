import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { iceFloorMazeFigureCellClassNames } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-size";
import { HowToPlayFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/HowToPlayFigure";
import {
  type IceFloorMazeMoveCountFlow,
  type IceFloorMazeMoveCountStep,
  moveCountFlowBoard,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/move-count-flow";
import { PLAY_OPERATION_PHRASES } from "@/games/play-vocabulary";

type MoveCountExample = {
  flow: IceFloorMazeMoveCountFlow;
  /** 図の下に、数え方の前に添える流れ。 */
  caption: string;
};

type MoveCountExamplesProps = {
  examples: readonly MoveCountExample[];
};

const directionNames = {
  up: "上へ",
  right: "右へ",
  down: "下へ",
  left: "左へ",
} as const satisfies Record<IceFloorMazeDirection, string>;

/**
 * 矢印に添える操作の名前。滑らせた手と動けなかった手は向きを添えて「左へ/滑る」「右へは/動けず」と言い、
 * 待ったはプレイ画面と同じ名前にする。どの行も3文字ほどにし、狭い画面でもコマを小さくしすぎない（矢印の列はいちばん長い行の幅を取る）。
 * 待ったは、図の下の流れの言葉で「待った」と括弧付きで言う。
 */
function describeStep(step: IceFloorMazeMoveCountStep, moved: boolean): string {
  if (step.kind === "undo") {
    return PLAY_OPERATION_PHRASES.undo;
  }
  const direction = directionNames[step.direction];
  return moved ? `${direction}/滑る` : `${direction}は/動けず`;
}

/**
 * 手数の数え方を、操作の前から後までの姿を左から順に、操作の名前を添えた矢印でつないだ押せない図で並べる。
 * 滑らせたコマには本番と同じ滑りの跡を描き、図の下には流れと、その右に本番と同じ数え方の手数を添える。
 */
export function MoveCountExamples({ examples }: MoveCountExamplesProps) {
  return (
    <div className={iceFloorMazeFigureCellClassNames.flowFrame}>
      <HowToPlayFlowFigures
        renderFrame={(frame) => (
          <HowToPlayFigure
            board={moveCountFlowBoard}
            state={frame.state}
            goal={null}
            trail={frame.trail}
          />
        )}
        figures={examples.map(({ flow, caption }) => ({
          frames: flow.frames,
          steps: flow.steps.map((step, index) =>
            describeStep(
              step,
              (flow.frames[index + 1]?.trail ?? null) !== null,
            ),
          ),
          caption,
          count: { label: "手数", value: `${flow.moveCount}手` },
        }))}
      />
    </div>
  );
}
