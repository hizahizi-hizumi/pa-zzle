import { useLayoutEffect, useRef } from "react";

import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import { iceFloorMazeDirectionVectors } from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  iceFloorMazeBrittleHalfSides,
  iceFloorMazeThinIceShardDirections,
} from "@/games/ice-floor-maze/ui/board/cell-shapes";
import {
  IceFloorMazeCellClipPaths,
  useIceFloorMazeCellClipIds,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { IceFloorMazeCellFace } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellFace";
import {
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
} from "@/games/ice-floor-maze/ui/board/slide-timing";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type IceFloorMazeCellChangesProps = {
  board: IceFloorMazeBoard;
  /** 直前の滑り。滑りごとに描き直す（`key` に滑りの `id` を渡す）。 */
  slide: IceFloorMazeLastSlide;
};

const CRUMBLE_DURATION_MS = 300;
const SHATTER_DURATION_MS = 280;
const RIPPLE_DURATION_MS = 420;
/** 破片が沈み始めてから、下の水面に波紋が広がり始めるまで。 */
const RIPPLE_DELAY_MS = 120;
const RIPPLE_RADIUS = 0.16;
const RIPPLE_WIDTH = 0.06;

/**
 * 直前の滑りで崩れたもろい岩と割れた薄い氷の、変わる前の姿を盤面の上に重ね、崩れる・割れる動きで消す。
 * 下の地形には変わった後の姿（氷・水面）が描いてある。もろい岩は駒が止まった時刻に、割れ目で2つに分かれて
 * ぶつかった向きへ傾きながら沈む。薄い氷は駒がそのマスを離れる時刻に、ひびの線で3つに割れて沈み、水面に波紋が広がる。
 * 重ねた姿はふだん透明で、動いている間だけ見える。動きを減らす設定と動かせない環境では何も見せず、変わった後の姿だけが残る。
 */
export function IceFloorMazeCellChanges({
  board,
  slide,
}: IceFloorMazeCellChangesProps) {
  const layerRef = useRef<SVGGElement>(null);
  const clipIds = useIceFloorMazeCellClipIds();
  const { crumbledRock, crackedIce } = slide;

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer || prefersReducedMotion()) {
      return;
    }

    const animations = animateCellChanges(layer, slide);
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [slide]);

  return (
    <g ref={layerRef}>
      <IceFloorMazeCellClipPaths ids={clipIds} />
      {crumbledRock === null ? null : (
        <g
          data-crumbling-rock={crumbledRock}
          opacity={0}
          transform={formatCellTransform(board, crumbledRock)}
        >
          <IceFloorMazeCellFace kind="brittle-rock" clipIds={clipIds} />
        </g>
      )}
      {crackedIce.map((cellIndex) => (
        <g
          key={cellIndex}
          data-cracking-ice={cellIndex}
          opacity={0}
          transform={formatCellTransform(board, cellIndex)}
        >
          <circle
            data-ripple=""
            cx={0.5}
            cy={0.5}
            r={RIPPLE_RADIUS}
            fill="none"
            strokeWidth={RIPPLE_WIDTH}
            className={iceFloorMazeToneClassNames.wave}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          <IceFloorMazeCellFace kind="thin-ice" clipIds={clipIds} />
        </g>
      ))}
    </g>
  );
}

function formatCellTransform(
  board: IceFloorMazeBoard,
  cellIndex: number,
): string {
  const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
  return `translate(${x} ${y})`;
}

/** 駒がそのマスを離れて半マス進んだ時刻。出発マスは 0 マス目、`path` の `i` 番目は `i + 1` マス目。 */
function getCrackDelayMs(slide: IceFloorMazeLastSlide, cellIndex: number) {
  const cellsFromStart =
    cellIndex === slide.from ? 0 : slide.path.indexOf(cellIndex) + 1;
  return getIceFloorMazeSlideProgressMs(
    slide.path.length,
    cellsFromStart + 0.5,
  );
}

function animateCellChanges(
  layer: SVGGElement,
  slide: IceFloorMazeLastSlide,
): Animation[] {
  const animations: (Animation | undefined)[] = [];
  const crumbling = layer.querySelector<SVGGElement>("[data-crumbling-rock]");
  if (crumbling) {
    const delay = getIceFloorMazeSlideDurationMs(slide.path.length);
    const push = iceFloorMazeDirectionVectors[slide.direction];
    animations.push(keepVisible(crumbling, delay + CRUMBLE_DURATION_MS));
    for (const half of crumbling.querySelectorAll<SVGGElement>(
      "[data-brittle-half]",
    )) {
      const side =
        iceFloorMazeBrittleHalfSides[Number(half.dataset.brittleHalf)] ?? 1;
      animations.push(
        half.animate?.(
          [
            {
              transform: "translate(0px, 0px) rotate(0deg) scale(1)",
              opacity: 1,
            },
            {
              transform: `translate(${side * 0.05}px, 0px) rotate(${side * 4}deg) scale(1)`,
              opacity: 1,
              offset: 0.3,
            },
            {
              transform: `translate(${side * 0.12 + push.x * 0.12}px, ${0.1 + push.y * 0.12}px) rotate(${side * 16}deg) scale(0.5)`,
              opacity: 0,
            },
          ],
          {
            duration: CRUMBLE_DURATION_MS,
            delay,
            easing: MOTION_EASING.exit,
            fill: "both",
          },
        ),
      );
    }
  }

  for (const cracking of layer.querySelectorAll<SVGGElement>(
    "[data-cracking-ice]",
  )) {
    const delay = getCrackDelayMs(slide, Number(cracking.dataset.crackingIce));
    animations.push(
      keepVisible(cracking, delay + RIPPLE_DELAY_MS + RIPPLE_DURATION_MS),
    );
    for (const shard of cracking.querySelectorAll<SVGGElement>(
      "[data-thin-ice-shard]",
    )) {
      const away =
        iceFloorMazeThinIceShardDirections[
          Number(shard.dataset.thinIceShard)
        ] ?? iceFloorMazeThinIceShardDirections[0];
      animations.push(
        shard.animate?.(
          [
            { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
            {
              transform: `translate(${away.x * 0.03}px, ${away.y * 0.03}px) scale(0.96)`,
              opacity: 1,
              offset: 0.25,
            },
            {
              transform: `translate(${away.x * 0.06}px, ${away.y * 0.06}px) scale(0.55)`,
              opacity: 0,
            },
          ],
          {
            duration: SHATTER_DURATION_MS,
            delay,
            easing: MOTION_EASING.exit,
            fill: "both",
          },
        ),
      );
    }
    animations.push(
      cracking.querySelector<SVGCircleElement>("[data-ripple]")?.animate?.(
        [
          { transform: "scale(1)", opacity: 0.9 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        {
          duration: RIPPLE_DURATION_MS,
          delay: delay + RIPPLE_DELAY_MS,
          easing: MOTION_EASING.enter,
          fill: "both",
        },
      ),
    );
  }

  return animations.filter((animation) => animation !== undefined);
}

/** 重ねた姿を `durationMs` の間だけ見せる。終われば元の透明に戻る。 */
function keepVisible(
  element: SVGGElement,
  durationMs: number,
): Animation | undefined {
  return element.animate?.([{ opacity: 1 }, { opacity: 1 }], {
    duration: durationMs,
  });
}
