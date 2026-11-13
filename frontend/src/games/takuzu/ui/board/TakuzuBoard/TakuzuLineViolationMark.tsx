import { type CSSProperties, useRef } from "react";

import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { TakuzuLine } from "@/games/takuzu/puzzle/board";
import { useViolationPulse } from "@/games/takuzu/ui/board/TakuzuBoard/use-violation-pulse";
import { violationMarkTimingClassName } from "@/games/takuzu/ui/board/TakuzuBoard/violation-mark-timing";
import { lineViolationBarClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

type TakuzuLineViolationMarkProps = {
  size: number;
  line: TakuzuLine;
  violated: boolean;
  spotlit: boolean;
};

type LineEdge = "start" | "end";

const lineEdges = ["start", "end"] as const satisfies readonly LineEdge[];

/** 印が出た瞬間に1回だけ、太く長く膨らませて周りに光の輪を広げる。 */
const linePulseKeyframes: Keyframe[] = [
  { transform: "scale(1)", boxShadow: "0 0 0 0 rgb(251 113 133 / 0)" },
  {
    transform: "scale(2.2)",
    boxShadow: "0 0 0 3px rgb(251 113 133 / 0.45)",
    offset: 0.3,
  },
  { transform: "scale(1)", boxShadow: "0 0 0 0 rgb(251 113 133 / 0)" },
];

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

function getEdgeCellArea(
  size: number,
  { axis, index }: TakuzuLine,
  edge: LineEdge,
): CSSProperties {
  // 絶対配置のグリッドの子は、終わりの線を省くとグリッドの端まで広がるため、1本分の範囲を明示する。
  const lineTrack = `${index + 1} / span 1`;
  const edgeTrack = `${edge === "start" ? 1 : size} / span 1`;
  return axis === "row"
    ? { gridRow: lineTrack, gridColumn: edgeTrack }
    : { gridRow: edgeTrack, gridColumn: lineTrack };
}

/** 個数超過・重複の違反がある行・列の印。マスには付けず、盤面の縁の外の両端に置く。 */
export function TakuzuLineViolationMark({
  size,
  line,
  violated,
  spotlit,
}: TakuzuLineViolationMarkProps) {
  const barRefs = {
    start: useRef<HTMLSpanElement>(null),
    end: useRef<HTMLSpanElement>(null),
  } satisfies Record<LineEdge, unknown>;
  useViolationPulse(barRefs.start, violated, linePulseKeyframes);
  useViolationPulse(barRefs.end, violated, linePulseKeyframes);

  return lineEdges.map(function renderEdgeMark(edge) {
    return (
      <span
        key={edge}
        aria-hidden="true"
        data-violated={violated || undefined}
        className="group pointer-events-none absolute inset-0"
        style={getEdgeCellArea(size, line, edge)}
      >
        <span
          ref={barRefs[edge]}
          className={cn(
            "absolute",
            lineViolationBarClassName,
            barPlacementClassNames[line.axis][edge],
            violationMarkTimingClassName,
          )}
        />
        <TutorialSpotlight
          active={spotlit && violated}
          className={cn(
            "rounded-full",
            barPlacementClassNames[line.axis][edge],
          )}
        />
      </span>
    );
  });
}
