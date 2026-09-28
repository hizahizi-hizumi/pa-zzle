import { getReflectionBoardOrigin } from "@/games/reflection/ui/board/board-geometry";

type ReflectionFigureGridProps = {
  size: number;
  /** 描く行の範囲。省略すると盤面全体を描く。 */
  rows?: { first: number; count: number };
};

const GRID_LINE_WIDTH = 0.02;
const FRAME_WIDTH = 0.06;

/**
 * 図の盤面の地・格子線・外枠。座標はマス1辺を1とする図の単位で、`board-geometry` と同じ置き方をする。
 * 行を切り出したときは、盤面の端ではない上下の縁を格子線で描き、盤面が上下へ続いて見えるようにする。
 */
export function ReflectionFigureGrid({
  size,
  rows = { first: 0, count: size },
}: ReflectionFigureGridProps) {
  const { x: offset } = getReflectionBoardOrigin();
  const top = offset + rows.first;
  const bottom = top + rows.count;
  const left = offset;
  const right = offset + size;
  const touchesTop = rows.first === 0;
  const touchesBottom = rows.first + rows.count === size;

  return (
    <g>
      <rect
        x={left}
        y={top}
        width={size}
        height={rows.count}
        className="fill-background"
      />
      <g className="stroke-border" strokeWidth={GRID_LINE_WIDTH}>
        {Array.from({ length: size - 1 }, (_, index) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: 格子線は位置だけで決まる
            key={`column-${index}`}
            x1={left + index + 1}
            y1={top}
            x2={left + index + 1}
            y2={bottom}
          />
        ))}
        {Array.from({ length: rows.count + 1 }, (_, index) => {
          const y = top + index;
          const isBoardEdge =
            (index === 0 && touchesTop) ||
            (index === rows.count && touchesBottom);
          return isBoardEdge ? null : (
            // biome-ignore lint/suspicious/noArrayIndexKey: 格子線は位置だけで決まる
            <line key={`row-${index}`} x1={left} y1={y} x2={right} y2={y} />
          );
        })}
      </g>
      <g
        className="stroke-foreground/55"
        strokeWidth={FRAME_WIDTH}
        strokeLinecap="square"
      >
        <line x1={left} y1={top} x2={left} y2={bottom} />
        <line x1={right} y1={top} x2={right} y2={bottom} />
        {touchesTop ? <line x1={left} y1={top} x2={right} y2={top} /> : null}
        {touchesBottom ? (
          <line x1={left} y1={bottom} x2={right} y2={bottom} />
        ) : null}
      </g>
    </g>
  );
}
