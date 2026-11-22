import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  SUMMER_BOTTLE_VIEW_BOX,
  SUMMER_LIQUID_BOX,
} from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import {
  SUMMER_POUR_TRANSFER_END,
  SUMMER_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/summer/summer-motion";

const BOTTLE_CAPACITY = 4;

/** 注ぎ元の口を、注ぎ先の口からこれだけ（瓶の高さに対する割合）上に構える。 */
const HOVER_HEIGHT_RATIO = 0.55;

/** 段の数が `level` のときの、色水の水面の高さ（viewport の y）。 */
export function getSurfaceY(rect: BottleRect, level: number): number {
  const { top, bottom } = SUMMER_LIQUID_BOX;
  const surface =
    bottom -
    ((bottom - top) * Math.min(level, BOTTLE_CAPACITY)) / BOTTLE_CAPACITY;
  return rect.top + (rect.height * surface) / SUMMER_BOTTLE_VIEW_BOX.height;
}

export function getPourMouthY(animation: PourAnimation): number {
  const { rect: source } = animation.source;
  const { rect: destination } = animation.destination;
  return destination.top - source.height * HOVER_HEIGHT_RATIO;
}

/** ひょいと持ち上げ、勢いよく傾けて、とぽとぽと揺すりながら注ぎ、ぱっと起こして戻す。 */
export function getSourceKeyframes(animation: PourAnimation): Keyframe[] {
  const { rect: source, liftY } = animation.source;
  const { rect: destination } = animation.destination;
  const dx = destination.left - source.left;
  const hoverY = getPourMouthY(animation) - source.top;
  const d = dx >= 0 ? 1 : -1;
  function at(x: number, y: number, degrees: number) {
    return `translate(${x}px, ${y}px) rotate(${d * degrees}deg)`;
  }

  return [
    { transform: at(0, liftY, 0), offset: 0, easing: "ease-out" },
    { transform: at(0, liftY - 10, -4), offset: 0.06, easing: "ease-in-out" },
    { transform: at(dx, hoverY, 18), offset: 0.19, easing: "ease-out" },
    { transform: at(dx, hoverY + 2, 86), offset: 0.27, easing: "ease-in-out" },
    { transform: at(dx, hoverY, 76), offset: 0.32, easing: "ease-in-out" },
    {
      transform: at(dx, hoverY + 1.5, 85),
      offset: 0.41,
      easing: "ease-in-out",
    },
    { transform: at(dx, hoverY, 77), offset: 0.5, easing: "ease-in-out" },
    {
      transform: at(dx, hoverY + 1.5, 85),
      offset: 0.59,
      easing: "ease-in-out",
    },
    { transform: at(dx, hoverY, 78), offset: 0.67, easing: "ease-in-out" },
    { transform: at(dx, hoverY, 82), offset: 0.72, easing: "ease-out" },
    { transform: at(dx, hoverY - 5, -7), offset: 0.81, easing: "ease-in-out" },
    { transform: at(dx, hoverY - 4, 0), offset: 0.86, easing: "ease-in-out" },
    { transform: at(0, 0, 0), offset: 1 },
  ];
}

// とぽとぽと、流れが太くなったり細くなったりする。
export const streamKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scale(1, 0.1)", offset: 0 },
  { opacity: 0, transform: "scale(1, 0.1)", offset: 0.26 },
  {
    opacity: 1,
    transform: "scale(1.2, 1)",
    offset: SUMMER_POUR_TRANSFER_START + 0.01,
  },
  { opacity: 1, transform: "scale(0.6, 1)", offset: 0.37 },
  { opacity: 1, transform: "scale(1.1, 1)", offset: 0.44 },
  { opacity: 1, transform: "scale(0.55, 1)", offset: 0.51 },
  { opacity: 1, transform: "scale(1.05, 1)", offset: 0.57 },
  { opacity: 1, transform: "scale(0.6, 1)", offset: 0.63 },
  { opacity: 1, transform: "scale(0.9, 1)", offset: 0.68 },
  {
    opacity: 1,
    transform: "scale(0.6, 1)",
    offset: SUMMER_POUR_TRANSFER_END,
  },
  { opacity: 0, transform: "scale(0.4, 0.3)", offset: 0.76 },
  { opacity: 0, transform: "scale(0.4, 0.1)", offset: 1 },
];

