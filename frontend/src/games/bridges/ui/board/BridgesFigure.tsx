import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  getBridgeLineOffsets,
  getEdgeSegment,
  getIslandCenter,
  ISLAND_RADIUS,
} from "@/games/bridges/ui/board/board-geometry";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";
import { cn } from "@/lib/utils";

type BridgesFigureProps = {
  board: BridgesBoard;
  /** 辺ごとの橋の本数。 */
  bridges: readonly BridgeCount[];
  /** 島ごとの、橋の本数と数字の比べ。 */
  islandStatuses: readonly BridgesIslandStatus[];
};

/** 図の寸法はマス幅を 1 とした値。 */
const BRIDGE_LINE_WIDTH = 0.08;
/** 数字の字の大きさ。島の丸の直径の6割ほどにする。 */
const CLUE_FONT_SIZE = 0.48;

/** 盤面の絵。橋を島の下に描き、島の丸と数字を最前面に置く。 */
export function BridgesFigure({
  board,
  bridges,
  islandStatuses,
}: BridgesFigureProps) {
  const { width, height, islands } = board;
  const { edges } = getBridgesNetwork(board);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <rect
        width={width}
        height={height}
        className={bridgesToneClassNames.ground}
      />
      <g
        className={bridgesToneClassNames.bridge}
        strokeWidth={BRIDGE_LINE_WIDTH}
      >
        {edges.map(({ from, to, orientation }, edge) => {
          const { start, end } = getEdgeSegment(board, edge);
          const horizontal = orientation === "horizontal";
          return getBridgeLineOffsets(bridges[edge]!).map((offset) => (
            <line
              key={`${from}-${to}:${offset}`}
              x1={start.x + (horizontal ? 0 : offset)}
              y1={start.y + (horizontal ? offset : 0)}
              x2={end.x + (horizontal ? 0 : offset)}
              y2={end.y + (horizontal ? offset : 0)}
            />
          ));
        })}
      </g>
      {islands.map((island, index) => {
        const { x, y } = getIslandCenter(island);
        const tone = bridgesIslandTones[islandStatuses[index]!];
        return (
          <g key={`${island.row}:${island.column}`}>
            <circle
              cx={x}
              cy={y}
              r={ISLAND_RADIUS - tone.outlineWidth / 2}
              strokeWidth={tone.outlineWidth}
              className={tone.disc}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={CLUE_FONT_SIZE}
              fontWeight={700}
              className={cn("select-none", tone.clue)}
            >
              {island.clue}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
