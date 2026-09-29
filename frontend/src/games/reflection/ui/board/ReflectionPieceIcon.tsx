import type { ReactNode } from "react";

import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import { cn } from "@/lib/utils";

/** `cell` は盤面のマス、`stock` はストックのボタン、`figure` は遊び方の図。 */
type ReflectionPieceIconSize = "cell" | "stock" | "figure";

type ReflectionPieceIconProps = {
  piece: ReflectionPiece;
  size: ReflectionPieceIconSize;
  /** 置いた直後に、その場で小さく現れさせる。 */
  appearing?: boolean;
};

const sizeClassNames = {
  cell: "size-[80%]",
  stock: "size-6",
  figure: "size-7",
} as const satisfies Record<ReflectionPieceIconSize, string>;

const appearingClassName =
  "animate-in fade-in-0 zoom-in-75 duration-(--duration-normal) motion-reduce:animate-none";

export const REFLECTION_PIECE_STROKE_WIDTH = 10;
/** 光路の線の上に描くとき、ピースの周りに背景色の縁を取って形を切り離す幅。 */
export const REFLECTION_PIECE_HALO_WIDTH = 8;

/**
 * ピースの形。7×7 を 320px 幅で表示すると1マスが約34pxになるため、線と面だけの単純な形で光学機能を表す。
 * 斜め鏡は向きの違う1本線、両面鏡は光を通す向きに沿う2本線、反射体は四角の輪郭、ブラックホールは塗りの円。
 */
export function renderReflectionPieceShape(
  piece: ReflectionPiece,
  extra = 0,
): ReactNode {
  switch (piece) {
    case "slash":
      return <line x1="20" y1="80" x2="80" y2="20" />;
    case "backslash":
      return <line x1="20" y1="20" x2="80" y2="80" />;
    case "vertical-double":
      return (
        <>
          <line x1="38" y1="16" x2="38" y2="84" />
          <line x1="62" y1="16" x2="62" y2="84" />
        </>
      );
    case "horizontal-double":
      return (
        <>
          <line x1="16" y1="38" x2="84" y2="38" />
          <line x1="16" y1="62" x2="84" y2="62" />
        </>
      );
    case "reflector":
      return <rect x="25" y="25" width="50" height="50" rx="3" />;
    case "black-hole":
      return (
        <circle
          cx="50"
          cy="50"
          r={27 + extra / 2}
          fill="currentColor"
          strokeWidth={0}
        />
      );
  }
}

export function ReflectionPieceIcon({
  piece,
  size,
  appearing = false,
}: ReflectionPieceIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn(
        "shrink-0 overflow-visible",
        sizeClassNames[size],
        appearing && appearingClassName,
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth={REFLECTION_PIECE_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {size === "stock" ? null : (
        <g
          className="fill-background stroke-background"
          strokeWidth={
            REFLECTION_PIECE_STROKE_WIDTH + REFLECTION_PIECE_HALO_WIDTH
          }
        >
          {renderReflectionPieceShape(piece, REFLECTION_PIECE_HALO_WIDTH)}
        </g>
      )}
      {renderReflectionPieceShape(piece)}
    </svg>
  );
}
