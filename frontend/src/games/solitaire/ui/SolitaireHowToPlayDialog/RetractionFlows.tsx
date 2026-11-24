import { HowToPlayFlowFigures } from "@/components/HowToPlayFlowFigures";
import { PLAY_OPERATION_PHRASES } from "@/games/play-vocabulary";
import {
  FigureCardSizeScope,
  FigureCardWidth,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureCardWidth";
import {
  retractionFlowLayout,
  retractionFlows,
  type SolitaireRetractionFlow,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/HowToPlayBoard";
import { SOLITAIRE_RETRACTED_MOVE_LABEL } from "@/games/solitaire/ui/score-vocabulary";

/** 矢印に添える操作の名前。待ったはプレイ画面と同じ名前にする。 */
const stepNames = {
  move: "動かす",
  draw: "めくる",
  undo: PLAY_OPERATION_PHRASES.undo,
} as const satisfies Record<SolitaireRetractionFlow["steps"][number], string>;

/** 図の下に添える流れ。流れごとに違う言葉にする。 */
const flowCaptions = ["動かして/取り消す", "めくって/取り消す"] as const;

/**
 * 取り消した手に数える流れを、操作の前から後までの姿を左から順に、操作の名前を添えた矢印でつないだ押せない図で並べる。
 * 動かす前のコマは、置き元を本番の選んだ姿で示す。図の下には流れと、その右に本番の数え方で数えた取り消した手を添える。
 */
export function RetractionFlows() {
  return (
    <FigureCardSizeScope size="flowFrame">
      <HowToPlayFlowFigures
        renderFrame={(frame) => (
          // 本番の盤面部品で描くので、押せない図として押しもカーソルも受けない。
          <div inert aria-hidden="true">
            <FigureCardWidth>
              {(cardWidth) => (
                <HowToPlayBoard
                  state={frame.state}
                  layout={retractionFlowLayout}
                  cardWidth={cardWidth}
                  columnCardCapacity={2}
                  selectedSource={frame.selectedSource ?? null}
                  operation={null}
                  groundPadding="compact"
                />
              )}
            </FigureCardWidth>
          </div>
        )}
        figures={retractionFlows.map(
          ({ frames, steps, retractedMoveCount }, index) => ({
            frames,
            steps: steps.map((step) => stepNames[step]),
            caption: flowCaptions[index] ?? "",
            count: {
              label: SOLITAIRE_RETRACTED_MOVE_LABEL,
              value: `${retractedMoveCount}手`,
            },
          }),
        )}
      />
    </FigureCardSizeScope>
  );
}
