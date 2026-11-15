import { FIGURE_WAVE_UNIT } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type { BoardView } from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";

type FigureSeaProps = { view: BoardView };

export function FigureSea({ view }: FigureSeaProps) {
  return (
    <>
      <rect
        width={view.width}
        height={view.height}
        className={bridgesToneClassNames.seaFill}
      />
      <svg width={view.width} height={view.height} overflow="hidden">
        <SeaWaves unit={FIGURE_WAVE_UNIT} />
      </svg>
    </>
  );
}
