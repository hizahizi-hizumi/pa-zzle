import { useLayoutEffect, useRef } from "react";

import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { doesIceFloorMazeSlideHitStopper } from "@/games/ice-floor-maze/ui/board/slide-impact";
import { getIceFloorMazeSlideDurationMs } from "@/games/ice-floor-maze/ui/board/slide-timing";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type IceFloorMazeImpactSprayProps = {
  board: IceFloorMazeBoard;
  /** 滑りごとに描き直す（`key` に滑りの `id` を渡す）。 */
  slide: IceFloorMazeLastSlide;
};

const SPRAY_DURATION_MS = 420;
/** 明るい氷や雪の上でも、かけらを見分けられるようにする。 */
const CHIP_EDGE_WIDTH = 0.022;
/** ぶつかった面に沿って一瞬走る、当たりの光。動かない岩場や外壁の側が勢いを受け止めたと読ませる。 */
const FLASH_DURATION_MS = 180;
const FLASH_HALF_LENGTH = 0.34;
const FLASH_WIDTH = 0.1;
/** 駒の中心から、ぶつかった面までの距離。 */
const CONTACT_DISTANCE = 0.44;

/**
 * 削れた氷のかけら。`side` はぶつかった面に沿って左右へ飛ぶ量、`back` は来た向きへ跳ね返る量（どちらもマスの単位）。
 */
const chips = [
  { side: -0.7, back: 0.22, size: 0.16 },
  { side: -0.42, back: 0.52, size: 0.12 },
  { side: -0.16, back: 0.3, size: 0.09 },
  { side: 0.18, back: 0.4, size: 0.1 },
  { side: 0.46, back: 0.56, size: 0.13 },
  { side: 0.74, back: 0.2, size: 0.15 },
] as const;

/**
 * 駒が止め役にぶつかって止まった瞬間、ぶつかった面に沿って当たりの光が走り、削れた氷のかけらが左右へ散る。滑ってきた勢いが止め役に受け止められたと読ませる。
 */
export function IceFloorMazeImpactSpray({
  board,
  slide,
}: IceFloorMazeImpactSprayProps) {
  const layerRef = useRef<SVGGElement>(null);
  const hitsStopper = doesIceFloorMazeSlideHitStopper(slide);
  const center = getIceFloorMazeCellCenter(board, slide.to);
  const vector = iceFloorMazeDirectionVectors[slide.direction];
  const distance = slide.path.length;

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer || !hitsStopper || prefersReducedMotion()) {
      return;
    }

    const delay = getIceFloorMazeSlideDurationMs(distance);
    const animations = Array.from(
      layer.querySelectorAll<SVGRectElement>("[data-chip]"),
      (chip, index) => {
        const { side, back } = chips[index]!;
        const dx = -vector.y * side - vector.x * back;
        const dy = vector.x * side - vector.y * back;
        return chip.animate?.(
          [
            { transform: "translate(0px, 0px) rotate(0deg)", opacity: 0.95 },
            {
              transform: `translate(${dx}px, ${dy}px) rotate(${side * 240}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: SPRAY_DURATION_MS,
            delay,
            easing: MOTION_EASING.enter,
          },
        );
      },
    ).filter((animation) => animation !== undefined);
    const flash = layer
      .querySelector<SVGLineElement>("[data-impact-flash]")
      ?.animate?.(
        [
          { transform: "scale(0.3)", opacity: 1 },
          { transform: "scale(1.5)", opacity: 0 },
        ],
        { duration: FLASH_DURATION_MS, delay, easing: MOTION_EASING.enter },
      );
    if (flash) {
      animations.push(flash);
    }
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [distance, hitsStopper, vector]);

  if (!hitsStopper) {
    return null;
  }
  const palette = iceFloorMazeTone;

  return (
    <g
      ref={layerRef}
      data-impact-spray=""
      transform={`translate(${center.x + vector.x * CONTACT_DISTANCE} ${center.y + vector.y * CONTACT_DISTANCE})`}
    >
      <line
        data-impact-flash=""
        x1={-vector.y * FLASH_HALF_LENGTH}
        y1={vector.x * FLASH_HALF_LENGTH}
        x2={vector.y * FLASH_HALF_LENGTH}
        y2={-vector.x * FLASH_HALF_LENGTH}
        stroke={palette.chip}
        strokeWidth={FLASH_WIDTH}
        strokeLinecap="round"
        opacity={0}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {chips.map(({ side, size }) => (
        <rect
          key={side}
          data-chip=""
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          rx={size * 0.2}
          fill={palette.chip}
          stroke={palette.chipEdge}
          strokeWidth={CHIP_EDGE_WIDTH}
          opacity={0}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
    </g>
  );
}
