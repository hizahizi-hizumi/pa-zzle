import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * - `screen`: プレイ画面とゲームのホームの地。置き場所いっぱいに敷く。
 * - `board-frame`: 盤面部品1枚の下に敷く地。盤面の周りに余白を取り、盤面部品の角丸（1rem）に沿って角を丸める。
 * - `figure-frame`: 小さく描く押せない図の盤面の下に敷く地。盤面の幅に対する比の角丸（1/14）に沿って角を丸める。
 */
type SlidePuzzleGroundShape = "screen" | "board-frame" | "figure-frame";

type SlidePuzzleGroundProps = {
  shape?: SlidePuzzleGroundShape;
  /** 地の上に置く盤面。大きさは盤面の側で決め、地はそれに余白を足して囲む。 */
  children?: ReactNode;
};

const shapeClassNames = {
  screen: "size-full",
  "board-frame": "w-fit shrink-0 rounded-[1.5rem] p-2",
  "figure-frame": "w-fit shrink-0 rounded-[calc(100%/14+0.375rem)] p-1.5",
} as const satisfies Record<SlidePuzzleGroundShape, string>;

export function SlidePuzzleGround({
  shape = "screen",
  children,
}: SlidePuzzleGroundProps) {
  return (
    <div
      className={cn("bg-[#e8e2d8] dark:bg-[#2b2722]", shapeClassNames[shape])}
    >
      {children}
    </div>
  );
}
