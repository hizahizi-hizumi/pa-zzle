// 試作 bench の盤面: 理科室の実験台に据えた木の試験管立て。
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  isWaterSortCleared,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import {
  BenchDefs,
  glowFill,
} from "@/games/water-sort/ui/prototypes/bench/BenchDefs";
import {
  type BenchLayout,
  computeBenchLayout,
  type Pose,
  poseToWorld,
  poseTransform,
} from "@/games/water-sort/ui/prototypes/bench/geometry";
import {
  type BenchEvent,
  type BumpEvent,
  bumpPose,
  CLEAR_MS,
  CORK_DELAY_MS,
  type CorkEvent,
  corkFrame,
  eventDuration,
  eventInvolves,
  type LiftEvent,
  liftedPose,
  liftPose,
  POUR_MS,
  type PourEvent,
  type PourFrame,
  pourFrame,
  pourLip,
  type RattleEvent,
  rattleOffset,
  restPose,
  toSegments,
} from "@/games/water-sort/ui/prototypes/bench/motion";
import { RackTier } from "@/games/water-sort/ui/prototypes/bench/RackTier";
import { updateBenchScene } from "@/games/water-sort/ui/prototypes/bench/scene-store";
import { TiltedTube } from "@/games/water-sort/ui/prototypes/bench/TiltedTube";
import {
  type LiquidSegment,
  TubeArt,
  type TubeArtProps,
} from "@/games/water-sort/ui/prototypes/bench/TubeArt";
import { liquidPaint } from "@/games/water-sort/ui/prototypes/bench/paint";

type TubeView = {
  index: number;
  pose: Pose;
  art: TubeArtProps;
  /** 傾けて持っているときの液（水平な液面で描く）。 */
  tiltedSegments: LiquidSegment[] | null;
  baseColor: number | null;
  inRack: boolean;
};

type CausticView = {
  index: number;
  x: number;
  row: number;
  color: number;
  strength: number;
};

const CLEAR_HOP_MS = 300;

/** 完成の光の帯が x を通る時刻（完成の演出の中の 0〜1）。 */
function sweepReachTime(layout: BenchLayout, x: number) {
  const k = layout.k;
  const from = layout.rackLeft - 60 * k;
  const span = layout.rackWidthUnits * k + 120 * k;
  return 0.04 + 0.56 * ((x - from) / span);
}

type StreamView = {
  key: string;
  from: [number, number];
  toY: number;
  x: number;
  width: number;
  color: number;
};

function lastOf<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

