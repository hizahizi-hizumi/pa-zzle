// 試作 tube の盤面: 木の試験管立てに色水の試験管が並ぶ。
// 盤面の正しい中身はいつも props の state で、動きは state の変化に重ねて描く見かけだけを持つ。
// タップは試験管の置き場所（立ての穴）ごとの透明なボタンで受けるので、動きの途中でも別の試験管に当たらない。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { liquidColor } from "./colors";
import {
  apply,
  CAVITY_TOP,
  clamp01,
  easeIn,
  easeInOut,
  easeOut,
  easeOutBack,
  lerpPose,
  liftPose,
  lipAngle,
  lipLocal,
  makeRackLayout,
  type Pose,
  type RackLayout,
  restPose,
  rotateAround,
  slotOf,
  smoothstep,
  tierTop,
  uprightLevel,
} from "./geometry";
import {
  RackDefs,
  RackFloor,
  RackPosts,
  RackTierBack,
  RackTierFront,
} from "./Rack";
import {
  playClearedSound,
  playCorkSound,
  playInvalidSound,
  playMergeSound,
  playPourSound,
  prepareTubeSounds,
} from "./sounds";
import {
  EMPTY_VISUAL,
  type LiquidRun,
  type TubeVisual,
  TubeView,
} from "./TubeView";

// ---- 動きの時間（ms） ----
const SELECT_MS = 240;
const DESELECT_MS = 200;
const MOVE_MS = 320;
const POUR_BASE_MS = 260;
const POUR_PER_UNIT_MS = 120;
const BACK_TO_LIFT_MS = 260;
const DROP_MS = 150;
const FALL_MS = 70;
const SETTLE_MS = 520;
const SEAM_TAIL_MS = 460;
const CORK_DELAY_MS = 200;
const CORK_DROP_MS = 210;
const CORK_PRESS_MS = 160;
/** 注げなかった: 持っている試験管が注ぎ先へ寄りかけて、はね返される。 */
const LEAN_MS = 560;
/** 寄りかけた試験管が注ぎ先に当たる時刻（LEAN_MS の中の割合）。 */
const LEAN_CONTACT = 0.3;
const RATTLE_MS = 420;
/** 選べなかった: 少し浮きかけて、穴に落ちて鳴る。 */
const REFUSE_MS = 520;
const FINALE_DELAY_MS = 300;
const FINALE_STAGGER_MS = 70;
const FINALE_GLINT_MS = 520;

type PourAnimation = {
  id: number;
  src: number;
  dst: number;
  color: number;
  amount: number;
  srcBefore: WaterSortBottle;
  dstBefore: WaterSortBottle;
  from: Pose;
  sign: 1 | -1;
  t0: number;
  tMove: number;
  tPour: number;
  tLift: number;
  tBack: number;
  end: number;
  merging: boolean;
  corkAt: number | null;
  clearing: boolean;
  fired: Set<string>;
};

type PoseTween = {
  from: Pose;
  t0: number;
  duration: number;
  lifted: boolean;
};

type Shake =
  | { kind: "lean"; t0: number; end: number; dx: number; dy: number }
  | { kind: "rattle"; t0: number; end: number }
  | { kind: "refuse"; t0: number; end: number };

type Finale = { t0: number; end: number; completed: boolean };

type Model = {
  pours: PourAnimation[];
  tweens: Map<number, PoseTween>;
  shakes: Map<number, Shake>;
  finale: Finale | null;
  lastPose: Map<number, Pose>;
  selected: number | null;
};

function now() {
  return performance.now();
}

function mergeRuns(colors: readonly number[], extra?: LiquidRun): LiquidRun[] {
  const runs: LiquidRun[] = [];
  const push = (color: number, amount: number) => {
    const last = runs[runs.length - 1];
    if (last && last.color === color) last.amount += amount;
    else runs.push({ color, amount });
  };
  for (const color of colors) push(color, 1);
  if (extra && extra.amount > 0) push(extra.color, extra.amount);
  return runs;
}

