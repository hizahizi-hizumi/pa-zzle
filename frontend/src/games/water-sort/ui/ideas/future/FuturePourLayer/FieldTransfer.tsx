import {
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { FutureCell } from "@/games/water-sort/ui/ideas/future/FutureCell";
import {
  getTransferFluidHeight,
  TransferFluid,
} from "@/games/water-sort/ui/ideas/future/FuturePourLayer/TransferFluid";
import { getFieldStreamShape } from "@/games/water-sort/ui/ideas/future/field-stream-geometry";
import {
  CELL_COLLAR,
  CELL_MOUTH,
  CELL_VIEW_HEIGHT,
  CELL_VIEW_WIDTH,
  getFluidSurfaceRatio,
} from "@/games/water-sort/ui/ideas/future/future-cell-geometry";
import { getFutureFluidView } from "@/games/water-sort/ui/ideas/future/future-palette";
import {
  FIELD_POUR_DURATION_MS,
  FIELD_POUR_PHASES,
  getFieldPourElapsed,
  getFieldPourFrame,
  getMovedSlotCount,
} from "@/games/water-sort/ui/ideas/future/future-pour-timing";

type FieldTransferProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

/**
 * 注ぎ先（今の注ぐ演出と同じ 1）・注ぎ元・流れの順に重ねる。流れは管のガラスの中を通るので両方の管より上に置き、
 * 口金の所だけ隠して、口に出入りして見えるようにする。
 */
const SOURCE_LAYER = 3;
const STREAM_LAYER = 4;
/** 画面が隠れて描画の更新が止まっても、注ぎ終わりの知らせを遅らせすぎない。 */
const FINISH_FALLBACK_MARGIN_MS = 400;

/** 注ぎ元の管は傾けず、場の力で液を口から引き出し、光の流れにして宙を渡す。 */
export function FieldTransfer({ animation, onFinish }: FieldTransferProps) {
  const id = useId();
  const glowId = `${id}-glow`;
  const maskId = `${id}-mask`;
  const sourceRef = useRef<HTMLDivElement>(null);
  const fluidRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const outerRef = useRef<SVGPathElement>(null);
  const innerRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const sourceCollarRef = useRef<SVGRectElement>(null);
  const destinationCollarRef = useRef<SVGRectElement>(null);
  const [engaged, setEngaged] = useState(true);
  // 時計の再描画などで onFinish が作り直されても、演出をやり直さない。
  const notifyFinish = useEffectEvent(function notifyFinished() {
    onFinish(animation.id);
  });

  useLayoutEffect(() => {
    const { source, destination } = animation;
    const movedSlots = getMovedSlotCount(animation);
    const width = Math.max(5, source.rect.width * 0.27);
    let frameRequest = 0;
    let finished = false;

    function finish() {
      if (finished) {
        return;
      }
      finished = true;
      notifyFinish();
    }

    function render() {
      const t = getFieldPourElapsed(animation);
      const frame = getFieldPourFrame(t);
      const liftY = source.liftY * (1 - frame.settle);
      const dipY = destination.rect.height * frame.receiverDip;
      if (sourceRef.current) {
        sourceRef.current.style.transform = `translateY(${liftY}px)`;
      }
      if (fluidRef.current) {
        fluidRef.current.style.height = getTransferFluidHeight(
          movedSlots,
          1 - frame.drained,
        );
      }

      const sourceTop = source.rect.top + liftY;
      const destinationTop = destination.rect.top + dipY;
      placeCollar(sourceCollarRef.current, source.rect, sourceTop);
      placeCollar(
        destinationCollarRef.current,
        destination.rect,
        destinationTop,
      );
      const shape = getFieldStreamShape(
        {
          sourceSurface: {
            x: source.rect.left + source.rect.width * CELL_MOUTH.x,
            y:
              sourceTop +
              source.rect.height *
                getFluidSurfaceRatio(
                  source.after.length + movedSlots * (1 - frame.drained),
                ),
          },
          sourceMouth: {
            x: source.rect.left + source.rect.width * CELL_MOUTH.x,
            y: sourceTop + source.rect.height * CELL_MOUTH.y,
          },
          destinationMouth: {
            x: destination.rect.left + destination.rect.width * CELL_MOUTH.x,
            y: destinationTop + destination.rect.height * CELL_MOUTH.y,
          },
          destinationSurface: {
            x: destination.rect.left + destination.rect.width * CELL_MOUTH.x,
            y:
              destinationTop +
              destination.rect.height *
                getFluidSurfaceRatio(destination.before.length),
          },
          cellWidth: source.rect.width,
          cellHeight: source.rect.height,
          viewportCenterX: window.innerWidth / 2,
        },
        frame.tail,
        frame.head,
        width,
        t,
      );
      glowRef.current?.setAttribute("d", shape?.outer ?? "");
      outerRef.current?.setAttribute("d", shape?.outer ?? "");
      innerRef.current?.setAttribute("d", shape?.inner ?? "");
      coreRef.current?.setAttribute("d", shape?.core ?? "");
      if (headRef.current) {
        const visible = shape && frame.head < 1;
        headRef.current.setAttribute("cx", String(shape?.head.x ?? 0));
        headRef.current.setAttribute("cy", String(shape?.head.y ?? 0));
        headRef.current.setAttribute(
          "r",
          visible ? String(shape.head.radius) : "0",
        );
      }

      if (t >= 1) {
        finish();
        return;
      }
      frameRequest = requestAnimationFrame(render);
    }

    render();
    const releaseTimer = window.setTimeout(
      () => setEngaged(false),
      FIELD_POUR_DURATION_MS * FIELD_POUR_PHASES.tailLeaves,
    );
    const fallbackTimer = window.setTimeout(
      finish,
      FIELD_POUR_DURATION_MS + FINISH_FALLBACK_MARGIN_MS,
    );

    return () => {
      finished = true;
      cancelAnimationFrame(frameRequest);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [animation]);

  const { source } = animation;
  const base = getFutureFluidView(animation.colorIndex).base;
  const beneath = source.after[source.after.length - 1];

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 size-full overflow-visible"
        style={{ zIndex: STREAM_LAYER }}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="#ffffff" />
            <rect ref={sourceCollarRef} fill="#000000" />
            <rect ref={destinationCollarRef} fill="#000000" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <path
            ref={glowRef}
            fill={base}
            opacity="0.32"
            filter={`url(#${glowId})`}
          />
          <path
            ref={outerRef}
            style={{ fill: `color-mix(in oklab, ${base} 58%, #03070b)` }}
          />
          <path ref={innerRef} fill={base} />
          <path
            ref={coreRef}
            fill="none"
            strokeLinecap="round"
            strokeWidth={Math.max(1, source.rect.width * 0.035)}
            opacity="0.85"
            style={{ stroke: `color-mix(in oklab, ${base} 55%, #ffffff)` }}
          />
          <circle ref={headRef} r="0" fill={base} />
        </g>
      </svg>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed will-change-transform"
        style={{
          left: source.rect.left,
          top: source.rect.top,
          width: source.rect.width,
          height: source.rect.height,
          zIndex: SOURCE_LAYER,
          transform: `translateY(${source.liftY}px)`,
        }}
      >
        <FutureCell
          contents={source.after}
          role="pour-source"
          selected={engaged}
          waterOverlay={
            <TransferFluid
              colorIndex={animation.colorIndex}
              startSlot={source.after.length}
              slotCount={getMovedSlotCount(animation)}
              separated={
                beneath !== undefined && beneath !== animation.colorIndex
              }
              elementRef={fluidRef}
              initialFill={1}
            />
          }
        />
      </div>
    </>
  );
}

function placeCollar(
  element: SVGRectElement | null,
  rect: BottleRect,
  top: number,
) {
  if (!element) {
    return;
  }
  const left = rect.left + (rect.width * CELL_COLLAR.left) / CELL_VIEW_WIDTH;
  const right = rect.left + (rect.width * CELL_COLLAR.right) / CELL_VIEW_WIDTH;
  element.setAttribute("x", String(left));
  element.setAttribute("y", String(top));
  element.setAttribute("width", String(right - left));
  element.setAttribute(
    "height",
    String((rect.height * CELL_COLLAR.bottom) / CELL_VIEW_HEIGHT),
  );
}