export function BenchBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [events, setEvents] = useState<readonly BenchEvent[]>([]);
  const eventsRef = useRef<readonly BenchEvent[]>([]);
  const [now, setNow] = useState(() => performance.now());
  const processedOperationId = useRef<number | null>(null);
  const clearNotified = useRef(false);

  const layout = useMemo(
    () => (size ? computeBenchLayout(state.length, size.w, size.h) : null),
    [size, state.length],
  );

  const replaceEvents = useCallback((next: readonly BenchEvent[]) => {
    eventsRef.current = next;
    setEvents(next);
  }, []);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize((current) =>
        current &&
        Math.abs(current.w - rect.width) < 0.5 &&
        Math.abs(current.h - rect.height) < 0.5
          ? current
          : { w: rect.width, h: rect.height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 地（台と光）に、立ての置き場所を知らせる。
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element || !layout) return;
    const rect = element.getBoundingClientRect();
    updateBenchScene({
      horizonY: rect.top + layout.rackBottom - (48 * layout.k + 22),
      windowBottomY: rect.top + layout.rackTop + 193 * layout.k,
      rackLeft: rect.left + layout.rackLeft,
      rackRight: rect.left + layout.rackLeft + layout.rackWidthUnits * layout.k,
      rackBottom: rect.top + layout.rackBottom,
    });
  }, [layout]);

  // 出来事が残っている間だけ時計を進める。
  const animating = events.length > 0;
  useEffect(() => {
    if (!animating) return;
    let frame = requestAnimationFrame(function tick() {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [animating]);

  // 終わった出来事を片付け、完成の演出の終わりを知らせる。
  useEffect(() => {
    const current = eventsRef.current;
    const finished = current.filter(
      (event) => now >= event.start + eventDuration(event),
    );
    if (finished.length === 0) return;
    replaceEvents(current.filter((event) => !finished.includes(event)));
    if (
      finished.some((event) => event.kind === "clear") &&
      !clearNotified.current
    ) {
      clearNotified.current = true;
      onClearAnimationComplete?.();
    }
  }, [now, onClearAnimationComplete, replaceEvents]);

  const hasPour = events.some((event) => event.kind === "pour");
  useEffect(() => {
    onPourAnimationActivityChange?.(hasPour);
  }, [hasPour, onPourAnimationActivityChange]);

  const computePose = useCallback(
    (index: number, at: number): Pose | null => {
      if (!layout) return null;
      for (const event of eventsRef.current) {
        if (event.start > at) continue;
        if (event.kind === "pour" && event.source === index) {
          return pourFrame(layout, event, at).sourcePose;
        }
        if (event.kind === "bump" && event.source === index) {
          return bumpPose(layout, event, at).pose;
        }
        if (event.kind === "lift" && event.bottle === index) {
          return liftPose(layout, event, at);
        }
      }
      return null;
    },
    [layout],
  );

  // 遊びの知らせを、盤面の出来事に変える。
  useLayoutEffect(() => {
    if (!operation) {
      processedOperationId.current = null;
      clearNotified.current = false;
      replaceEvents([]);
      return;
    }
    if (processedOperationId.current === operation.id || !layout) return;
    processedOperationId.current = operation.id;
    const at = performance.now();
    const current = eventsRef.current;

    switch (operation.type) {
      case "source-selected": {
        const lift: LiftEvent = {
          kind: "lift",
          start: at,
          bottle: operation.bottleIndex,
          up: true,
        };
        replaceEvents([
          ...current.filter(
            (event) => !eventInvolves(event, operation.bottleIndex),
          ),
          lift,
        ]);
        return;
      }
      case "source-deselected": {
        const drop: LiftEvent = {
          kind: "lift",
          start: at,
          bottle: operation.bottleIndex,
          up: false,
        };
        replaceEvents([
          ...current.filter(
            (event) =>
              !(
                (event.kind === "lift" || event.kind === "bump") &&
                eventInvolves(event, operation.bottleIndex)
              ),
          ),
          drop,
        ]);
        return;
      }
      case "invalid": {
        const source = sourceBottleIndex;
        if (source !== null && source !== operation.bottleIndex) {
          const startPose =
            computePose(source, at) ?? liftedPose(layout, source);
          const destSlot = layout.slots[operation.bottleIndex];
          const bump: BumpEvent = {
            kind: "bump",
            start: at,
            source,
            dest: operation.bottleIndex,
            dir: (destSlot?.x ?? 0) >= layout.width / 2 ? 1 : -1,
            startPose,
          };
          replaceEvents([
            ...current.filter(
              (event) =>
                !(event.kind === "bump" && event.source === source) &&
                !(event.kind === "lift" && event.bottle === source),
            ),
            bump,
          ]);
        } else {
          const rattle: RattleEvent = {
            kind: "rattle",
            start: at,
            bottle: operation.bottleIndex,
          };
          replaceEvents([
            ...current.filter(
              (event) =>
                !(
                  event.kind === "rattle" &&
                  event.bottle === operation.bottleIndex
                ),
            ),
            rattle,
          ]);
        }
        return;
      }
      case "poured": {
        const { sourceBottleIndex: source, destinationBottleIndex: dest } =
          operation;
        const sourceBefore = operation.stateBefore[source] ?? [];
        const sourceAfter = operation.stateAfter[source] ?? [];
        const destBefore = operation.stateBefore[dest] ?? [];
        const destAfter = operation.stateAfter[dest] ?? [];
        const color = lastOf(sourceBefore);
        if (color === undefined) return;
        const startPose =
          computePose(source, at) ?? liftedPose(layout, source);
        const destSlot = layout.slots[dest];
        const pour: PourEvent = {
          kind: "pour",
          id: operation.id,
          start: at,
          source,
          dest,
          sourceBefore,
          sourceAfter,
          destBefore,
          color,
          amount: sourceBefore.length - sourceAfter.length,
          dir: (destSlot?.x ?? 0) >= layout.width / 2 ? 1 : -1,
          startPose,
        };
        const added: BenchEvent[] = [pour];
        if (isCompleteWaterSortBottle(destAfter)) {
          const cork: CorkEvent = {
            kind: "cork",
            start: at + CORK_DELAY_MS,
            bottle: dest,
          };
          added.push(cork);
        }
        if (operation.isClearingMove) {
          added.push({ kind: "clear", start: at + POUR_MS + 260 });
        }
        replaceEvents([
          ...current.filter(
            (event) =>
              !eventInvolves(event, source) && !eventInvolves(event, dest),
          ),
          ...added,
        ]);
        setNow(at);
        return;
      }
    }
  }, [computePose, layout, operation, replaceEvents, sourceBottleIndex]);

  function selectBottle(index: number) {
    if (interactionDisabled) return;
    if (sourceBottleIndex === null) {
      // 動いている途中の試験管に触れたら、その動きを終えた姿にしてから選ぶ。
      const current = eventsRef.current;
      if (current.some((event) => eventInvolves(event, index))) {
        replaceEvents(
          current.filter(
            (event) =>
              !(
                eventInvolves(event, index) &&
                (event.kind === "pour" ||
                  event.kind === "rattle" ||
                  event.kind === "cork")
              ),
          ),
        );
      }
    }
    onSelectBottle(index);
  }

  const deadlockStatus = useMemo(() => classifyWaterSortDeadlock(state), [state]);
  const dimmed = deadlockStatus === "deadlocked" && !hasPour;
  const clearEvent = events.find((event) => event.kind === "clear");
  const cleared =
    isWaterSortCleared(state) &&
    (clearEvent ? now >= clearEvent.start : !hasPour);
  useEffect(() => {
    updateBenchScene({ dimmed, cleared });
  }, [dimmed, cleared]);
  useEffect(() => () => updateBenchScene({ dimmed: false, cleared: false }), []);

  const views = layout
    ? buildViews(layout, state, events, now, sourceBottleIndex)
    : null;

  return (
    <div
      ref={rootRef}
      className="relative -mx-3 -my-2 w-[calc(100%+1.5rem)] shrink-0 self-stretch"
      style={{
        filter: dimmed ? "saturate(.78) brightness(.93)" : "none",
        transition: "filter 900ms ease",
      }}
    >
      <BenchDefs />
      {layout && views && (
        <>
          {Array.from({ length: layout.rows }, (_, row) => (
            <RowLayers
              key={`row${row}`}
              layout={layout}
              row={row}
              tubes={views.tubes.filter(
                (tube) =>
                  tube.inRack && layout.slots[tube.index]?.row === row,
              )}
              shadows={views.tubes.filter(
                (tube) => layout.slots[tube.index]?.row === row,
              )}
            />
          ))}
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {views.caustics.map((caustic) => (
              <Caustic
                key={`c${caustic.index}`}
                caustic={caustic}
                layout={layout}
              />
            ))}
            {views.tubes
              .filter((tube) => !tube.inRack)
              .map((tube) => (
                <FrontTube key={tube.index} tube={tube} k={layout.k} />
              ))}
            {views.streams.map((stream) => (
              <Stream key={stream.key} stream={stream} k={layout.k} />
            ))}
            {views.sweep !== null && (
              <Sweep layout={layout} progress={views.sweep} />
            )}
          </svg>
          {state.map((bottle, index) => {
            const slot = layout.slots[index];
            if (!slot) return null;
            const label = `ボトル ${index + 1}`;
            const contents =
              bottle.length === 0
                ? "空"
                : bottle
                    .map((color) => getWaterColorView(color).name)
                    .join("、");
            const k = layout.k;
            return (
              <button
                key={label}
                type="button"
                aria-label={`${label}: ${contents}`}
                aria-pressed={index === sourceBottleIndex}
                disabled={interactionDisabled}
                onClick={() => selectBottle(index)}
                className="absolute cursor-pointer touch-manipulation rounded-2xl bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#fff6dc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#7a5229]"
                style={{
                  left: slot.x - (layout.pitchX * k) / 2,
                  top: slot.y - 16 * k,
                  width: layout.pitchX * k,
                  height: 224 * k,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

// ---- その時刻の見え方 ----

function buildViews(
  layout: BenchLayout,
  state: WaterSortBoardProps["state"],
  events: readonly BenchEvent[],
  now: number,
  sourceBottleIndex: number | null,
) {
  const k = layout.k;
  const started = events.filter((event) => event.start <= now);
  const pourBySource = new Map<number, [PourEvent, PourFrame]>();
  const pourByDest = new Map<number, [PourEvent, PourFrame]>();
  for (const event of started) {
    if (event.kind === "pour") {
      const frame = pourFrame(layout, event, now);
      pourBySource.set(event.source, [event, frame]);
      pourByDest.set(event.dest, [event, frame]);
    }
  }
  const knocks = new Map<number, number>();
  const bumps = new Map<number, Pose>();
  for (const event of started) {
    if (event.kind === "bump") {
      const { pose, destKnock } = bumpPose(layout, event, now);
      bumps.set(event.source, pose);
      if (destKnock) knocks.set(event.dest, destKnock);
    }
  }
  const clearEvent = events.find((event) => event.kind === "clear");
  const clearT =
    clearEvent && now >= clearEvent.start
      ? (now - clearEvent.start) / CLEAR_MS
      : clearEvent
        ? null
        : isWaterSortCleared(state)
          ? 1
          : null;
  const sweepX =
    clearT === null
      ? null
      : layout.rackLeft -
        60 * k +
        (layout.rackWidthUnits * k + 120 * k) *
          Math.min(1, Math.max(0, (clearT - 0.04) / 0.56));

  const streams: StreamView[] = [];
  const caustics: CausticView[] = [];
  const tubes: TubeView[] = state.map((bottle, index) => {
    const complete = isCompleteWaterSortBottle(bottle);
    const corkEvent = events.find(
      (event): event is CorkEvent =>
        event.kind === "cork" && event.bottle === index,
    );
    const cork = complete
      ? corkFrame(corkEvent ?? null, now)
      : { cork: null, sink: 0, glint: 0, knock: 0 };
    let segments: LiquidSegment[] = toSegments(bottle);
    let pose: Pose = restPose(layout, index, cork.sink);
    const art: TubeArtProps = { segments, time: now };

    const asSource = pourBySource.get(index);
    const asDest = pourByDest.get(index);
    const lift = started.find(
      (event): event is LiftEvent =>
        event.kind === "lift" && event.bottle === index,
    );
    const rattle = started.find(
      (event): event is RattleEvent =>
        event.kind === "rattle" && event.bottle === index,
    );

    if (asSource) {
      const [event, frame] = asSource;
      pose = frame.sourcePose;
      segments = frame.sourceSegments;
      if (frame.stream) {
        const from = poseToWorld(pose, k, ...pourLip(event.dir));
        const dest = layout.slots[event.dest];
        streams.push({
          key: `s${event.id}`,
          from,
          toY: (dest?.y ?? 0) + 6 * k,
          x: from[0] + event.dir * 2.5 * k,
          width: frame.stream.width,
          color: frame.stream.color,
        });
      }
    } else if (bumps.has(index)) {
      pose = bumps.get(index) as Pose;
    } else if (lift) {
      pose = liftPose(layout, lift, now);
    } else if (index === sourceBottleIndex) {
      pose = liftedPose(layout, index);
    }

    if (asDest) {
      const [event, frame] = asDest;
      segments = frame.destSegments;
      const dest = layout.slots[index];
      const sameColor =
        event.destBefore.length > 0 && lastOf(event.destBefore) === event.color;
      if (frame.transfer !== null) {
        const u = frame.transfer;
        const streamX =
          poseToWorld(frame.sourcePose, k, ...pourLip(event.dir))[0] +
          event.dir * 2.5 * k;
        const width = Math.min(1, u / 0.1, (1 - u) / 0.12);
        art.inflow = {
          x: (streamX - (dest?.x ?? 0)) / k,
          width: 1.2 + 3.4 * width,
          color: event.color,
        };
        art.wave = 1.1 + Math.sin(u * Math.PI) * 0.9;
        art.splash = 0.5 + 0.5 * Math.sin(now / 70);
        if (sameColor) {
          art.fadingBoundary = {
            units: event.destBefore.length,
            strength: 1 - u ** 1.3,
          };
        }
      } else if (frame.settle !== null) {
        art.wave = 1.6 * (1 - frame.settle) ** 2;
      } else if (sameColor) {
        art.fadingBoundary = null;
      }
    }

    if (rattle && pose.layer === "rack") {
      pose = { ...pose, y: pose.y + rattleOffset(rattle, now) * k };
    }
    const knock = (knocks.get(index) ?? 0) + cork.knock;
    if (knock) pose = { ...pose, y: pose.y + knock * k };

    art.segments = segments;
    art.cork = cork.cork;
    art.done = complete && cork.cork !== null;
    let glint = cork.glint;
    let shine = 0;
    if (sweepX !== null && clearT !== null) {
      const slot = layout.slots[index];
      const dx = (sweepX - (slot?.x ?? 0)) / (46 * k);
      shine = Math.exp(-dx * dx) * (clearT < 1 ? 1 : 0);
      if (complete && dx > 0 && clearT < 1) {
        glint = Math.max(glint, Math.exp(-((dx - 1.4) ** 2)) * 1);
      }
      // 光の帯が届いた試験管から順に、栓をした試験管が小さく鳴るように跳ねる。
      const reached = sweepReachTime(layout, slot?.x ?? 0);
      const sinceReach = ((clearT - reached) * CLEAR_MS) / CLEAR_HOP_MS;
      if (complete && sinceReach > 0 && sinceReach < 1 && pose.layer === "rack") {
        pose = {
          ...pose,
          y: pose.y - Math.sin(Math.PI * sinceReach) * 6 * k * (1 - sinceReach * 0.3),
        };
      }
      if (complete && slot) {
        caustics.push({
          index,
          x: slot.x,
          row: slot.row,
          color: bottle[0] ?? 0,
          strength: Math.min(1, Math.max(0, ((clearT - reached) * CLEAR_MS) / 520)),
        });
      }
    }
    art.glint = glint;
    art.shine = shine;

    const tilted = Math.abs(pose.angle) > 8;
    return {
      index,
      pose,
      art,
      tiltedSegments: tilted ? segments : null,
      baseColor: segments[0]?.color ?? null,
      inRack: pose.layer === "rack",
    };
  });

  return {
    tubes,
    streams,
    caustics,
    sweep: clearT !== null && clearT < 1 ? clearT : null,
  };
}

// ---- 描く部品（この盤面の中だけで使う） ----

type RowLayersProps = {
  layout: BenchLayout;
  row: number;
  tubes: TubeView[];
  shadows: TubeView[];
};

function RowLayers({ layout, row, tubes, shadows }: RowLayersProps) {
  const k = layout.k;
  return (
    <>
      <RackTier layout={layout} row={row} part="back" />
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        {/* 下の板に落ちる影と、色水を通った光 */}
        {shadows.map((tube) => {
          const slot = layout.slots[tube.index];
          if (!slot) return null;
          const home = tube.inRack && Math.abs(tube.pose.angle) < 1;
          const baseY = slot.y + 198 * k;
          return (
            <g key={`sh${tube.index}`}>
              <ellipse
                cx={slot.x + 12 * k}
                cy={baseY}
                rx={27 * k}
                ry={5 * k}
                fill="url(#bn-shadow)"
                opacity={home ? 0.9 : 0.35}
              />
              {tube.baseColor !== null && home && (
                <ellipse
                  cx={slot.x + 20 * k}
                  cy={baseY}
                  rx={22 * k}
                  ry={4.6 * k}
                  fill={glowFill(tube.baseColor)}
                />
              )}
            </g>
          );
        })}
        {tubes.map((tube) => (
          <g key={tube.index} transform={poseTransform(tube.pose, k)}>
            <TubeArt {...tube.art} />
          </g>
        ))}
      </svg>
      <RackTier layout={layout} row={row} part="front" />
    </>
  );
}

type FrontTubeProps = { tube: TubeView; k: number };

function FrontTube({ tube, k }: FrontTubeProps) {
  const lifted = tube.pose;
  return (
    <g>
      {/* 手前に持った試験管が立てに落とす影 */}
      <g
        transform={`translate(${lifted.x + 14 * k} ${lifted.y + 18 * k}) rotate(${lifted.angle})`}
        opacity={0.18}
      >
        <rect
          x={-24 * k}
          y={-96 * k}
          width={48 * k}
          height={190 * k}
          rx={24 * k}
          fill="#3b2410"
          filter="url(#bn-blur5)"
        />
      </g>
      {tube.tiltedSegments ? (
        <TiltedTube
          id={`bn-tilt-${tube.index}`}
          pose={tube.pose}
          k={k}
          segments={tube.tiltedSegments}
        />
      ) : (
        <g transform={poseTransform(tube.pose, k)}>
          <TubeArt {...tube.art} />
        </g>
      )}
    </g>
  );
}

type StreamProps = { stream: StreamView; k: number };

function Stream({ stream, k }: StreamProps) {
  const [fx, fy] = stream.from;
  const paint = liquidPaint(stream.color);
  const w = stream.width * k;
  const d = `M${fx},${fy} Q${stream.x},${fy + 2 * k} ${stream.x},${fy + 10 * k} L${stream.x},${stream.toY}`;
  return (
    <g>
      <path
        d={d}
        stroke={paint.deep}
        strokeWidth={w + 0.9 * k}
        fill="none"
        strokeLinecap="round"
        opacity={0.85}
      />
      <path
        d={d}
        stroke={paint.base}
        strokeWidth={w}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={d}
        stroke="#fff"
        strokeWidth={Math.max(0.6, w * 0.26)}
        fill="none"
        opacity={0.6}
        transform={`translate(${-w * 0.22} 0)`}
      />
    </g>
  );
}

type CausticProps = { caustic: CausticView; layout: BenchLayout };

/** 色水の試験管を通った窓の光が、台の上に落とす色の溜まり。円筒がレンズになり、芯に明るい線ができる。 */
function Caustic({ caustic, layout }: CausticProps) {
  const k = layout.k;
  const back = layout.rows - 1 - caustic.row;
  const x = caustic.x + (24 + back * 10) * k;
  const y = layout.rackBottom + (14 + back * 16) * k;
  const paint = liquidPaint(caustic.color);
  const s = caustic.strength;
  return (
    <g opacity={s}>
      <ellipse
        cx={x}
        cy={y}
        rx={(34 + back * 4) * k}
        ry={(10 + back * 2) * k}
        fill={glowFill(caustic.color)}
        transform={`rotate(6 ${x} ${y})`}
      />
      <ellipse
        cx={x}
        cy={y}
        rx={(22 + back * 3) * k}
        ry={(5 + back) * k}
        fill={paint.base}
        opacity={0.35}
        transform={`rotate(6 ${x} ${y})`}
      />
      <ellipse
        cx={x + 2 * k}
        cy={y}
        rx={16 * k * (0.7 + 0.3 * s)}
        ry={1.8 * k}
        fill="#fffdf2"
        opacity={0.85}
        transform={`rotate(6 ${x} ${y})`}
      />
      <ellipse
        cx={x + 2 * k}
        cy={y}
        rx={20 * k * (0.7 + 0.3 * s)}
        ry={3 * k}
        fill={paint.rim}
        opacity={0.6}
        transform={`rotate(6 ${x} ${y})`}
      />
    </g>
  );
}

type SweepProps = { layout: BenchLayout; progress: number };

function Sweep({ layout, progress }: SweepProps) {
  const k = layout.k;
  const width = layout.rackWidthUnits * k;
  const travel = Math.min(1, Math.max(0, (progress - 0.04) / 0.56));
  const x = layout.rackLeft - 60 * k + (width + 120 * k) * travel;
  const opacity = Math.sin(Math.PI * Math.min(1, progress / 0.66)) * 1;
  const top = layout.rackTop - 30 * k;
  const height = layout.rackBottom - top + 20 * k;
  return (
    <g style={{ mixBlendMode: "screen" }} opacity={opacity}>
      <rect
        x={x - 70 * k}
        y={top}
        width={140 * k}
        height={height}
        fill="url(#bn-sweep)"
        transform={`skewX(-14) translate(${(top + height / 2) * Math.tan((14 * Math.PI) / 180)} 0)`}
      />
    </g>
  );
}
