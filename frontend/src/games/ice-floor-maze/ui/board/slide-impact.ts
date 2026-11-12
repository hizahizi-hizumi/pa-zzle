import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";

/**
 * 滑ってきた駒が、勢いのまま止め役（岩・もろい岩・水面・雪山・塊・外壁）にぶつかって止まったか。
 * 床に入って止まった滑りと雪を押し出した滑りは柔らかく止まり、塊を押した滑りは塊が止まる動きが、
 * ゴールで止まった滑りは完成演出が止まりを返すので、含めない。
 */
export function doesIceFloorMazeSlideHitStopper(
  slide: IceFloorMazeLastSlide,
): boolean {
  return (
    !slide.stoppedOnFloor &&
    slide.pushedSnow === null &&
    slide.movedBlock === null &&
    !slide.isClearingMove
  );
}
