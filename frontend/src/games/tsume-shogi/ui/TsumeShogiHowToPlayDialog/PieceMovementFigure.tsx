import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 駒から見た動き。`dx` は右、`dy` は下が正。`ranging` はその向きへ何升でも進める。 */
type PieceMovement = { dx: number; dy: number; ranging: boolean };

function steps(...vectors: readonly [number, number][]): PieceMovement[] {
  return vectors.map(([dx, dy]) => ({ dx, dy, ranging: false }));
}

function ranges(...vectors: readonly [number, number][]): PieceMovement[] {
  return vectors.map(([dx, dy]) => ({ dx, dy, ranging: true }));
}

const orthogonal: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const diagonal: [number, number][] = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];
const goldSteps = steps([-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]);

/** 遊び方で動きを示す駒。成った銀・桂・香・歩は金と同じ動きなので、文で添える。 */
export const pieceMovementFigureTypes = [
  "king",
  "rook",
  "dragon",
  "bishop",
  "horse",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
] as const satisfies readonly TsumeShogiPieceType[];

const pieceMovements = {
  king: steps(...orthogonal, ...diagonal),
  rook: ranges(...orthogonal),
  dragon: [...ranges(...orthogonal), ...steps(...diagonal)],
  bishop: ranges(...diagonal),
  horse: [...ranges(...diagonal), ...steps(...orthogonal)],
  gold: goldSteps,
  silver: steps([-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]),
  knight: steps([-1, -2], [1, -2]),
  lance: ranges([0, -1]),
  pawn: steps([0, -1]),
} as const satisfies Record<
  (typeof pieceMovementFigureTypes)[number],
  readonly PieceMovement[]
>;

const gridSize = 5;
const cellSize = 10;
const center = (gridSize * cellSize) / 2;
/** 駒の字形（駒の `viewBox` で高さ 78）を、升の中で字の高さが升の約9割になる大きさへ縮める。 */
const glyphScale = 0.115;

function toPoint(dx: number, dy: number) {
  return { x: center + dx * cellSize, y: center + dy * cellSize };
}

type PieceMovementFigureProps = {
  type: (typeof pieceMovementFigureTypes)[number];
};

/** 5×5 の升の中央に駒を置き、1升だけ動ける先に点、何升でも進める向きに矢印を描く。 */
export function PieceMovementFigure({ type }: PieceMovementFigureProps) {
  const extent = gridSize * cellSize;
  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      aria-hidden="true"
      className={cn(
        "size-12 rounded-sm",
        tsumeShogiToneClassNames.boardSurface,
      )}
    >
      {Array.from({ length: gridSize - 1 }, (_, index) => {
        const offset = (index + 1) * cellSize;
        return (
          <g key={offset} className="stroke-amber-900/20 dark:stroke-stone-600">
            <line
              x1={offset}
              y1={0}
              x2={offset}
              y2={extent}
              strokeWidth={0.5}
            />
            <line
              x1={0}
              y1={offset}
              x2={extent}
              y2={offset}
              strokeWidth={0.5}
            />
          </g>
        );
      })}
      {pieceMovements[type].map(({ dx, dy, ranging }) => {
        if (!ranging) {
          const { x, y } = toPoint(dx, dy);
          return (
            <circle
              key={`${dx},${dy}`}
              cx={x}
              cy={y}
              r={2.4}
              className="fill-foreground"
            />
          );
        }
        const start = toPoint(dx * 0.6, dy * 0.6);
        const arrow = toPoint(dx * 1.85, dy * 1.85);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <g key={`${dx},${dy}`} className="fill-foreground stroke-foreground">
            <line
              x1={start.x}
              y1={start.y}
              x2={arrow.x}
              y2={arrow.y}
              strokeWidth={1.6}
            />
            <polygon
              points="0,-2.6 4,0 0,2.6"
              transform={`translate(${arrow.x} ${arrow.y}) rotate(${angle})`}
              stroke="none"
            />
          </g>
        );
      })}
      <path
        d={tsumeShogiPieceGlyphPaths[type]}
        transform={`translate(${center} ${center}) scale(${glyphScale}) translate(-50 -70)`}
        strokeWidth={1.6}
        strokeLinejoin="round"
        className={
          type === "dragon" || type === "horse"
            ? tsumeShogiToneClassNames.promotedText
            : "fill-foreground stroke-foreground"
        }
      />
    </svg>
  );
}
