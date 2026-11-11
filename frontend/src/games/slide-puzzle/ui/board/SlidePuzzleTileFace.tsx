import type { Ref } from "react";

import type { SlidePuzzleTile } from "@/games/slide-puzzle/puzzle/state";

type SlidePuzzleTileFaceProps = {
  tile: SlidePuzzleTile;
  dragging?: boolean;
  ref?: Ref<HTMLSpanElement>;
};

export function SlidePuzzleTileFace({
  tile,
  dragging = false,
  ref,
}: SlidePuzzleTileFaceProps) {
  return (
    <span
      ref={ref}
      data-slide-dragging={dragging}
      data-slide-wood-tone={tile % 4}
      className={`slide-face relative flex size-full items-center justify-center overflow-hidden leading-none tabular-nums transition-colors duration-(--duration-fast) group-focus-visible:ring-2 group-focus-visible:ring-ring ${
        dragging
          ? ""
          : "transition-[translate,background-color] duration-(--duration-normal) ease-enter motion-reduce:transition-none"
      }`}
    >
      <span className="slide-number">{tile}</span>
    </span>
  );
}
