import type { Ref } from "react";

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
};

/**
 * 番号を載せたタイルの面。盤面と遊び方の図で同じ見た目にする。
 * 大きさは外側の要素に合わせ、押した・フォーカスした見え方は外側の `group` に従う。
 */
export function SlidePuzzleTileFace({
  tile,
  boardSize,
  ref,
}: SlidePuzzleTileFaceProps) {
  return (
    <span
      ref={ref}
      className={`flex size-full items-center justify-center rounded-[1.6cqw] border border-border bg-card font-sans ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold text-card-foreground tabular-nums shadow-raised transition-colors duration-(--duration-fast) group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring`}
    >
      {tile}
    </span>
  );
}
