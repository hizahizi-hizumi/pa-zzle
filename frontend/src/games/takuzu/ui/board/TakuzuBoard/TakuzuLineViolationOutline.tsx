import type { CSSProperties } from "react";

import type { TakuzuLine } from "@/games/takuzu/puzzle/board";
import { violationMarkTimingClassName } from "@/games/takuzu/ui/board/TakuzuBoard/violation-mark-timing";
import { lineViolationOutlineClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

type TakuzuLineViolationOutlineProps = {
  size: number;
  line: TakuzuLine;
  violated: boolean;
};

/** 行・列全体のグリッド領域。 */
function getLineArea(size: number, { axis, index }: TakuzuLine): CSSProperties {
  // 絶対配置のグリッドの子は、終わりの線を省くとグリッドの端まで広がるため、範囲を明示する。
  const lineTrack = `${index + 1} / span 1`;
  const crossTrack = `1 / span ${size}`;
  return axis === "row"
    ? { gridRow: lineTrack, gridColumn: crossTrack }
    : { gridRow: crossTrack, gridColumn: lineTrack };
}

/**
 * 個数超過・重複の違反がある行・列を、盤面の中で囲む枠。縁の外の印より目に付き、どのマスがルールに当たっているかが分かる。
 * マスの地を塗る3連続と見分けられるよう、枠だけを描く。
 */
export function TakuzuLineViolationOutline({
  size,
  line,
  violated,
}: TakuzuLineViolationOutlineProps) {
  return (
    <span
      aria-hidden="true"
      data-violated={violated || undefined}
      className="group pointer-events-none absolute inset-0"
      style={getLineArea(size, line)}
    >
      <span
        data-line-violation-outline
        className={cn(
          "absolute inset-0",
          lineViolationOutlineClassName,
          violationMarkTimingClassName,
        )}
      />
    </span>
  );
}
