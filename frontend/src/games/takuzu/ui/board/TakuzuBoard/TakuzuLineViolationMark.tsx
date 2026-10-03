import type { CSSProperties } from "react";

import type { TakuzuLine } from "@/games/takuzu/puzzle/board";
import { violationMarkTimingClassName } from "@/games/takuzu/ui/board/TakuzuBoard/violation-mark-timing";
import { lineViolationBarClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

type TakuzuLineViolationMarkProps = {
  rowCount: number;
  columnCount: number;
  line: TakuzuLine;
  violated: boolean;
};

type LineEdge = "start" | "end";

const lineEdges = ["start", "end"] as const satisfies readonly LineEdge[];

const barPlacementClassNames = {
  row: {
    start: "top-[25%] bottom-[25%] right-[calc(100%+6px)] w-0.5",
    end: "top-[25%] bottom-[25%] left-[calc(100%+6px)] w-0.5",
  },
  column: {
    start: "left-[25%] right-[25%] bottom-[calc(100%+6px)] h-0.5",
    end: "left-[25%] right-[25%] top-[calc(100%+6px)] h-0.5",
  },
} as const satisfies Record<TakuzuLine["axis"], Record<LineEdge, string>>;

/** 行・列の端のマスのグリッド領域。印はこの領域の外側（盤面の縁の外）に置く。 */
function getEdgeCellArea(
  rowCount: number,
  columnCount: number,
  { axis, index }: TakuzuLine,
  edge: LineEdge,
): CSSProperties {
  const lineLength = axis === "row" ? columnCount : rowCount;
  // 絶対配置のグリッドの子は、終わりの線を省くとグリッドの端まで広がるため、1本分の範囲を明示する。
  const lineTrack = `${index + 1} / span 1`;
  const edgeTrack = `${edge === "start" ? 1 : lineLength} / span 1`;
  return axis === "row"
    ? { gridRow: lineTrack, gridColumn: edgeTrack }
    : { gridRow: edgeTrack, gridColumn: lineTrack };
}

/**
 * 個数超過・重複の違反がある行・列の印。行・列全体の違反なので、マスには付けず、盤面の縁の外の両端に置く。
 * 直す必要のないタイルまで誤りに見せないためと、マスごとに示す3連続と見分けるため。
 */
export function TakuzuLineViolationMark({
  rowCount,
  columnCount,
  line,
  violated,
}: TakuzuLineViolationMarkProps) {
  return lineEdges.map(function renderEdgeMark(edge) {
    return (
      <span
        key={edge}
        aria-hidden="true"
        data-violated={violated || undefined}
        className="group pointer-events-none absolute inset-0"
        style={getEdgeCellArea(rowCount, columnCount, line, edge)}
      >
        <span
          className={cn(
            "absolute",
            lineViolationBarClassName,
            barPlacementClassNames[line.axis][edge],
            violationMarkTimingClassName,
          )}
        />
      </span>
    );
  });
}
