import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  getIceFloorMazeBlockContactMs,
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSnowPushDelayMs,
} from "@/games/ice-floor-maze/ui/board/slide-timing";
import { MOTION_EASING } from "@/lib/motion";

/** 押し出した雪が縮み始めてから、先のマスで雪山が盛り上がり始めるまでと、盛り上がる長さ。 */
const MOUND_RISE_DELAY_MS = 90;
const MOUND_RISE_DURATION_MS = 240;

/** 押された塊が止まった瞬間、進んだ向きに少しつぶれて戻る。駒のつぶれより浅く、重い塊が止まったと読ませる。 */
const BLOCK_STOP_DURATION_MS = 180;
const BLOCK_STOP_SQUASH = 0.9;
const BLOCK_STOP_STRETCH = 1.06;

/**
 * 直前の滑りで動いた要素の、地形に描いた変わった後の姿を動かす。どれも滑りに合わせて遅らせ、それまでは前の姿を見せる。
 * 動きを止めると、地形に描いた変わった後の姿（雪山・止まったマスの塊）がそのまま見える。
 */
export function animateIceFloorMazeMovedElements(
  svg: SVGSVGElement | null,
  slide: IceFloorMazeLastSlide,
  board: IceFloorMazeBoard,
): Animation[] {
  if (!svg) {
    return [];
  }
  const { pushedSnow, movedBlock } = slide;
  const animations: (Animation | undefined)[] = [];

  // 押し出した先の雪山は、雪が縮み始めた少し後に、つぶれた姿から下を支点に盛り上がって現れる。
  if (pushedSnow) {
    animations.push(
      svg
        .querySelector(
          `[data-snow-mound-cell="${pushedSnow.to}"] > [data-cell-body]`,
        )
        ?.animate?.(
          [
            { transform: "scale(0.7, 0.2)", opacity: 0 },
            { transform: "scale(1.05, 1.08)", opacity: 1, offset: 0.65 },
            { transform: "scale(1, 1)", opacity: 1 },
          ],
          {
            duration: MOUND_RISE_DURATION_MS,
            delay: getIceFloorMazeSnowPushDelayMs(slide) + MOUND_RISE_DELAY_MS,
            easing: MOTION_EASING.enter,
            fill: "backwards",
          },
        ),
    );
  }

  // 押した滑る氷の塊は、駒が触れた時刻から駒と同じ速さで元のマスから止まったマスへ滑り、止まった時刻に進んだ向きへつぶれて戻る。
  if (movedBlock) {
    const block = svg.querySelector(
      `[data-sliding-block-cell="${movedBlock.to}"]`,
    );
    const from = getIceFloorMazeCellCenter(board, movedBlock.from);
    const to = getIceFloorMazeCellCenter(board, movedBlock.to);
    const contactMs = getIceFloorMazeBlockContactMs(slide, movedBlock.from);
    const stopMs = getIceFloorMazeSlideDurationMs(slide.path.length);
    const vector = iceFloorMazeDirectionVectors[slide.direction];
    const squashX = vector.x === 0 ? BLOCK_STOP_STRETCH : BLOCK_STOP_SQUASH;
    const squashY = vector.y === 0 ? BLOCK_STOP_STRETCH : BLOCK_STOP_SQUASH;
    animations.push(
      block
        ?.querySelector("[data-block-shift]")
        ?.animate?.(
          [
            { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          {
            duration: stopMs - contactMs,
            delay: contactMs,
            easing: "linear",
            fill: "backwards",
          },
        ),
      block
        ?.querySelector("[data-cell-body]")
        ?.animate?.(
          [
            { transform: "scale(1, 1)" },
            { transform: `scale(${squashX}, ${squashY})`, offset: 0.4 },
            { transform: "scale(1, 1)" },
          ],
          {
            duration: BLOCK_STOP_DURATION_MS,
            delay: stopMs,
            easing: MOTION_EASING.standard,
          },
        ),
    );
  }

  return animations.filter((animation) => animation !== undefined);
}
