import type { ReactNode } from "react";

import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import { reflectionPieceToneClassNames } from "@/games/reflection/ui/reflection-tone";
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
  stock: "size-7",
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
      data-appearing={appearing ? "" : undefined}
      viewBox="0 0 100 100"
      className={cn(
        "pointer-events-none shrink-0 overflow-visible",
        sizeClassNames[size],
        reflectionPieceToneClassNames[piece],
        appearing && appearingClassName,
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth={REFLECTION_PIECE_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="reflection-piece-cartridge" strokeWidth={1.5}>
        <rect x="9" y="9" width="82" height="82" rx="12" />
        <path d="M16 34V20Q16 16 20 16H36" fill="none" />
        <path d="M84 66V80Q84 84 80 84H64" fill="none" />
      </g>
      <g className="reflection-piece-radiant-housing" strokeWidth={1.4}>
        <rect x="10" y="10" width="80" height="80" rx="17" />
        <path d="M19 39V25Q19 19 25 19H40" fill="none" />
        <path d="M81 61V75Q81 81 75 81H60" fill="none" />
      </g>
      {piece === "black-hole" ? (
        <circle
          className="reflection-piece-blackhole-aperture"
          cx="50"
          cy="50"
          r="32"
          strokeWidth={4}
        />
      ) : (
        <g className="reflection-piece-cartridge-blade" strokeWidth={20}>
          {renderReflectionPieceShape(piece)}
        </g>
      )}
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
      {piece === "black-hole" ? null : (
        <g className="reflection-piece-radiant-reflector" strokeWidth={22}>
          {renderReflectionPieceShape(piece)}
        </g>
      )}
      {renderReflectionPieceShape(piece)}
      {piece !== "black-hole" ? (
        <g
          className="reflection-piece-specular"
          strokeWidth={2.5}
          transform="translate(-2.5 -2.5)"
        >
          {renderReflectionPieceShape(piece)}
        </g>
      ) : null}
    </svg>
  );
}
