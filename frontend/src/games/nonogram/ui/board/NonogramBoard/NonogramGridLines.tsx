import type { CSSProperties } from "react";

import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramGridLinesProps = NonogramGridSize & {
  /** クリアして図柄を見せている。格子を消す。 */
  revealed: boolean;
};

/** 位置を数えやすくするため、この数のマスごとに太い線を引く。 */
const BLOCK_SIZE = 5;

/** マスの内側の境界。`offset` 本目の境界は、`offset + 1` 番目（1始まり）の列・行の始まり。 */
type GridLine = { axis: "column" | "row"; offset: number };

function listInnerLines(width: number, height: number): GridLine[] {
  return [
    ...Array.from({ length: width - 1 }, (_, index) => ({
      axis: "column" as const,
      offset: index + 1,
    })),
    ...Array.from({ length: height - 1 }, (_, index) => ({
      axis: "row" as const,
      offset: index + 1,
    })),
  ];
}

function isBlockLine({ offset }: GridLine): boolean {
  return offset % BLOCK_SIZE === 0;
}

function placeLine({ axis, offset }: GridLine): CSSProperties {
  return axis === "column"
    ? { gridColumn: offset + 1, gridRow: "1 / -1" }
    : { gridRow: offset + 1, gridColumn: "1 / -1" };
}

/** 細い線は境界から後ろのマスへ 1px、太い線は境界をまたいで 2px で描く。 */
const lineClassNames = {
  column: { thin: "border-l", block: "-ml-px border-l-2" },
  row: { thin: "border-t", block: "-mt-px border-t-2" },
} as const;

/**
 * マスの上に重ねる格子。マスと同じ列・行の grid に線を置き、線の縁をマスの縁と同じ画素へ揃える。
 * 細い線を先、太い線と外周を後に描き、太い線を上に出す。
 */
export function NonogramGridLines({
  width,
  height,
  revealed,
}: NonogramGridLinesProps) {
  const lines = listInnerLines(width, height);
  const thinLines = lines.filter((line) => !isBlockLine(line));
  const blockLines = lines.filter(isBlockLine);

  return (
    <div
      aria-hidden="true"
      data-nonogram-clear-fade=""
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] grid",
        revealed && "opacity-0",
      )}
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`,
      }}
    >
      {thinLines.map((line) => (
        <span
          key={`${line.axis}:${line.offset}`}
          className={cn(
            lineClassNames[line.axis].thin,
            nonogramToneClassNames.gridLine,
          )}
          style={placeLine(line)}
        />
      ))}
      {blockLines.map((line) => (
        <span
          key={`${line.axis}:${line.offset}`}
          className={cn(
            lineClassNames[line.axis].block,
            nonogramToneClassNames.blockLine,
          )}
          style={placeLine(line)}
        />
      ))}
      <span
        className={cn("-m-px border-2", nonogramToneClassNames.blockLine)}
        style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}
      />
    </div>
  );
}
