import type { TakuzuCell, TakuzuTile } from "@/games/takuzu/puzzle/board";
import { cn } from "@/lib/utils";

/** `board` は盤面のマス、`figure` は遊び方や難易度の図に描く小さなマス。 */
export type TakuzuCellFaceSize = "board" | "figure";

/**
 * 固定タイルと置いたタイルは、ナンプレの与えられた数字と入力した数字と同じく、色の濃淡だけで分ける。
 * 固定は前景色、置いたタイルはゲーム固有の青。形はどちらも同じにする。
 */
const toneClassNames = {
  given: "text-foreground",
  placed: "text-sky-700 dark:text-sky-300",
} as const;

// 小さな図では輪郭が細くなりすぎないよう、丸の線を太くする。
const circleStrokeWidths = {
  board: 9,
  figure: 12,
} as const satisfies Record<TakuzuCellFaceSize, number>;

// 置いたタイルだけを、その場で小さく現れさせる。固定タイルは最初から盤面にあるので動かさない。
const placedTileAppearanceClassName =
  "animate-in fade-in-0 zoom-in-90 duration-(--duration-fast) motion-reduce:animate-none";

type TakuzuCellFaceProps = {
  cell: TakuzuCell;
  given: boolean;
  size: TakuzuCellFaceSize;
};

/**
 * A は塗りの四角、B は輪郭の丸。色を見なくても形だけで見分けられる。
 * 描く大きさは外側の要素に合わせる。
 */
export function TakuzuCellFace({ cell, given, size }: TakuzuCellFaceProps) {
  if (cell === null) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn(
        "size-full",
        given ? toneClassNames.given : toneClassNames.placed,
        !given && size === "board" && placedTileAppearanceClassName,
      )}
    >
      {renderTileShape(cell, circleStrokeWidths[size])}
    </svg>
  );
}

function renderTileShape(tile: TakuzuTile, circleStrokeWidth: number) {
  if (tile === "a") {
    return (
      <rect x="20" y="20" width="60" height="60" rx="6" fill="currentColor" />
    );
  }
  return (
    <circle
      cx="50"
      cy="50"
      r={31 - circleStrokeWidth / 2}
      fill="none"
      stroke="currentColor"
      strokeWidth={circleStrokeWidth}
    />
  );
}
