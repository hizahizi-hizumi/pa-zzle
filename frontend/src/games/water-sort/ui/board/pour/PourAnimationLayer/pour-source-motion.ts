import {
  getGlassPourPose,
  getPourTiltDirection,
  POUR_TILT_EASING,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";

export function getPourSourceKeyframes(
  animation: PourAnimation,
  appearance: WaterSortAppearance,
  viewportWidth: number,
): Keyframe[] {
  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect } = animation.destination;
  const deltaX = destinationRect.left - sourceRect.left;
  const deltaY = destinationRect.top - sourceRect.top;
  const hoverY = deltaY - sourceRect.height * 0.55;
  const direction =
    appearance === "glass"
      ? getPourTiltDirection(destinationRect, viewportWidth)
      : deltaX >= 0
        ? 1
        : -1;
  const glassPose = getGlassPourPose(
    sourceRect,
    destinationRect,
    viewportWidth,
  );
  const tiltDegrees = appearance === "glass" ? 100 : 68;
  const initialTransform = animation.gesture
    ? `translate(${animation.gesture.offsetX}px, ${animation.gesture.offsetY}px) rotate(${animation.gesture.tiltDegrees}deg)`
    : "translate(0, 0) rotate(0deg)";
  const sourceKeyframes: Keyframe[] =
    appearance === "glass"
      ? [
          { transform: initialTransform, offset: 0, easing: "ease-out" },
          {
            transform: animation.gesture
              ? `translate(${animation.gesture.offsetX}px, ${animation.gesture.offsetY - 10}px) rotate(${animation.gesture.tiltDegrees}deg)`
              : "translate(0, -14px) rotate(0deg)",
            offset: 0.12,
            easing: "cubic-bezier(.25,.75,.25,1)",
          },
          {
            transform: `translate(${glassPose.offsetX}px, ${glassPose.offsetY - 10}px) rotate(${direction * 90}deg)`,
            offset: 0.3,
            easing: POUR_TILT_EASING,
          },
          {
            transform: `translate(${glassPose.offsetX}px, ${glassPose.offsetY}px) rotate(${glassPose.tiltDegrees}deg)`,
            offset: 0.38,
            easing: "ease-out",
          },
          {
            transform: `translate(${glassPose.offsetX}px, ${glassPose.offsetY}px) rotate(${glassPose.tiltDegrees}deg)`,
            offset: 0.72,
            opacity: 1,
            easing: "ease-in-out",
          },
          {
            transform: `translate(${glassPose.offsetX}px, ${glassPose.offsetY - 8}px) rotate(${direction * 90}deg)`,
            opacity: 0,
            offset: 0.82,
            easing: POUR_TILT_EASING,
          },
          {
            transform: "translate(0, -6px) rotate(0deg)",
            offset: 0.9,
            opacity: 0,
            easing: "ease-out",
          },
          {
            transform: "translate(0, -2px) rotate(0deg)",
            offset: 0.96,
            opacity: 0.65,
            easing: "ease-out",
          },
          {
            transform: "translate(0, 0) rotate(0deg)",
            opacity: 1,
            offset: 1,
          },
        ]
      : [
          { transform: initialTransform, offset: 0, easing: "ease-out" },
          {
            transform: animation.gesture
              ? initialTransform
              : "translate(0, -4px) rotate(0deg)",
            offset: 0.06,
            easing: POUR_TILT_EASING,
          },
          {
            transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
            offset: 0.2,
            easing: "ease-in-out",
          },
          {
            transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * tiltDegrees}deg)`,
            offset: 0.32,
            easing: "ease-out",
          },
          {
            transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * tiltDegrees}deg)`,
            offset: 0.76,
            easing: "ease-in",
          },
          {
            transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
            offset: 0.86,
            easing: POUR_TILT_EASING,
          },
          { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
        ];

  return sourceKeyframes;
}