// 色水が流れ込むたびに、注ぎ先の瓶が小さく揺れる。
export const destinationWobbleKeyframes: Keyframe[] = [
  { transform: "rotate(0deg)", offset: 0 },
  { transform: "rotate(0deg)", offset: SUMMER_POUR_TRANSFER_START },
  { transform: "rotate(1.6deg)", offset: 0.36 },
  { transform: "rotate(-1.2deg)", offset: 0.45 },
  { transform: "rotate(1deg)", offset: 0.54 },
  { transform: "rotate(-0.8deg)", offset: 0.63 },
  { transform: "rotate(0deg)", offset: SUMMER_POUR_TRANSFER_END + 0.04 },
  { transform: "rotate(0deg)", offset: 1 },
];

export type Droplet = {
  /** 跳ね始める所（長さに対する割合）。 */
  start: number;
  /** 水面から横へ跳ぶ量（瓶の幅に対する割合）。 */
  dx: number;
  /** 水面から上へ跳ぶ高さ（瓶の幅に対する割合）。 */
  rise: number;
};

/** とぽとぽのひと区切りごとに跳ねるしぶき。 */
export const droplets: readonly Droplet[] = [
  { start: 0.32, dx: -0.3, rise: 0.42 },
  { start: 0.36, dx: 0.26, rise: 0.32 },
  { start: 0.45, dx: 0.32, rise: 0.46 },
  { start: 0.52, dx: -0.24, rise: 0.36 },
  { start: 0.59, dx: -0.34, rise: 0.4 },
  { start: 0.64, dx: 0.22, rise: 0.3 },
];

const DROPLET_FLIGHT = 0.1;

/** 水面の位置からの、しぶき1粒の跳ね方。 */
export function getDropletKeyframes(
  droplet: Droplet,
  bottleWidth: number,
  surfaceRiseAtStart: number,
): Keyframe[] {
  const end = Math.min(droplet.start + DROPLET_FLIGHT, 0.99);
  const x = droplet.dx * bottleWidth;
  const peak = -droplet.rise * bottleWidth;
  return [
    { opacity: 0, transform: "translate(0, 0) scale(0.4)", offset: 0 },
    {
      opacity: 0,
      transform: `translate(0, ${surfaceRiseAtStart}px) scale(0.4)`,
      offset: droplet.start,
      easing: "ease-out",
    },
    {
      opacity: 1,
      transform: `translate(${x * 0.6}px, ${surfaceRiseAtStart + peak}px) scale(1)`,
      offset: droplet.start + DROPLET_FLIGHT * 0.5,
      easing: "ease-in",
    },
    {
      opacity: 0,
      transform: `translate(${x}px, ${surfaceRiseAtStart + 2}px) scale(0.6)`,
      offset: end,
    },
    { opacity: 0, transform: `translate(${x}px, 0) scale(0.6)`, offset: 1 },
  ];
}

/** 跳ね始める時の、注ぎ始めからの水面の上がり（px、上が負）。 */
export function getSurfaceRise(
  animation: PourAnimation,
  progress: number,
): number {
  const { rect, before, after } = animation.destination;
  const transfer = Math.min(
    Math.max(
      (progress - SUMMER_POUR_TRANSFER_START) /
        (SUMMER_POUR_TRANSFER_END - SUMMER_POUR_TRANSFER_START),
      0,
    ),
    1,
  );
  const level = before.length + (after.length - before.length) * transfer;
  return getSurfaceY(rect, level) - getSurfaceY(rect, before.length);
}
