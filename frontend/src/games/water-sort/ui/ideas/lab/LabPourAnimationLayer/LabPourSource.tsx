import { useEffect, useRef } from "react";

import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { LabTransferLiquid } from "@/games/water-sort/ui/ideas/lab/LabPourAnimationLayer/LabTransferLiquid";
import { LabTestTube } from "@/games/water-sort/ui/ideas/lab/LabTestTube";
import {
  LAB_POUR_TILT_DEG,
  LAB_POUR_TOUCH_OFFSET,
} from "@/games/water-sort/ui/ideas/lab/lab-pour-timing";
import { getReagentStreamFill } from "@/games/water-sort/ui/ideas/lab/lab-reagents";
import { getSurfaceRatio } from "@/games/water-sort/ui/ideas/lab/lab-tube-geometry";
import { playAnimations } from "@/lib/motion";

type LabPourSourceProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

/** 液がこぼれ出る口の下の縁を、注ぎ先の口の中ほどへ寄せる量（試験管の幅に対する割合）。 */
const MOUTH_OFFSET_RATIO = 0.1;
/** 口の下の縁が注ぎ先の口に触れる高さ（試験管の高さに対する割合、上が負）。 */
const TOUCH_HEIGHT_RATIO = -0.01;
/** 口の下の縁の、箱の上端の中央からの位置（幅・高さに対する割合）。傾けると、この点が最も低い口の縁になる。 */
const LIP_EDGE_X_RATIO = 0.36;
const LIP_EDGE_Y_RATIO = 0.05;

function getPourGeometry(animation: PourAnimation) {
  const { rect: source } = animation.source;
  const { rect: destination } = animation.destination;
  const direction = destination.left >= source.left ? 1 : -1;
  const lipX =
    destination.left +
    destination.width / 2 -
    direction * destination.width * MOUTH_OFFSET_RATIO;
  const lipY = destination.top + destination.height * TOUCH_HEIGHT_RATIO;
  // 回す中心（箱の上端の中央）から見た口の下の縁を、傾けた角度だけ回して、その縁が触れる所から中心の位置を逆に求める。
  const angle = (direction * LAB_POUR_TILT_DEG * Math.PI) / 180;
  const edgeX = direction * source.width * LIP_EDGE_X_RATIO;
  const edgeY = source.height * LIP_EDGE_Y_RATIO;
  const rotatedX = edgeX * Math.cos(angle) - edgeY * Math.sin(angle);
  const rotatedY = edgeX * Math.sin(angle) + edgeY * Math.cos(angle);
  return {
    direction,
    lipX,
    lipY,
    translateX: lipX - rotatedX - (source.left + source.width / 2),
    translateY: lipY - rotatedY - source.top,
    surfaceY:
      destination.top +
      destination.height * getSurfaceRatio(animation.destination.before.length),
  };
}

export function LabPourSource({ animation, onFinish }: LabPourSourceProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const transferRef = useRef<HTMLSpanElement>(null);
  const geometry = getPourGeometry(animation);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }
    const { liftY, rect } = animation.source;
    const { direction, translateX, translateY } = getPourGeometry(animation);
    const hoverY = translateY - rect.height * 0.2;
    const tilt = direction * LAB_POUR_TILT_DEG;
    const transferElement = transferRef.current;
    const streamElement = streamRef.current;
    const slotCount =
      animation.source.before.length - animation.source.after.length;
    let streamAnimation: Animation | undefined;
    let transferAnimation: Animation | undefined;

    const cancel = playAnimations({
      animate() {
        const sourceAnimation = sourceElement.animate(
          [
            { transform: `translate(0, ${liftY}px) rotate(0deg)`, offset: 0 },
            {
              transform: `translate(0, ${liftY - 6}px) rotate(0deg)`,
              offset: 0.06,
              easing: "cubic-bezier(.45,0,.25,1)",
            },
            {
              transform: `translate(${translateX}px, ${hoverY}px) rotate(${tilt * 0.25}deg)`,
              offset: 0.22,
              easing: "cubic-bezier(.3,0,.2,1)",
            },
            {
              transform: `translate(${translateX}px, ${translateY}px) rotate(${tilt}deg)`,
              offset: LAB_POUR_TOUCH_OFFSET,
              easing: "linear",
            },
            {
              transform: `translate(${translateX}px, ${translateY}px) rotate(${tilt}deg)`,
              offset: 0.74,
              easing: "cubic-bezier(.4,0,.2,1)",
            },
            // 注ぎ先の上を通らず、離れながら起こして戻す。注ぎ先にはこの間にゴム栓を差す。
            {
              transform: `translate(${translateX * 0.45}px, ${translateY * 0.45 - rect.height * 0.12}px) rotate(${tilt * 0.12}deg)`,
              offset: 0.88,
              easing: "cubic-bezier(.3,0,.3,1)",
            },
            { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
          ],
          { duration: POUR_ANIMATION_DURATION_MS },
        );

        streamAnimation = streamElement?.animate?.(
          [
            { clipPath: "inset(0 0 100% 0)", offset: 0 },
            { clipPath: "inset(0 0 100% 0)", offset: 0.35 },
            {
              clipPath: "inset(0 0 0% 0)",
              offset: POUR_TRANSFER_START_OFFSET,
            },
            { clipPath: "inset(0% 0 0 0)", offset: 0.7 },
            { clipPath: "inset(100% 0 0 0)", offset: 0.75 },
            { clipPath: "inset(100% 0 0 0)", offset: 1 },
          ],
          { duration: POUR_ANIMATION_DURATION_MS, fill: "both" },
        );

        transferAnimation = transferElement?.animate?.(
          [
            { height: `${slotCount * 25}%`, offset: 0 },
            {
              height: `${slotCount * 25}%`,
              offset: POUR_TRANSFER_START_OFFSET,
            },
            { height: "0%", offset: POUR_TRANSFER_END_OFFSET },
            { height: "0%", offset: 1 },
          ],
          { duration: POUR_ANIMATION_DURATION_MS, fill: "forwards" },
        );

        return [sourceAnimation];
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished() {
        onFinish(animation.id);
      },
    });

    return () => {
      cancel();
      streamAnimation?.cancel();
      transferAnimation?.cancel();
    };
  }, [onFinish, animation]);

  const streamWidth = Math.max(2, animation.destination.rect.width * 0.05);
  const streamTop = geometry.lipY;

  return (
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top will-change-transform"
        style={getOverlayStyle(animation.source.rect, POUR_LAYER_ORDER.source)}
      >
        <LabTestTube
          contents={animation.source.after}
          // 傾けたときに柄が上を向くよう、傾ける向きと逆の側に柄を出す。
          heldBy={geometry.direction > 0 ? "left" : "right"}
          liquidOverlay={
            <LabTransferLiquid
              colorIndex={animation.colorIndex}
              startSlot={animation.source.after.length}
              slotCount={
                animation.source.before.length - animation.source.after.length
              }
              elementRef={transferRef}
              initiallyFull
            />
          }
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full will-change-[clip-path]"
        style={{
          left: `${geometry.lipX - streamWidth / 2}px`,
          top: `${streamTop}px`,
          width: `${streamWidth}px`,
          height: `${Math.max(0, geometry.surfaceY - streamTop + 2)}px`,
          clipPath: "inset(0 0 100% 0)",
          zIndex: POUR_LAYER_ORDER.stream,
          ...getReagentStreamFill(animation.colorIndex),
        }}
      />
    </>
  );
}