function removeTop(colors: readonly number[], amount: number): LiquidRun[] {
  const runs = mergeRuns(colors);
  let rest = amount;
  while (rest > 0 && runs.length > 0) {
    const top = runs[runs.length - 1];
    if (!top) break;
    const take = Math.min(top.amount, rest);
    top.amount -= take;
    rest -= take;
    if (top.amount <= 1e-6) runs.pop();
  }
  return runs;
}

export function TubeBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [time, setTime] = useState(0);
  const modelRef = useRef<Model>({
    pours: [],
    tweens: new Map(),
    shakes: new Map(),
    finale: null,
    lastPose: new Map(),
    selected: sourceBottleIndex,
  });
  const layoutRef = useRef<RackLayout | null>(null);
  const frameRef = useRef(0);
  const activeRef = useRef(false);
  const callbacksRef = useRef({
    onPourAnimationActivityChange,
    onClearAnimationComplete,
  });
  callbacksRef.current = {
    onPourAnimationActivityChange,
    onClearAnimationComplete,
  };

  useEffect(() => {
    prepareTubeSounds();
  }, []);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) =>
        current &&
        Math.abs(current.w - rect.width) < 0.5 &&
        Math.abs(current.h - rect.height) < 0.5
          ? current
          : { w: rect.width, h: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = size ? makeRackLayout(state.length, size.w, size.h) : null;
  layoutRef.current = layout;

  // ---- 時間を進める ----
  const isBusy = useCallback((t: number) => {
    const model = modelRef.current;
    if (model.pours.length > 0 || model.finale) return true;
    for (const shake of model.shakes.values()) {
      if (t < shake.end) return true;
    }
    for (const tween of model.tweens.values()) {
      if (t < tween.t0 + tween.duration) return true;
    }
    return false;
  }, []);

  const advance = useCallback((t: number) => {
    const model = modelRef.current;
    for (const pour of model.pours) {
      fire(pour, "pour", t >= pour.tMove, () =>
        playPourSound(pour.tPour - pour.tMove),
      );
      if (pour.merging) {
        fire(pour, "merge", t >= seamVanishAt(pour), playMergeSound);
      }
      if (pour.corkAt !== null) {
        const seated = t >= pour.corkAt + CORK_DROP_MS;
        fire(pour, "cork", seated, playCorkSound);
        if (pour.clearing) fire(pour, "cleared", seated, playClearedSound);
      }
    }
    model.pours = model.pours.filter((pour) => t < pour.end);
    for (const [bottle, shake] of model.shakes) {
      if (t >= shake.end) model.shakes.delete(bottle);
    }
    const finale = model.finale;
    if (finale && !finale.completed && t >= finale.t0) {
      if (!finale.completed && t >= finale.end) {
        finale.completed = true;
        model.finale = null;
        callbacksRef.current.onClearAnimationComplete?.();
      }
    }
    const active = model.pours.length > 0 || model.finale !== null;
    if (active !== activeRef.current) {
      activeRef.current = active;
      callbacksRef.current.onPourAnimationActivityChange?.(active);
    }
  }, []);

  const tick = useCallback(() => {
    const t = now();
    advance(t);
    setTime(t);
    frameRef.current = isBusy(t) ? requestAnimationFrame(tick) : 0;
  }, [advance, isBusy]);

  const wake = useCallback(() => {
    const t = now();
    advance(t);
    setTime(t);
    if (!frameRef.current) frameRef.current = requestAnimationFrame(tick);
  }, [advance, tick]);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const tweenFromCurrent = useCallback(
    (bottle: number, lifted: boolean, duration: number) => {
      const model = modelRef.current;
      const currentLayout = layoutRef.current;
      if (!currentLayout) return;
      const from =
        model.lastPose.get(bottle) ?? restPose(currentLayout, bottle);
      model.tweens.set(bottle, { from, t0: now(), duration, lifted });
    },
    [],
  );

  const dropPoursTouching = useCallback(
    (bottles: readonly number[]) => {
      const model = modelRef.current;
      const removed = model.pours.filter(
        (pour) => bottles.includes(pour.src) || bottles.includes(pour.dst),
      );
      if (removed.length === 0) return;
      model.pours = model.pours.filter((pour) => !removed.includes(pour));
      for (const pour of removed) {
        if (pour.clearing) model.finale = null;
        tweenFromCurrent(pour.src, model.selected === pour.src, DESELECT_MS);
      }
    },
    [tweenFromCurrent],
  );

  // ---- 選ぶ・外す ----
  useLayoutEffect(() => {
    const model = modelRef.current;
    const previous = model.selected;
    if (previous === sourceBottleIndex) return;
    model.selected = sourceBottleIndex;
    if (previous !== null && previous < state.length) {
      tweenFromCurrent(previous, false, DESELECT_MS);
    }
    if (sourceBottleIndex !== null) {
      tweenFromCurrent(sourceBottleIndex, true, SELECT_MS);
    }
    wake();
  }, [sourceBottleIndex, state.length, tweenFromCurrent, wake]);

  // ---- 操作の知らせ ----
  const handledOperationRef = useRef<WaterSortOperation | null>(null);
  useLayoutEffect(() => {
    if (handledOperationRef.current === operation) return;
    handledOperationRef.current = operation;
    const model = modelRef.current;
    const currentLayout = layoutRef.current;
    if (!operation) {
      // 待った・盤面を戻す・リセット: 動きを捨て、今の盤面へ。
      for (const pour of model.pours) {
        tweenFromCurrent(pour.src, false, DESELECT_MS);
      }
      model.pours = [];
      model.finale = null;
      model.shakes.clear();
      wake();
      return;
    }
    if (operation.type === "invalid") {
      const t0 = now();
      const target = operation.bottleIndex;
      const held = model.selected;
      if (held !== null && held !== target && currentLayout) {
        const from = slotOf(currentLayout, held);
        const to = slotOf(currentLayout, target);
        model.shakes.set(held, {
          kind: "lean",
          t0,
          end: t0 + LEAN_MS,
          dx: to.x - from.x,
          dy: to.y - from.y,
        });
        const contact = t0 + LEAN_MS * LEAN_CONTACT;
        model.shakes.set(target, {
          kind: "rattle",
          t0: contact,
          end: contact + RATTLE_MS,
        });
        playInvalidSound(LEAN_MS * LEAN_CONTACT);
      } else {
        model.shakes.set(target, { kind: "refuse", t0, end: t0 + REFUSE_MS });
        playInvalidSound(REFUSE_MS * 0.42);
      }
      wake();
      return;
    }
    if (operation.type !== "poured" || !currentLayout) return;

    const src = operation.sourceBottleIndex;
    const dst = operation.destinationBottleIndex;
    dropPoursTouching([src, dst]);
    model.shakes.delete(src);
    model.shakes.delete(dst);

    const srcBefore = operation.stateBefore[src] ?? [];
    const dstBefore = operation.stateBefore[dst] ?? [];
    const dstAfter = operation.stateAfter[dst] ?? [];
    const color = srcBefore[srcBefore.length - 1] ?? 0;
    const amount = dstAfter.length - dstBefore.length;
    const t0 = now();
    const pourMs = POUR_BASE_MS + POUR_PER_UNIT_MS * amount;
    const tMove = t0 + MOVE_MS;
    const tPour = tMove + pourMs;
    const tLift = tPour + BACK_TO_LIFT_MS;
    const tBack = tLift + DROP_MS;
    const completes = isCompleteWaterSortBottle(dstAfter);
    const corkAt = completes ? tPour + FALL_MS + CORK_DELAY_MS : null;
    const corkSeat = corkAt === null ? 0 : corkAt + CORK_DROP_MS;
    const merging = dstBefore.length > 0;
    const end = Math.max(
      tBack,
      tPour + FALL_MS + SETTLE_MS,
      merging ? tMove + FALL_MS + pourMs + SEAM_TAIL_MS + 200 : 0,
      corkAt === null ? 0 : corkSeat + CORK_PRESS_MS + 520,
    );

    const destination = slotOf(currentLayout, dst);
    const source = slotOf(currentLayout, src);
    const half = (currentLayout.columns - 1) / 2;
    let sign: 1 | -1;
    if (destination.column < half) sign = -1;
    else if (destination.column > half) sign = 1;
    else sign = source.column <= destination.column ? 1 : -1;

    const pour: PourAnimation = {
      id: operation.id,
      src,
      dst,
      color,
      amount,
      srcBefore,
      dstBefore,
      from: model.lastPose.get(src) ?? liftPose(currentLayout, src),
      sign,
      t0,
      tMove,
      tPour,
      tLift,
      tBack,
      end,
      merging,
      corkAt,
      clearing: operation.isClearingMove,
      fired: new Set(),
    };
    model.pours.push(pour);
    model.tweens.set(src, {
      from: restPose(currentLayout, src),
      t0: 0,
      duration: 1,
      lifted: false,
    });
    if (operation.isClearingMove) {
      const finaleStart = corkSeat + FINALE_DELAY_MS;
      model.finale = {
        t0: finaleStart,
        end:
          finaleStart +
          FINALE_STAGGER_MS * operation.stateAfter.length +
          FINALE_GLINT_MS,
        completed: false,
      };
    }
    wake();
  }, [operation, dropPoursTouching, tweenFromCurrent, wake]);

  function selectBottle(bottleIndex: number) {
    if (interactionDisabled) return;
    if (sourceBottleIndex === null) dropPoursTouching([bottleIndex]);
    onSelectBottle(bottleIndex);
  }

  // ---- 描く ----
  const model = modelRef.current;
  const t = time;

  const poses: Pose[] = [];
  const visuals: TubeVisual[] = [];
  const inOverlay: boolean[] = [];
  const streams: {
    x: number;
    top: number;
    bottom: number;
    width: number;
    color: number;
    lip: [number, number];
    lipOn: boolean;
  }[] = [];

  if (layout) {
    for (let i = 0; i < state.length; i++) {
      const bottle = state[i] ?? [];
      const complete = isCompleteWaterSortBottle(bottle);
      visuals[i] = {
        ...EMPTY_VISUAL,
        runs: mergeRuns(bottle),
        done: complete ? 1 : 0,
        cork: complete ? { drop: 0, opacity: 1, press: 0 } : null,
      };
      inOverlay[i] = false;
      const tween = model.tweens.get(i);
      const target = tween?.lifted ? liftPose(layout, i) : restPose(layout, i);
      let pose = target;
      if (tween && t < tween.t0 + tween.duration) {
        const u = clamp01((t - tween.t0) / tween.duration);
        pose = lerpPose(
          tween.from,
          target,
          tween.lifted ? easeOutBack(u, 1.4) : easeInOut(u),
        );
      }
      poses[i] = pose;
    }

    for (const pour of model.pours) {
      applyPour(pour, t, layout, poses, visuals, inOverlay, streams);
    }

    if (model.finale) {
      const finale = model.finale;
      state.forEach((bottle, i) => {
        if (!isCompleteWaterSortBottle(bottle)) return;
        const u =
          (t - finale.t0 - FINALE_STAGGER_MS * i) / FINALE_GLINT_MS;
        const visual = visuals[i];
        if (visual && u > 0 && u < 1) {
          visual.glint = u;
          const hop = Math.sin(Math.PI * clamp01(u * 2.2));
          if (visual.cork) visual.cork = { ...visual.cork, drop: hop * 9 };
        }
      });
    }

    for (const [bottle, shake] of model.shakes) {
      const pose = poses[bottle];
      if (!pose) continue;
      poses[bottle] = shakenPose(pose, shake, t);
    }

    poses.forEach((pose, i) => {
      model.lastPose.set(i, pose);
    });
  }

  const tierIndices = layout
    ? Array.from({ length: layout.tiers }, (_, tier) => tier)
    : [];
  const viewBox = layout ? `0 0 ${layout.width} ${layout.height}` : "";
  const layerStyle = {
    position: "absolute",
    inset: 0,
    overflow: "visible",
    pointerEvents: "none",
  } as const;

  return (
    <div
      ref={containerRef}
      className="relative flex size-full items-center justify-center"
    >
      <RackDefs />
      {layout && (
        <div
          className="relative"
          style={{
            width: layout.width * layout.scale,
            height: layout.height * layout.scale,
          }}
        >
          {/* 実験台は画面の下の操作の後ろまで続くので、操作より奥に描く。 */}
          <svg
            viewBox={viewBox}
            style={{ ...layerStyle, zIndex: -5 }}
            aria-hidden="true"
          >
            <RackFloor layout={layout} />
          </svg>
          {tierIndices.map((tier) => (
            <TierLayers
              key={tier}
              tier={tier}
              layout={layout}
              viewBox={viewBox}
              layerStyle={layerStyle}
              poses={poses}
              visuals={visuals}
              inOverlay={inOverlay}
            />
          ))}
          <svg viewBox={viewBox} style={layerStyle} aria-hidden="true">
            <RackPosts layout={layout} />
          </svg>
          <svg viewBox={viewBox} style={layerStyle} aria-hidden="true">
            {streams.map((stream, index) => {
              const color = liquidColor(stream.color);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: 流れは注ぎごとに1本
                <g key={index}>
                  {stream.bottom > stream.top && (
                    <>
                      <rect
                        x={stream.x - stream.width / 2 - 0.4}
                        y={stream.top}
                        width={stream.width + 0.8}
                        height={stream.bottom - stream.top}
                        rx={stream.width / 2}
                        fill={color.deep}
                        opacity={0.85}
                      />
                      <rect
                        x={stream.x - stream.width / 2}
                        y={stream.top}
                        width={stream.width}
                        height={stream.bottom - stream.top}
                        rx={stream.width / 2}
                        fill={color.light}
                      />
                      <rect
                        x={stream.x - stream.width / 2 + 0.3}
                        y={stream.top}
                        width={Math.max(0.6, stream.width * 0.28)}
                        height={stream.bottom - stream.top}
                        fill="#fff"
                        opacity={0.6}
                      />
                    </>
                  )}
                </g>
              );
            })}
            {poses.map((pose, i) =>
              inOverlay[i] ? (
                <TubeView
                  // biome-ignore lint/suspicious/noArrayIndexKey: ボトルの番号で並ぶ
                  key={i}
                  id={`o${i}`}
                  pose={pose}
                  visual={visuals[i] ?? EMPTY_VISUAL}
                />
              ) : null,
            )}
            {streams.map((stream, index) =>
              stream.lipOn ? (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: 流れは注ぎごとに1本
                  key={`lip${index}`}
                  cx={stream.lip[0]}
                  cy={stream.lip[1]}
                  r={stream.width * 0.62}
                  fill={liquidColor(stream.color).light}
                />
              ) : null,
            )}
          </svg>
          {state.map((bottle, bottleIndex) => {
            const slot = slotOf(layout, bottleIndex);
            const label = `ボトル ${bottleIndex + 1}`;
            const contents =
              bottle.length === 0
                ? "空"
                : bottle
                    .map((colorIndex) => getWaterColorView(colorIndex).name)
                    .join("、");
            const left = slot.x - layout.pitch / 2;
            const top = slot.y - 14;
            const height = 230;
            return (
              <button
                key={label}
                type="button"
                aria-label={`${label}: ${contents}`}
                aria-pressed={bottleIndex === sourceBottleIndex}
                disabled={interactionDisabled}
                onClick={() => selectBottle(bottleIndex)}
                className="absolute cursor-pointer touch-manipulation rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a5a2b]/70"
                style={{
                  left: `${(left / layout.width) * 100}%`,
                  top: `${(top / layout.height) * 100}%`,
                  width: `${(layout.pitch / layout.width) * 100}%`,
                  height: `${(height / layout.height) * 100}%`,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

type TierLayersProps = {
  tier: number;
  layout: RackLayout;
  viewBox: string;
  layerStyle: React.CSSProperties;
  poses: readonly Pose[];
  visuals: readonly TubeVisual[];
  inOverlay: readonly boolean[];
};

function TierLayers({
  tier,
  layout,
  viewBox,
  layerStyle,
  poses,
  visuals,
  inOverlay,
}: TierLayersProps) {
  const indices: number[] = [];
  for (let i = tier * layout.columns; i < (tier + 1) * layout.columns; i++) {
    if (i < poses.length) indices.push(i);
  }
  const y = tierTop(tier);
  return (
    <>
      <svg viewBox={viewBox} style={layerStyle} aria-hidden="true">
        <RackTierBack layout={layout} tier={tier} />
      </svg>
      <svg viewBox={viewBox} style={layerStyle} aria-hidden="true">
        {indices.map((i) => {
          const pose = poses[i];
          const visual = visuals[i];
          if (!pose || !visual) return null;
          const rest = restPose(layout, i);
          const away = Math.hypot(pose.x - rest.x, pose.y - rest.y);
          const presence = clamp01(1 - away / 70);
          const bottom = visual.runs[0];
          return (
            <g key={`sh${i}`}>
              <ellipse
                cx={rest.x + 11}
                cy={y + 198}
                rx={26}
                ry={4.5}
                fill="#5a3a1c"
                opacity={0.32 * presence}
                filter="url(#tb-blur3)"
              />
              {bottom && (
                <ellipse
                  cx={rest.x + 18}
                  cy={y + 197}
                  rx={17}
                  ry={3.6}
                  fill={liquidColor(bottom.color).light}
                  opacity={0.5 * presence}
                  filter="url(#tb-blur3)"
                />
              )}
            </g>
          );
        })}
        {indices.map((i) => {
          const pose = poses[i];
          if (!pose || inOverlay[i]) return null;
          return (
            <TubeView
              key={i}
              id={`t${i}`}
              pose={pose}
              visual={visuals[i] ?? EMPTY_VISUAL}
            />
          );
        })}
      </svg>
      <svg viewBox={viewBox} style={layerStyle} aria-hidden="true">
        <RackTierFront layout={layout} tier={tier} />
      </svg>
    </>
  );
}

function fire(
  pour: PourAnimation,
  key: string,
  condition: boolean,
  action: () => void,
) {
  if (!condition || pour.fired.has(key)) return;
  pour.fired.add(key);
  action();
}

function pourDuration(pour: PourAnimation) {
  return pour.tPour - pour.tMove;
}

function seamProgress(pour: PourAnimation, t: number) {
  return (t - pour.tMove - FALL_MS) / (pourDuration(pour) + SEAM_TAIL_MS);
}

function seamVanishAt(pour: PourAnimation) {
  return pour.tMove + FALL_MS + (pourDuration(pour) + SEAM_TAIL_MS) * 0.82;
}

function lipTarget(
  layout: RackLayout,
  pour: PourAnimation,
): [number, number] {
  const destination = slotOf(layout, pour.dst);
  return [destination.x + 5 * pour.sign, destination.y - 26];
}

function pourPose(
  layout: RackLayout,
  pour: PourAnimation,
  units: number,
): Pose {
  const a = pour.sign * lipAngle(Math.max(0.05, units));
  const [lx, ly] = lipTarget(layout, pour);
  const [px, py] = lipLocal(pour.sign);
  const offset = apply({ x: 0, y: 0, a }, px, py);
  return { x: lx - offset[0], y: ly - offset[1], a };
}

function applyPour(
  pour: PourAnimation,
  t: number,
  layout: RackLayout,
  poses: Pose[],
  visuals: TubeVisual[],
  inOverlay: boolean[],
  streams: {
    x: number;
    top: number;
    bottom: number;
    width: number;
    color: number;
    lip: [number, number];
    lipOn: boolean;
  }[],
) {
  const pourMs = pourDuration(pour);
  const srcUnits = pour.srcBefore.length;
  const fSrc = clamp01((t - pour.tMove) / pourMs);
  const fDst = clamp01((t - pour.tMove - FALL_MS) / pourMs);
  const destination = slotOf(layout, pour.dst);

  // 注ぎ元
  if (t < pour.tBack) {
    let pose: Pose;
    const startPose = pourPose(layout, pour, srcUnits);
    const endPose = pourPose(layout, pour, srcUnits - pour.amount);
    if (t < pour.tMove) {
      const u = easeInOut(clamp01((t - pour.t0) / (pour.tMove - pour.t0)));
      pose = lerpPose(pour.from, startPose, u);
    } else if (t < pour.tPour) {
      pose = pourPose(layout, pour, srcUnits - pour.amount * easeInOutSoft(fSrc));
    } else if (t < pour.tLift) {
      const u = easeInOut(clamp01((t - pour.tPour) / (pour.tLift - pour.tPour)));
      pose = lerpPose(endPose, liftPose(layout, pour.src), u);
    } else {
      const u = easeIn(clamp01((t - pour.tLift) / (pour.tBack - pour.tLift)));
      pose = lerpPose(liftPose(layout, pour.src), restPose(layout, pour.src), u);
    }
    poses[pour.src] = pose;
    inOverlay[pour.src] = t < pour.tLift;
    const visual = visuals[pour.src];
    if (visual && t < pour.tPour) {
      visuals[pour.src] = {
        ...visual,
        runs: removeTop(pour.srcBefore, pour.amount * easeInOutSoft(fSrc)),
        done: 0,
        cork: null,
      };
    }
  }

  // 注ぎ先
  const visual = visuals[pour.dst];
  if (!visual) return;
  const dstUnits = pour.dstBefore.length + pour.amount * easeInOutSoft(fDst);
  const surfaceWorld = destination.y + uprightLevel(dstUnits);
  const next: TubeVisual = { ...visual };
  if (t < pour.tPour + FALL_MS) {
    next.runs = mergeRuns(pour.dstBefore, {
      color: pour.color,
      amount: pour.amount * easeInOutSoft(fDst),
    });
  }

  // 流れ: 先が口の縁から落ち、注ぎ終えると後ろが離れて落ちる。
  const [lx, ly] = lipTarget(layout, pour);
  const streamX = lx + 1.5 * pour.sign;
  const head = ly + clamp01((t - pour.tMove) / FALL_MS) * (surfaceWorld - ly);
  const tail = ly + clamp01((t - pour.tPour) / FALL_MS) * (surfaceWorld - ly);
  const streaming = t >= pour.tMove && tail < surfaceWorld - 0.5;
  const width = 3.6 - 1.2 * fSrc;
  const mouthY = destination.y + CAVITY_TOP + 2;
  if (streaming) {
    streams.push({
      x: streamX,
      top: tail,
      bottom: Math.min(head, mouthY),
      width,
      color: pour.color,
      lip: [lx, ly],
      lipOn: t < pour.tPour,
    });
    if (head > mouthY) {
      next.innerStream = {
        x: streamX - destination.x,
        width,
        color: pour.color,
        top: Math.max(CAVITY_TOP, tail - destination.y),
      };
      next.splash = 0.6 + 0.4 * Math.sin(t * 0.035);
    }
  }

  // 液面の波: 落ちている間はさざめき、注ぎ終えると静まる。
  const landed = t - pour.tMove - FALL_MS;
  if (landed > 0) {
    const calm = clamp01((t - pour.tPour - FALL_MS) / SETTLE_MS);
    next.surfaceWave = 1.5 * (1 - easeOut(calm)) * clamp01(landed / 80);
    next.wavePhase = t * 0.02;
  }

  // 同じ色の上: 前の液面の線が揺れて消える。
  if (pour.merging) {
    const p = seamProgress(pour, t);
    if (p < 1) {
      const swell = Math.sin(Math.PI * clamp01(p * 1.15));
      next.seam = {
        level: pour.dstBefore.length,
        amp: 2.8 * swell,
        opacity: p < 0 ? 1 : 1 - smoothstep((p - 0.35) / 0.5),
        phase: t * 0.016,
      };
    }
    const glow = Math.sin(Math.PI * clamp01((p - 0.6) / 0.55));
    if (glow > 0) {
      next.mergeGlow = { level: pour.dstBefore.length, strength: glow };
    }
    const seamY = uprightLevel(pour.dstBefore.length);
    const surfaceY = uprightLevel(dstUnits);
    const bubbles: { x: number; y: number; r: number; o: number }[] = [];
    for (let b = 0; b < 6; b++) {
      const q = (p - 0.42 - b * 0.07) / 0.5;
      if (q <= 0 || q >= 1) continue;
      bubbles.push({
        x: Math.sin(b * 2.3) * 12 + Math.sin(q * 7 + b) * 1.6,
        y: seamY - q * (seamY - surfaceY - 2),
        r: 1 + (b % 3) * 0.55,
        o: Math.sin(Math.PI * q),
      });
    }
    next.bubbles = bubbles;
  }

  // 1色で満ちた: コルク栓が落ちてはまる。
  if (pour.corkAt !== null) {
    const seat = pour.corkAt + CORK_DROP_MS;
    if (t < pour.corkAt) {
      next.cork = null;
      next.done = 0;
    } else if (t < seat) {
      const u = clamp01((t - pour.corkAt) / CORK_DROP_MS);
      next.cork = {
        drop: 70 * (1 - easeIn(u)),
        opacity: clamp01(u * 4),
        press: 0,
      };
      next.done = 0;
    } else {
      const u = clamp01((t - seat) / CORK_PRESS_MS);
      const press = 3.2 * Math.sin(Math.PI * u) * (1 - u * 0.4);
      next.cork = { drop: 0, opacity: 1, press };
      next.done = clamp01((t - seat) / 320);
      const g = (t - seat - 40) / 480;
      if (g > 0 && g < 1) next.glint = g;
      const burst = (t - seat) / 380;
      if (burst < 1) next.corkBurst = burst;
      const pose = poses[pour.dst];
      if (pose) poses[pour.dst] = { ...pose, y: pose.y + press * 0.35 };
    }
  }

  visuals[pour.dst] = next;
}

function easeInOutSoft(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** 通らなかった操作の揺れを、今のポーズに重ねる。 */
function shakenPose(pose: Pose, shake: Shake, t: number): Pose {
  const u = clamp01((t - shake.t0) / (shake.end - shake.t0));
  if (t < shake.t0) return pose;
  if (shake.kind === "rattle") {
    // 当たられて穴の中で鳴る: 跳ねて、左右に小刻みに揺れて止まる。
    const angle = 4.6 * Math.sin(u * Math.PI * 6) * (1 - u) ** 1.4;
    const bump = -4 * Math.sin(Math.PI * clamp01(u * 4)) * (u < 0.25 ? 1 : 0);
    return rotateAround({ ...pose, y: pose.y + bump }, angle, 25);
  }
  if (shake.kind === "refuse") {
    // 持ち上がりかけて、すぐ穴に落ちて揺れる。
    const rise = u < 0.42 ? Math.sin((Math.PI * u) / 0.42) : 0;
    const v = clamp01((u - 0.42) / 0.58);
    const angle = u < 0.42 ? 0 : 4 * Math.sin(v * Math.PI * 5) * (1 - v) ** 1.4;
    return rotateAround({ ...pose, y: pose.y - 14 * rise }, angle, 25);
  }
  // 注ぎ先へ寄りかけて当たり、はね返されて元の高さで揺れが収まる。
  const side = shake.dx === 0 ? 1 : Math.sign(shake.dx);
  const reach = Math.min(30, Math.abs(shake.dx) * 0.3 + 10);
  const out = u < LEAN_CONTACT ? easeOut(u / LEAN_CONTACT) : 0;
  const v = clamp01((u - LEAN_CONTACT) / (1 - LEAN_CONTACT));
  const back = u < LEAN_CONTACT ? 0 : (1 - easeOut(v)) * Math.cos(v * Math.PI * 2.5);
  const k = out + back * 0.9;
  const lift = Math.max(-10, Math.min(10, shake.dy * 0.05));
  const leaned = {
    x: pose.x + side * reach * k,
    y: pose.y + lift * k - 4 * Math.abs(k),
    a: pose.a,
  };
  return rotateAround(leaned, side * 11 * k, 150);
}
