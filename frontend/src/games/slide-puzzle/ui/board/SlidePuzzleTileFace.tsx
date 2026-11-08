import type { Ref } from "react";

import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import type {
  SlidePuzzleBoardSize,
  SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import type { SlidePuzzleExperience } from "@/games/slide-puzzle/ui/board/slide-puzzle-experience";

const tileNumberClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "text-[10.6cqw]",
  4: "text-[8cqw]",
  5: "text-[6.4cqw]",
};

const tileAppearance: Record<SlidePuzzleExperience, string> = {
  classic:
    "rounded-[1.6cqw] border border-border bg-card text-card-foreground shadow-raised group-active:bg-accent",
  kinetic:
    "rounded-[1.5cqw] border border-[#fffdf7] bg-[#f6f3eb] text-[#273039] shadow-[0_0.8cqw_0_#8f958e,0_1.6cqw_2cqw_rgb(0_0_0_/_0.2)] group-active:bg-[#ffffff]",
  pocket:
    "rounded-[1cqw] border border-[#ffffff]/80 bg-[#f3f4f0] text-[#345252] shadow-[0_0.4cqw_1cqw_rgb(37_58_54_/_0.13)] group-active:bg-white",
};

type SlidePuzzleTileFaceProps = {
  tile: SlidePuzzleTile;
  boardSize: SlidePuzzleBoardSize;
  experience?: SlidePuzzleExperience;
  dragOffset?: number;
  slideDirection?: SlidePuzzleDirection | null;
  dragging?: boolean;
  ref?: Ref<HTMLSpanElement>;
};

export function SlidePuzzleTileFace({
  tile,
  boardSize,
  experience = "classic",
  dragOffset = 0,
  slideDirection,
  dragging = false,
  ref,
}: SlidePuzzleTileFaceProps) {
  const x =
    slideDirection === "left"
      ? -dragOffset
      : slideDirection === "right"
        ? dragOffset
        : 0;
  const y =
    slideDirection === "up"
      ? -dragOffset
      : slideDirection === "down"
        ? dragOffset
        : 0;
  return (
    <span
      ref={ref}
      className={`relative flex size-full items-center justify-center overflow-hidden font-sans ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold tabular-nums transition-colors duration-(--duration-fast) group-focus-visible:ring-2 group-focus-visible:ring-ring ${tileAppearance[experience]} ${
        dragging
          ? ""
          : "transition-[translate,background-color] duration-(--duration-normal) ease-enter motion-reduce:transition-none"
      }`}
      style={{ translate: dragOffset ? `${x}px ${y}px` : undefined }}
    >
      {tile}
    </span>
  );
}
