import type { ReactNode } from "react";

import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import { cn } from "@/lib/utils";

/** `cell` は盤面のマスいっぱい、`stock` はストックのボタンに収まる大きさ。 */
type ReflectionPieceIconSize = "cell" | "stock";

type ReflectionPieceIconProps = {
  piece: ReflectionPiece;
  size: ReflectionPieceIconSize;
};

const sizeClassNames = {
  cell: "size-[78%]",
  stock: "size-8",
} as const satisfies Record<ReflectionPieceIconSize, string>;

// 仮の図形。線と面だけで光学機能を表す。
function renderPieceShape(piece: ReflectionPiece): ReactNode {
  switch (piece) {
    case "slash":
      return <line x1="18" y1="82" x2="82" y2="18" />;
    case "backslash":
      return <line x1="18" y1="18" x2="82" y2="82" />;
    case "vertical-double":
      return (
        <>
          <line x1="42" y1="14" x2="42" y2="86" />
          <line x1="58" y1="14" x2="58" y2="86" />
        </>
      );
    case "horizontal-double":
      return (
        <>
          <line x1="14" y1="42" x2="86" y2="42" />
          <line x1="14" y1="58" x2="86" y2="58" />
        </>
      );
    case "reflector":
      return <rect x="24" y="24" width="52" height="52" rx="4" />;
    case "black-hole":
      return <circle cx="50" cy="50" r="24" fill="currentColor" />;
  }
}

export function ReflectionPieceIcon({ piece, size }: ReflectionPieceIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn("shrink-0", sizeClassNames[size])}
      fill="none"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
    >
      {renderPieceShape(piece)}
    </svg>
  );
}
