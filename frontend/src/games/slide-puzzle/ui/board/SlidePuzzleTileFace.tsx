import type { Ref } from "react";
import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import type {
  SlidePuzzleBoardSize,
  SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import type { SlidePuzzleSurface } from "@/games/slide-puzzle/ui/board/slide-puzzle-surface";

/** 数字はタイル幅の約 3 分の 1 にする。`cqw` は盤面の container を基準にする。 */
const tileNumberClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "text-[10.6cqw]",
  4: "text-[8cqw]",
  5: "text-[6.4cqw]",
};

type SlidePuzzleTileFaceProps = {
  tile: SlidePuzzleTile;
  boardSize: SlidePuzzleBoardSize;
  surface?: SlidePuzzleSurface;
  previewOffset?: number;
  moveDirection?: SlidePuzzleDirection | null;
  ref?: Ref<HTMLSpanElement>;
};

const tileFaceSurfaceClasses: Record<SlidePuzzleSurface, string> = {
  original:
    "rounded-[1.6cqw] border border-border bg-card font-sans text-card-foreground shadow-raised group-active:bg-accent",
  crafted:
    "rounded-[1.6cqw] border border-[#f4d7a7] bg-[linear-gradient(135deg,#f7e2bc_0%,#d6aa70_100%)] font-serif text-[#53351e] shadow-[inset_0_2px_2px_#ffffffab,inset_0_-3px_1px_#a77345a8,0_3px_0_#6c3d28,0_6px_9px_#25120850] group-active:translate-y-[2px] group-active:shadow-[inset_0_2px_2px_#ffffffab,0_1px_0_#6c3d28]",
  precision:
    "rounded-[0.8cqw] border border-[#f7faff] bg-[linear-gradient(145deg,#eff4f7_0%,#b3c2cd_100%)] font-mono text-[#283f50] shadow-[inset_0_2px_3px_#ffffffdd,inset_0_-2px_0_#758d9f,0_3px_0_#263c4d,0_5px_7px_#0c22396b] group-active:translate-y-[2px] group-active:shadow-[inset_0_1px_3px_#ffffff99,0_1px_0_#263c4d]",
  playful:
    "rounded-[2.7cqw] border border-white/70 font-sans text-[#19333e] shadow-[inset_0_2px_0_#ffffff70,0_4px_0_#392b3550,0_6px_11px_#392b3524] group-active:translate-y-[2px] group-active:shadow-[inset_0_2px_0_#ffffff70,0_1px_0_#392b3550]",
};

const playfulColors = [
  "bg-[#b1e5dc]",
  "bg-[#ffb79c]",
  "bg-[#cfc3f1]",
  "bg-[#f9d98b]",
  "bg-[#add7eb]",
] as const;

/**
 * 番号を載せたタイルの面。盤面と遊び方の図で同じ見た目にする。
 * 大きさは外側の要素に合わせ、押した・フォーカスした見え方は外側の `group` に従う。
 */
export function SlidePuzzleTileFace({
  tile,
  boardSize,
  surface = "original",
  previewOffset = 0,
  moveDirection = null,
  ref,
}: SlidePuzzleTileFaceProps) {
  return (
    <span
      ref={ref}
      style={
        previewOffset > 0
          ? {
              translate:
                moveDirection === "up"
                  ? `0 -${previewOffset}px`
                  : moveDirection === "down"
                    ? `0 ${previewOffset}px`
                    : moveDirection === "left"
                      ? `-${previewOffset}px 0`
                      : `${previewOffset}px 0`,
            }
          : undefined
      }
      className={`flex size-full items-center justify-center ${tileFaceSurfaceClasses[surface]} ${surface === "playful" ? playfulColors[Math.floor((tile - 1) / boardSize)] : ""} ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold tabular-nums transition-[background-color,transform,box-shadow] duration-(--duration-fast) motion-reduce:transition-none group-focus-visible:ring-2 group-focus-visible:ring-ring`}
    >
      {tile}
    </span>
  );
}
