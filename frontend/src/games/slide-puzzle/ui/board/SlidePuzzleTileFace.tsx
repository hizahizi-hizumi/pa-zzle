import type { ReactNode, Ref } from "react";

import type {
  SlidePuzzleBoardSize,
  SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";

/** 数字はタイル幅の約 3 分の 1 にする。`cqw` は盤面の container を基準にする。 */
const tileNumberClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "text-[10.6cqw]",
  4: "text-[8cqw]",
  5: "text-[6.4cqw]",
};

type SlidePuzzleTileFaceProps = {
  tile: SlidePuzzleTile;
  boardSize: SlidePuzzleBoardSize;
  ref?: Ref<HTMLSpanElement>;
  /** タイルの面に重ね、面と一緒に揺れ・持ち上がる物。 */
  children?: ReactNode;
};

/** 大きさは外側の要素に合わせ、押した・フォーカスした見え方は外側の `group` に従う。 */
export function SlidePuzzleTileFace({
  tile,
  boardSize,
  ref,
  children,
}: SlidePuzzleTileFaceProps) {
  return (
    <span
      ref={ref}
      className={`relative flex size-full items-center justify-center rounded-[1.6cqw] border border-border bg-card font-sans ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold text-card-foreground tabular-nums shadow-raised transition-colors duration-(--duration-fast) group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring`}
    >
      {tile}
      {children}
    </span>
  );
}
