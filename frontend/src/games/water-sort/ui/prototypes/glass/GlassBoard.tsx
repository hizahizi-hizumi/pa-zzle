// 試作 glass: 木の試験管立てに並ぶ厚手ガラスの試験管の盤面。
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

import { getLiquidColor } from "./liquid-colors";
import { BASE, createRackLayout, PITCH, TIER, RackBack, RackFront } from "./rack";
import {
  buildScene,
  createPoseFx,
  currentPose,
  type Fx,
  fxEnd,
  LIFTED,
  lipWorld,
  POUR,
  type PourFx,
  poseXf,
  REST,
  tubeRestTop,
  tubeRestX,
} from "./timeline";
import { Tube, TubeDefs } from "./Tube";

const BUTTON_TOP = 26;

/** 確かめるための遅回し（URL の glassSlow=倍率）。 */
const TIME_SCALE =
  typeof window === "undefined"
    ? 1
    : Number(new URLSearchParams(window.location.search).get("glassSlow")) || 1;

function clock() {
  return performance.now() / TIME_SCALE;
}


export function GlassBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const rawId = useId();
  const p = `gl${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const layout = createRackLayout(state.length);
  const fxRef = useRef<Fx[]>([]);
  const [now, setNow] = useState(0);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const processedRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onPourAnimationActivityChange, onClearAnimationComplete });
  callbacksRef.current = { onPourAnimationActivityChange, onClearAnimationComplete };

  const setActive = useCallback((active: boolean) => {
    if (activeRef.current !== active) {
      activeRef.current = active;
      callbacksRef.current.onPourAnimationActivityChange?.(active);
    }
  }, []);

  const tick = useCallback(() => {
    const t = clock();
    const remaining: Fx[] = [];
    for (const fx of fxRef.current) {
      if (t < fxEnd(fx)) remaining.push(fx);
      else if (fx.kind === "finale") callbacksRef.current.onClearAnimationComplete?.();
    }
    fxRef.current = remaining;
    setNow(t);
    if (remaining.length > 0) {
      frameRef.current = requestAnimationFrame(tick);
    } else {
      frameRef.current = null;
      setActive(false);
    }
  }, [setActive]);

  const addFx = useCallback(
    (fxs: Fx[]) => {
      fxRef.current = [...fxRef.current, ...fxs];
      setActive(true);
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
    },
    [setActive, tick],
  );

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const t = clock();
    if (!operation) {
      if (fxRef.current.length > 0) {
        fxRef.current = [];
        setNow(t);
      }
      processedRef.current = null;
      return;
    }
    if (processedRef.current === operation.id) return;
    processedRef.current = operation.id;
    if (operation.type === "source-selected" || operation.type === "source-deselected") {
      // 演出の途中の管に触れたら、その管の注ぐ演出は済ませて今の姿から動かす。
      const touched = operation.bottleIndex;
      fxRef.current = fxRef.current.filter(
        (fx) => !(fx.kind === "pour" && (fx.src === touched || fx.dst === touched)),
      );
    }
    const current = fxRef.current;

    switch (operation.type) {
      case "source-selected": {
        const from = currentPose(current, operation.bottleIndex, false, t);
        addFx([
          createPoseFx(operation.bottleIndex, from, LIFTED, t),
          { kind: "slosh", start: t + 60, tube: operation.bottleIndex, amp: -5 },
        ]);
        return;
      }
      case "source-deselected": {
        const from = currentPose(current, operation.bottleIndex, true, t);
        addFx([
          createPoseFx(operation.bottleIndex, from, REST, t),
          { kind: "slosh", start: t + 200, tube: operation.bottleIndex, amp: 4 },
        ]);
        return;
      }
      case "invalid": {
        const rejected: Fx[] = [
          { kind: "shake", start: t, tube: operation.bottleIndex, role: "target" },
        ];
        if (sourceBottleIndex !== null && sourceBottleIndex !== operation.bottleIndex) {
          rejected.push({ kind: "shake", start: t, tube: sourceBottleIndex, role: "source" });
        }
        addFx(rejected);
        return;
      }
      case "poured": {
        const src = operation.sourceBottleIndex;
        const dst = operation.destinationBottleIndex;
        // 同じ管に関わる前の演出は、新しい注ぎに譲る。
        fxRef.current = current.filter(
          (fx) =>
            !(
              (fx.kind === "pour" &&
                (fx.src === src || fx.dst === src || fx.src === dst || fx.dst === dst)) ||
              (fx.kind === "pose" && fx.tube === src)
            ),
        );
        const srcBefore = operation.stateBefore[src] ?? [];
        const srcAfter = operation.stateAfter[src] ?? [];
        const dstBefore = operation.stateBefore[dst] ?? [];
        const dstAfter = operation.stateAfter[dst] ?? [];
        const color = srcBefore[srcBefore.length - 1] ?? 0;
        const srcX = tubeRestX(layout, src);
        const dstX = tubeRestX(layout, dst);
        let side: 1 | -1 = srcX < dstX ? 1 : srcX > dstX ? -1 : dstX > layout.width / 2 ? 1 : -1;
        const bodyReach = 190;
        if (side === 1 && dstX - bodyReach < 0) side = -1;
        else if (side === -1 && dstX + bodyReach > layout.width) side = 1;
        const pose = currentPose(current, src, true, t);
        const fromXf = poseXf(layout, src, pose);
        const pour: PourFx = {
          kind: "pour",
          start: t,
          src,
          dst,
          color,
          amount: dstAfter.length - dstBefore.length,
          srcBefore,
          srcAfter,
          dstBefore,
          dstAfter,
          side,
          w0: lipWorld(fromXf, side),
          a0: pose.tilt,
          isMerge: dstBefore.length > 0 && dstBefore[dstBefore.length - 1] === color,
          completes: isCompleteWaterSortBottle(dstAfter),
          empties: srcAfter.length === 0,
          clearing: operation.isClearingMove,
        };
        const extra: Fx[] = [
          { kind: "slosh", start: t + POUR.landed, tube: src, amp: 6 },
          { kind: "slosh", start: t + POUR.streamEnd + 60, tube: dst, amp: 3 },
        ];
        if (operation.isClearingMove) {
          extra.push({ kind: "finale", start: t + POUR.finaleStart });
        }
        addFx([pour, ...extra]);
        return;
      }
    }
  }, [operation, addFx, layout, sourceBottleIndex]);

  const renderNow = now === 0 ? clock() : now;
  const scene = buildScene(layout, state, sourceBottleIndex, fxRef.current, renderNow);
  const { width: W, height: H } = layout;
  const aspect = W / H;

  return (
    <div className="flex size-full items-center justify-center [container-type:size]">
      <div
        className="relative"
        style={{
          width: `min(100cqw, calc(100cqh * ${aspect}))`,
          aspectRatio: `${W} / ${H}`,
        }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          style={{ willChange: "transform" }}
        >
          <RackBack p={p} layout={layout} />
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
        >
          <TubeDefs p={p} />
          <defs>
            <filter id={`${p}sblur`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {state.map((bottle, i) => {
            const lift = scene.lifts[i] ?? 0;
            if (lift > 500) return null;
            const x = tubeRestX(layout, i);
            const y = tubeRestTop(layout, i);
            const bottom = bottle[0];
            const away = Math.min(1, lift / 22);
            const glow = scene.finale !== null ? Math.sin(Math.PI * scene.finale) : 0;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: 管の位置が識別子
              <g key={`shadow${i}`}>
                <ellipse
                  cx={x + 11}
                  cy={y + BASE + 11}
                  rx={31}
                  ry={4.5}
                  fill="#4a2f16"
                  opacity={0.34 - 0.16 * away}
                  filter={`url(#${p}sblur)`}
                />
                {bottom !== undefined && (
                  <ellipse
                    cx={x + 19}
                    cy={y + BASE + 10}
                    rx={22 + 5 * glow}
                    ry={3.8}
                    fill={getLiquidColor(bottom).base}
                    opacity={0.55 - 0.25 * away + 0.3 * glow}
                    filter={`url(#${p}sblur)`}
                  />
                )}
              </g>
            );
          })}
          {scene.views.map((view, i) =>
            view ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: 管の位置が識別子
              <Tube key={`tube${i}`} p={p} id={`${p}t${i}`} view={view} />
            ) : null,
          )}
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          style={{ willChange: "transform" }}
        >
          <RackFront p={p} layout={layout} />
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
        >
          {scene.streams.map((stream) => {
            const col = getLiquidColor(stream.color);
            const h = Math.max(0, stream.bottom - stream.top);
            return (
              <g key={`stream${stream.x}`}>
                <rect
                  x={stream.x - stream.width / 2 - 0.4}
                  y={stream.top}
                  width={stream.width + 0.8}
                  height={h}
                  rx={stream.width / 2}
                  fill={col.deep}
                  opacity={0.9}
                />
                <rect
                  x={stream.x - stream.width / 2}
                  y={stream.top}
                  width={stream.width}
                  height={h}
                  rx={stream.width / 2}
                  fill={col.base}
                />
                <rect
                  x={stream.x - stream.width * 0.32}
                  y={stream.top + 2}
                  width={Math.max(0.6, stream.width * 0.25)}
                  height={Math.max(0, h - 4)}
                  rx={0.5}
                  fill="#fff"
                  opacity={0.65}
                />
              </g>
            );
          })}
          {scene.overlay.map(({ tube, view }) => (
            <Tube key={`moving${tube}`} p={p} id={`${p}m${tube}`} view={view} />
          ))}
        </svg>
        <fieldset className="absolute inset-0 m-0 border-0 p-0">
          {state.map((bottle, i) => {
            const label = `ボトル ${i + 1}`;
            const contents =
              bottle.length === 0
                ? "空"
                : bottle.map((colorIndex) => getWaterColorView(colorIndex).name).join("、");
            const x = tubeRestX(layout, i);
            const y = tubeRestTop(layout, i);
            return (
              <button
                key={label}
                type="button"
                aria-label={`${label}: ${contents}`}
                aria-pressed={i === sourceBottleIndex}
                disabled={interactionDisabled}
                onClick={() => {
                  if (!interactionDisabled) onSelectBottle(i);
                }}
                className="absolute cursor-pointer touch-manipulation rounded-[1.4rem] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                style={{
                  left: `${((x - PITCH / 2) / W) * 100}%`,
                  top: `${((y - BUTTON_TOP) / H) * 100}%`,
                  width: `${(PITCH / W) * 100}%`,
                  height: `${(Math.min(TIER - 2, H - y + BUTTON_TOP) / H) * 100}%`,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
