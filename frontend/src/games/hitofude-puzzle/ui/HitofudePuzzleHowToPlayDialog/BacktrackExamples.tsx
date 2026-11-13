import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { HowToPlayFigure } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/BacktrackExamples/HowToPlayFigure";
import { playHitofudePuzzleBacktrackFlow } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/backtrack-flow";
import type {
  HitofudePuzzleHowToPlayBacktrackFlow,
  HitofudePuzzleHowToPlayFlowStep,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import { hitofudePuzzleFigureCellClassNames } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-size";
import { PLAY_OPERATION_PHRASES } from "@/games/play-vocabulary";

type BacktrackExample = {
  flow: HitofudePuzzleHowToPlayBacktrackFlow;
  /** 図の下に、数え方の前に添える流れ。 */
  caption: string;
};

type BacktrackExamplesProps = {
  examples: readonly BacktrackExample[];
};

/** 矢印に添える操作の名前。やり直しはプレイ画面と同じ名前にする。 */
function nameStep(step: HitofudePuzzleHowToPlayFlowStep): string {
  switch (step.kind) {
    case "press":
      return "押す";
    case "trace":
      return "なぞる";
    // 道のマスを押したまま、そこから別のマスへなぞる手。押した所を言葉でも言う。
    // どの矢印の列も、いちばん長い行の幅にそろうので、文節で2行に分け、盤面を小さくしない。
    case "pressAndTrace":
      return "押して/なぞる";
    case "undo":
      return PLAY_OPERATION_PHRASES.undo;
  }
}

/**
 * 矢印の言葉。操作の名前の下に、その操作で引き直しが増えたときだけ「＋1回」の行を足し、図の右の回数がどの操作で
 * 増えた分の合計かを読めるようにする。
 */
function describeStep(
  step: HitofudePuzzleHowToPlayFlowStep,
  addedBacktracks: number,
): string {
  const name = nameStep(step);
  return addedBacktracks > 0 ? `${name}/＋${addedBacktracks}回` : name;
}

/**
 * 引き直しに数える流れと数えない流れを、操作の前から後までの道を左から順に、操作の名前を添えた矢印でつないだ図で並べる。
 * コマと回数は、流れを本番の session で打って求める。押す手で進めたコマは、押したマスを無彩の枠で囲み、
 * どの流れでも「押す」の矢印の先のコマに同じ枠が出るようにして、枠が押した所だと読めるようにする。
 * 引き直しが増えた操作の矢印には、増えた回数を添える。矢印の言葉は、3文字までの行にする。
 */
export function BacktrackExamples({ examples }: BacktrackExamplesProps) {
  return (
    // 図のマスの大きさを CSS 変数で渡す。自分では箱を作らず、図の並びを変えない。
    <div className={`contents ${hitofudePuzzleFigureCellClassNames.flowFrame}`}>
      <HowToPlayFlowFigures
        renderFrame={(frame) => (
          <HowToPlayFigure
            board={frame.board}
            path={frame.path}
            pressedCell={frame.pressedCell}
          />
        )}
        figures={examples.map(({ flow, caption }) => {
          const { frames, backtrackCount } =
            playHitofudePuzzleBacktrackFlow(flow);
          return {
            frames: frames.map((frame) => ({ ...frame, board: flow.board })),
            steps: flow.steps.map((step, index) =>
              describeStep(step, frames[index + 1]?.addedBacktracks ?? 0),
            ),
            caption,
            count: { label: "引き直し", value: `${backtrackCount}回` },
          };
        })}
      />
    </div>
  );
}
