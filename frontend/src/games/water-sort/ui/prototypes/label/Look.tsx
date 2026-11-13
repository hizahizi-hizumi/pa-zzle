// 試作 label「封をした標本棚」: 済んだ管が封をされて札を下げた標本になり、最後に棚全体が澄んだ標本棚として仕上がる。
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePrepareSoundEffects } from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import pouredBubble1SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble3SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble5SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import pouredBubble6SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";
import {
  chooseRackLayout,
  liftedPose,
  type Pose,
  type RackLayout,
  toWorld,
} from "./geometry";
import { liquidTone } from "./palette";
import { RackBack, RackFront, woodSurfaces } from "./rack";
import { Tag, type TagVisual } from "./tag";
import {
  dampedSwing,
  easeIn,
  easeInOut,
  easeOut,
  easeOutBack,
  FINALE_AFTER_SEAL,
  FINALE_COMPLETE,
  FINALE_SHEEN_END,
  FINALE_SHEEN_START,
  FINALE_TAG_ALIGN,
  FINALE_TAG_STAGGER,
  jitter,
  LIFT_DURATION,
  lerp,
  POUR_END,
  POUR_RETURN_TURNED,
  POUR_TRANSFER_END,
  POUR_TRANSFER_START,
  progress,
  SEAL_AFTER_POUR,
  SEAL_CLEAR_END,
  SEAL_CLEAR_START,
  SEAL_CORK_SEATED,
  SEAL_DONE,
  SEAL_TAG_HUNG,
  SEAL_TAG_START,
  SHAKE_DURATION,
} from "./timeline";
import { lipPoint, type Segment, TubeGlass, type TubeVisual } from "./tube";

// ---- 音 ----

const invalidSound = defineSoundEffect(invalidSoundUrl);
const clearedSound = defineSoundEffect(clearedSoundUrl);
const bubbleSounds = [
  pouredBubble1SoundUrl,
  pouredBubble2SoundUrl,
  pouredBubble3SoundUrl,
  pouredBubble4SoundUrl,
  pouredBubble5SoundUrl,
  pouredBubble6SoundUrl,
].map((url) => defineSoundEffect(url));
const bubbleLayers = bubbleSounds.map((sound, index) => ({
  sound,
  offsetMs: (POUR_TRANSFER_END - POUR_TRANSFER_START) * [0, 0.16, 0.3, 0.48, 0.64, 0.82][index]!,
}));
const labelSounds: readonly SoundEffect[] = [invalidSound, clearedSound, ...bubbleSounds];

// ---- 動きの記録 ----

type PourMotion = {
  id: number;
  source: number;
  destination: number;
  color: number;
  amount: number;
  sourceBefore: WaterSortBottle;
  destinationBefore: WaterSortBottle;
  start: number;
  liftAtStart: number;
  direction: 1 | -1;
};

type Tween = { from: number; to: number; start: number };

type Finale = { start: number };

function segmentsOf(bottle: readonly number[]): Segment[] {
  const segments: Segment[] = [];
  for (const color of bottle) {
    const last = segments.at(-1);
    if (last && last.color === color) {
      last.amount += 1;
    } else {
      segments.push({ color, amount: 1 });
    }
  }
  return segments;
}

function removeFromTop(segments: Segment[], amount: number): Segment[] {
  const result = segments.map((segment) => ({ ...segment }));
  let remaining = amount;
  for (let index = result.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const segment = result[index]!;
    const taken = Math.min(segment.amount, remaining);
    segment.amount -= taken;
    remaining -= taken;
  }
  return result.filter((segment) => segment.amount > 0.0005);
}

function transferProgress(t: number): number {
  return easeInOut(progress(t, POUR_TRANSFER_START, POUR_TRANSFER_END));
}

function isBusy(pour: PourMotion, bottle: number, now: number) {
  return (
    bottle === pour.source ||
    (bottle === pour.destination && now < pour.start + POUR_TRANSFER_END)
  );
}

function pourAngle(direction: 1 | -1, volume: number) {
  return direction * Math.min(118, 126 - 12.5 * volume);
}

/** 口の縁を注ぎ先の口の真上に置く姿勢。 */
function pourPose(
  destination: { cx: number; ty: number },
  direction: 1 | -1,
  angle: number,
): Pose {
  const targetX = destination.cx + direction * 3;
  const targetY = destination.ty - 20;
  const probe = { x: 0, y: 0, angle };
  const [lx, ly] = toWorld(probe, 22 * direction, 1);
  return { x: targetX - lx, y: targetY - ly, angle };
}

function rotateAroundBase(pose: Pose, delta: number): Pose {
  const [px, py] = toWorld(pose, 0, 190);
  const angle = pose.angle + delta;
  const r = (angle * Math.PI) / 180;
  return { x: px + 190 * Math.sin(r), y: py - 190 * Math.cos(r), angle };
}

const tagRest = (bottle: number) => ({
  angle: 8 * jitter(bottle, 1),
  facing: 0.74 + 0.2 * jitter(bottle, 2),
});

// 確かめるときに動きを遅くして途中を撮るための倍率（URL の labelSlow）。
const timeScale =
  typeof window === "undefined"
    ? 1
    : Number(new URLSearchParams(window.location.search).get("labelSlow")) || 1;

function clock() {
  return performance.now() / timeScale;
}

/** 注げない先を打ったとき、選んだ管が注ぎ先へ傾きかけて、首を振って戻る。 */
const REFUSAL_LEAN = 200;
const REFUSAL_DURATION = 760;

// ---- 盤面 ----

export function Board({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  usePrepareSoundEffects(labelSounds);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [, setFrame] = useState(0);
  const frameRequestRef = useRef<number | null>(null);
  const activeUntilRef = useRef(0);
  const poursRef = useRef<PourMotion[]>([]);
  const sealsRef = useRef(new Map<number, number>());
  const shakesRef = useRef(new Map<number, number>());
  const refusalsRef = useRef(new Map<number, { start: number; direction: number }>());
  const liftsRef = useRef(new Map<number, Tween>());
  const finaleRef = useRef<Finale | null>(null);
  const hushRef = useRef<Tween>({ from: 0, to: 0, start: 0 });
  const processedRef = useRef(new Set<number>(operation ? [operation.id] : []));
  const clearTimerRef = useRef<number | null>(null);
  const pourActiveRef = useRef(false);
  const onClearRef = useRef(onClearAnimationComplete);
  onClearRef.current = onClearAnimationComplete;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  function keepAnimating(until: number) {
    activeUntilRef.current = Math.max(activeUntilRef.current, until);
    if (frameRequestRef.current !== null) {
      return;
    }
    const step = () => {
      setFrame((frame) => frame + 1);
      if (clock() < activeUntilRef.current) {
        frameRequestRef.current = requestAnimationFrame(step);
      } else {
        frameRequestRef.current = null;
      }
    };
    frameRequestRef.current = requestAnimationFrame(step);
  }

  function liftValue(bottle: number, now: number) {
    const tween = liftsRef.current.get(bottle);
    if (!tween) {
      return bottle === sourceBottleIndex ? 1 : 0;
    }
    const t = progress(now, tween.start, tween.start + LIFT_DURATION);
    const eased = tween.to > tween.from ? easeOutBack(t) : easeOut(t);
    return lerp(tween.from, tween.to, eased);
  }

  function interrupt(bottles: readonly number[], now: number) {
    poursRef.current = poursRef.current.filter((pour) => {
      const busy = bottles.some((bottle) => isBusy(pour, bottle, now));
      if (busy) {
        const sealStart = sealsRef.current.get(pour.destination);
        if (sealStart !== undefined && sealStart > now) {
          sealsRef.current.set(pour.destination, now);
        }
      }
      return !busy;
    });
  }

  useLayoutEffect(() => {
    const now = clock();
    if (!operation) {
      poursRef.current = [];
      sealsRef.current.clear();
      shakesRef.current.clear();
      refusalsRef.current.clear();
      liftsRef.current.clear();
      finaleRef.current = null;
      processedRef.current.clear();
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      keepAnimating(now + 30);
      return;
    }
    if (processedRef.current.has(operation.id)) {
      return;
    }
    processedRef.current.add(operation.id);

    switch (operation.type) {
      case "source-selected":
      case "source-deselected": {
        const bottle = operation.bottleIndex;
        interrupt([bottle], now);
        const from = liftValue(bottle, now);
        liftsRef.current.set(bottle, {
          from,
          to: operation.type === "source-selected" ? 1 : 0,
          start: now,
        });
        keepAnimating(now + LIFT_DURATION + 30);
        break;
      }
      case "invalid": {
        const bottle = operation.bottleIndex;
        interrupt([bottle], now);
        shakesRef.current.set(bottle, now);
        if (sourceBottleIndex !== null && sourceBottleIndex !== bottle) {
          const slots = layoutRef.current?.slots;
          const from = slots?.[sourceBottleIndex]?.cx ?? 0;
          const to = slots?.[bottle]?.cx ?? 0;
          refusalsRef.current.set(sourceBottleIndex, {
            start: now,
            direction: to >= from ? 1 : -1,
          });
        }
        playSound(invalidSound);
        keepAnimating(now + Math.max(SHAKE_DURATION + 400, REFUSAL_DURATION + 40));
        break;
      }
      case "poured": {
        const { sourceBottleIndex: source, destinationBottleIndex: destination } = operation;
        interrupt([source, destination], now);
        const sourceBefore = operation.stateBefore[source] ?? [];
        const sourceAfter = operation.stateAfter[source] ?? [];
        const destinationAfter = operation.stateAfter[destination] ?? [];
        const color = sourceBefore.at(-1) ?? 0;
        const columns = layoutRef.current?.columns ?? 4;
        const destinationColumn = destination % columns;
        const direction: 1 | -1 = destinationColumn < (columns - 1) / 2 ? -1 : 1;
        const liftAtStart = liftValue(source, now);
        liftsRef.current.set(source, { from: 0, to: 0, start: now });
        poursRef.current = [
          ...poursRef.current,
          {
            id: operation.id,
            source,
            destination,
            color,
            amount: sourceBefore.length - sourceAfter.length,
            sourceBefore,
            destinationBefore: operation.stateBefore[destination] ?? [],
            start: now,
            liftAtStart,
            direction,
          },
        ];
        playLayeredSound(bubbleLayers, {
          delayMs: POUR_TRANSFER_START,
          variation: REPEATED_SOUND_VARIATION,
        });
        let until = now + POUR_END + 60;
        if (isCompleteWaterSortBottle(destinationAfter)) {
          sealsRef.current.set(destination, now + SEAL_AFTER_POUR);
          until = Math.max(until, now + SEAL_AFTER_POUR + SEAL_DONE);
          if (operation.isClearingMove) {
            playSound(clearedSound, { delayMs: SEAL_AFTER_POUR + SEAL_CORK_SEATED });
          } else {
            playSound(clearedSound, {
              delayMs: SEAL_AFTER_POUR + SEAL_CORK_SEATED,
              playbackRate: 1.5,
              volume: 0.32,
            });
          }
        }
        if (operation.isClearingMove) {
          const finaleStart = now + SEAL_AFTER_POUR + FINALE_AFTER_SEAL;
          finaleRef.current = { start: finaleStart };
          playSound(clearedSound, {
            delayMs: SEAL_AFTER_POUR + FINALE_AFTER_SEAL + FINALE_SHEEN_START + 260,
            playbackRate: 2,
            volume: 0.22,
          });
          until = Math.max(until, finaleStart + FINALE_COMPLETE + 100);
          if (clearTimerRef.current !== null) {
            window.clearTimeout(clearTimerRef.current);
          }
          clearTimerRef.current = window.setTimeout(() => {
            clearTimerRef.current = null;
            onClearRef.current?.();
          }, (SEAL_AFTER_POUR + FINALE_AFTER_SEAL + FINALE_COMPLETE) * timeScale);
        }
        keepAnimating(until);
        break;
      }
    }
    // 操作を受けた描画のうちに動きを描き直し、注ぐ前の盤面が一瞬でも抜けないようにする。
    setFrame((frame) => frame + 1);
  }, [operation]);

  const deadlocked = useMemo(
    () => classifyWaterSortDeadlock(state) === "deadlocked",
    [state],
  );

  const layout = useMemo(
    () => (size ? chooseRackLayout(state.length, size.width, size.height) : null),
    [size, state.length],
  );
  const layoutRef = useRef<RackLayout | null>(null);
  layoutRef.current = layout;

  const now = clock();
  const activePours = poursRef.current.filter((pour) => now < pour.start + POUR_END);
  const pourActive = activePours.length > 0;
  const hushTarget = deadlocked && !pourActive ? 1 : 0;

  useEffect(() => {
    poursRef.current = poursRef.current.filter(
      (pour) => clock() < pour.start + POUR_END,
    );
    if (pourActiveRef.current !== pourActive) {
      pourActiveRef.current = pourActive;
      onPourAnimationActivityChange?.(pourActive);
    }
  });

  useLayoutEffect(() => {
    const at = clock();
    const hush = hushRef.current;
    const current = lerp(hush.from, hush.to, easeInOut(progress(at, hush.start, hush.start + 900)));
    hushRef.current = { from: current, to: hushTarget, start: at };
    keepAnimating(at + 950);
  }, [hushTarget]);

  const hushTween = hushRef.current;
  const hush = lerp(hushTween.from, hushTween.to, easeInOut(progress(now, hushTween.start, hushTween.start + 900)));

  function latestPour(bottle: number) {
    for (let index = activePours.length - 1; index >= 0; index -= 1) {
      const pour = activePours[index]!;
      if (pour.source === bottle || pour.destination === bottle) {
        return pour;
      }
    }
    return null;
  }

  const rackTubes: ReactNode[] = [];
  const caustics: ReactNode[] = [];
  const topTubes: ReactNode[] = [];
  const streams: ReactNode[] = [];
  const tags: ReactNode[] = [];
  const finale = finaleRef.current;
  let sheen = -1;
  let gloss = 0;

  if (layout) {
    if (finale) {
      sheen = progress(now, finale.start + FINALE_SHEEN_START, finale.start + FINALE_SHEEN_END);
      gloss = easeOut(progress(now, finale.start + FINALE_SHEEN_START, finale.start + FINALE_SHEEN_END + 300));
    }
    let sealedOrder = 0;
    state.forEach((bottle, index) => {
      const slot = layout.slots[index];
      if (!slot) {
        return;
      }
      const pour = latestPour(index);
      const t = pour ? now - pour.start : 0;
      let segments: Segment[];
      let frost = bottle.length > 0 ? 1 : 0;
      let surfaceWave = 0;
      let wavePhase = 0;
      let inflow: TubeVisual["inflow"];
      let flying: { pose: Pose; inRack: boolean; masked: boolean } | null = null;

      if (pour && pour.source === index) {
        const moved = pour.amount * transferProgress(t);
        segments = removeFromTop(segmentsOf(pour.sourceBefore), moved);
        const remaining = pour.sourceBefore.length - moved;
        const becameEmpty = pour.sourceBefore.length === pour.amount;
        frost = becameEmpty ? 1 - easeInOut(progress(t, POUR_TRANSFER_END, POUR_END)) : 1;
        const destinationSlot = layout.slots[pour.destination]!;
        const start = liftedPose(slot.cx, slot.ty, pour.liftAtStart);
        const startAngle = pourAngle(pour.direction, pour.sourceBefore.length);
        const endAngle = pourAngle(pour.direction, pour.sourceBefore.length - pour.amount);
        if (t < POUR_TRANSFER_START) {
          const s = easeInOut(t / POUR_TRANSFER_START);
          const target = pourPose(destinationSlot, pour.direction, startAngle);
          flying = {
            pose: {
              x: lerp(start.x, target.x, s),
              y: lerp(start.y, target.y, s) - 46 * Math.sin(Math.PI * s),
              angle: lerp(start.angle, startAngle, easeInOut(progress(t, 40, POUR_TRANSFER_START))),
            },
            inRack: false,
            masked: true,
          };
        } else if (t < POUR_TRANSFER_END) {
          flying = {
            pose: pourPose(destinationSlot, pour.direction, pourAngle(pour.direction, remaining)),
            inRack: false,
            masked: false,
          };
          const p = progress(t, POUR_TRANSFER_START, POUR_TRANSFER_END);
          const width = 3.8 * Math.sin(Math.PI * Math.min(1, p * 1.25 + 0.04)) ** 0.5;
          const lip = lipPoint(flying.pose);
          const sx = destinationSlot.cx + pour.direction * 3;
          const topY = destinationSlot.ty + 4;
          const tone = liquidTone(pour.color, 0);
          const d = `M${lip[0].toFixed(2)},${lip[1].toFixed(2)} C${(lip[0] + pour.direction * 1.5).toFixed(2)},${(lip[1] + 5).toFixed(2)} ${sx},${(lip[1] + 8).toFixed(2)} ${sx},${(lip[1] + 14).toFixed(2)} L${sx},${topY}`;
          streams.push(
            <g key={`stream${pour.id}`}>
              <path d={d} stroke={tone.dark} strokeWidth={width + 0.8} fill="none" strokeLinecap="round" opacity=".9" />
              <path d={d} stroke={tone.light} strokeWidth={width} fill="none" strokeLinecap="round" />
              <path d={d} stroke="#fff" strokeWidth={Math.max(0.5, width * 0.28)} fill="none" opacity=".55" transform={`translate(${(-width * 0.22).toFixed(2)} 0)`} />
            </g>,
          );
        } else if (t < POUR_RETURN_TURNED) {
          const s = easeInOut(progress(t, POUR_TRANSFER_END, POUR_RETURN_TURNED));
          const from = pourPose(destinationSlot, pour.direction, endAngle);
          const target = liftedPose(slot.cx, slot.ty, 1.6);
          flying = {
            pose: {
              x: lerp(from.x, target.x, s),
              y: lerp(from.y, target.y, s) - 30 * Math.sin(Math.PI * s),
              angle: lerp(from.angle, target.angle, s),
            },
            inRack: false,
            masked: true,
          };
        } else {
          const s = easeOut(progress(t, POUR_RETURN_TURNED, POUR_END));
          flying = { pose: liftedPose(slot.cx, slot.ty, lerp(1.6, 0, s)), inRack: true, masked: false };
        }
      } else if (pour && pour.destination === index) {
        const p = transferProgress(t);
        const incoming = pour.amount * p;
        const before = segmentsOf(pour.destinationBefore);
        const seamOpacity = 1 - progress(t, POUR_TRANSFER_END - 140, POUR_TRANSFER_END + 340);
        const seamAmplitude = 0.6 + 2.2 * Math.sin(Math.PI * progress(t, POUR_TRANSFER_START, POUR_TRANSFER_END + 340));
        if (incoming > 0.0005) {
          before.push({
            color: pour.color,
            amount: incoming,
            seam:
              pour.destinationBefore.length > 0
                ? { amplitude: seamAmplitude, opacity: seamOpacity, phase: t / 70 }
                : undefined,
          });
        }
        segments = before;
        frost = pour.destinationBefore.length === 0 ? easeOut(p) : 1;
        const flowing = t >= POUR_TRANSFER_START && t < POUR_TRANSFER_END;
        surfaceWave =
          (flowing ? 1.5 : 0) +
          (t >= POUR_TRANSFER_END ? 1.5 * Math.exp(-(t - POUR_TRANSFER_END) / 180) : 0);
        wavePhase = t / 55;
        if (flowing) {
          const pp = progress(t, POUR_TRANSFER_START, POUR_TRANSFER_END);
          inflow = {
            color: pour.color,
            width: 3.8 * Math.sin(Math.PI * Math.min(1, pp * 1.25 + 0.04)) ** 0.5,
            x: pour.direction * 3,
          };
        }
      } else {
        segments = segmentsOf(bottle);
      }

      const displayComplete =
        segments.length === 1 && Math.abs((segments[0]?.amount ?? 0) - 4) < 0.001;
      const complete = isCompleteWaterSortBottle(bottle) && displayComplete;
      const sealStart = sealsRef.current.get(index) ?? Number.NEGATIVE_INFINITY;
      const sinceSeal = now - sealStart;
      const sealed = complete && sinceSeal >= 0;
      const shakeStart = shakesRef.current.get(index);
      const sinceShake = shakeStart === undefined ? Number.POSITIVE_INFINITY : now - shakeStart;
      const shaking = sinceShake < SHAKE_DURATION + 400;

      let pose = flying?.pose ?? liftedPose(slot.cx, slot.ty, liftValue(index, now));
      let cork: TubeVisual["cork"];
      let deep = 0;
      let rim = 0;
      let glint = 0;
      if (sealed) {
        const corkT = progress(sinceSeal, 0, SEAL_CORK_SEATED);
        const bounce = sinceSeal > SEAL_CORK_SEATED && sinceSeal < SEAL_CORK_SEATED + 170
          ? Math.sin((Math.PI * (sinceSeal - SEAL_CORK_SEATED)) / 170)
          : 0;
        cork = {
          lift: 40 * (1 - easeIn(corkT)) + bounce * 2.2,
          angle: 0,
          opacity: progress(sinceSeal, 0, 70),
          squash: sinceSeal > SEAL_CORK_SEATED - 30 && sinceSeal < SEAL_CORK_SEATED + 120
            ? Math.sin((Math.PI * (sinceSeal - SEAL_CORK_SEATED + 30)) / 150)
            : 0,
        };
        const clear = easeOut(progress(sinceSeal, SEAL_CLEAR_START, SEAL_CLEAR_END));
        frost = 1 - clear;
        deep = clear;
        rim = clear;
        glint = progress(sinceSeal, 360, 1000);
        if (shaking) {
          cork.angle = dampedSwing(sinceShake, 7, 130, 120);
          cork.lift += sinceShake < 150 ? 2.6 * Math.sin((Math.PI * sinceShake) / 150) : 0;
        }
      } else if (shaking && !flying) {
        pose = rotateAroundBase(pose, dampedSwing(sinceShake, 5, 120, 120));
      }
      const refusal = refusalsRef.current.get(index);
      if (refusal && !flying && !sealed) {
        const sinceRefusal = now - refusal.start;
        if (sinceRefusal < REFUSAL_DURATION) {
          const lean = sinceRefusal < REFUSAL_LEAN ? Math.sin((Math.PI * sinceRefusal) / REFUSAL_LEAN) : 0;
          const shake = dampedSwing(sinceRefusal - REFUSAL_LEAN * 0.8, 4.5, 110, 100);
          pose = rotateAroundBase(pose, refusal.direction * 12 * lean + shake);
          pose = { ...pose, y: pose.y - 6 * lean };
        }
      }

      const order = sealed ? sealedOrder++ : 0;
      if (finale && sealed) {
        const sinceFinale = now - finale.start - order * FINALE_TAG_STAGGER;
        glint = Math.max(glint > 0 && glint < 1 ? glint : 0, progress(sinceFinale, 120, 760));
      }

      const visual: TubeVisual = {
        key: flying && !flying.inRack ? `f${index}` : `r${index}`,
        pose,
        segments,
        frost,
        deep,
        hush: sealed ? 0 : hush,
        surfaceWave,
        wavePhase,
        inflow,
        cork,
        glint: glint >= 1 ? 0 : glint,
        rim,
      };

      if (!flying || flying.inRack) {
        const bottom = segments[0];
        const liftNow = flying ? 0.6 : liftValue(index, now);
        caustics.push(
          <g key={`c${index}`}>
            <ellipse cx={slot.cx + 11} cy={slot.ty + 198} rx="26" ry="4.5" fill="#55361a" opacity={(0.32 - liftNow * 0.14).toFixed(2)} filter="url(#lbl-blur3)" />
            {bottom && (
              <ellipse
                cx={slot.cx + 17}
                cy={slot.ty + 197}
                rx="18"
                ry="3.8"
                fill={liquidTone(bottom.color, deep).glow}
                opacity={Math.min(1, (0.42 + deep * 0.25 + gloss * 0.3 - liftNow * 0.2) * (1 - hush * 0.6)).toFixed(2)}
                filter="url(#lbl-blur3)"
              />
            )}
          </g>,
        );
        rackTubes.push(<TubeGlass key={`t${index}`} visual={visual} />);
      } else {
        const mask = flying.masked ? `url(#lbl-home-${index})` : undefined;
        topTubes.push(
          <g key={`t${index}`} mask={mask}>
            {flying.masked && (
              <mask id={`lbl-home-${index}`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="2000" height="2000">
                <rect x="-400" y="-400" width="2000" height="2000" fill="#fff" />
                <rect x={slot.cx - layout.spacing / 2} y={slot.ty + 30} width={layout.spacing} height="12" fill="#000" />
                <rect x={slot.cx - layout.spacing / 2} y={slot.ty + 202} width={layout.spacing} height="14" fill="#000" />
              </mask>
            )}
            <TubeGlass visual={visual} />
          </g>,
        );
      }

      if (sealed && bottle[0] !== undefined) {
        const rest = tagRest(index);
        let angle = rest.angle;
        let facing = rest.facing;
        const drop = easeOut(progress(sinceSeal, SEAL_TAG_START, SEAL_TAG_HUNG));
        const loop = progress(sinceSeal, SEAL_TAG_START - 90, SEAL_TAG_START + 60);
        angle += dampedSwing(sinceSeal - SEAL_TAG_HUNG, 17, 640, 430);
        if (sinceSeal < SEAL_TAG_HUNG) {
          angle += (1 - drop) * -10;
        }
        if (shaking) {
          angle += dampedSwing(sinceShake, 13, 420, 300);
        }
        if (finale) {
          const sinceFinale = now - finale.start - order * FINALE_TAG_STAGGER;
          if (sinceFinale > 0) {
            const align = easeInOut(progress(sinceFinale, 0, FINALE_TAG_ALIGN));
            angle = lerp(rest.angle, 0, align) + dampedSwing(sinceFinale, 15, 600, 330);
            if (sinceSeal >= SEAL_TAG_HUNG) {
              angle += dampedSwing(sinceSeal - SEAL_TAG_HUNG, 17, 640, 430) * (1 - align);
            }
            const turn = Math.sin(Math.PI * progress(sinceFinale, 0, 520));
            facing = lerp(rest.facing, 1, easeInOut(progress(sinceFinale, 120, 760))) * (1 - 0.45 * turn);
          }
        }
        const tagVisual: TagVisual = {
          key: `${index}`,
          pose,
          color: bottle[0],
          angle,
          facing,
          drop,
          loop,
        };
        tags.push(<Tag key={`tag${index}`} visual={tagVisual} />);
      }
    });
  }

  const scale = layout?.scale ?? 1;
  const boxWidth = layout ? layout.width * scale : 0;
  const boxHeight = layout ? layout.height * scale : 0;
  const viewBox = layout ? `0 0 ${layout.width} ${layout.height}` : "0 0 1 1";
  const svgClass = "pointer-events-none absolute inset-0 overflow-visible";

  return (
    <div ref={containerRef} className="relative size-full">
      {layout && size && (
        <div
          className="absolute"
          style={{
            left: (size.width - boxWidth) / 2,
            top: (size.height - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight,
          }}
        >
          <svg className={svgClass} width={boxWidth} height={boxHeight} viewBox={viewBox} aria-hidden="true">
            {gloss > 0 && (
              <ellipse
                cx={layout.width / 2}
                cy={layout.height / 2}
                rx={layout.width * 0.62}
                ry={layout.height * 0.5}
                fill="url(#lbl-aura)"
                opacity={(gloss * 0.85).toFixed(2)}
              />
            )}
          </svg>
          <svg className={svgClass} width={boxWidth} height={boxHeight} viewBox={viewBox} aria-hidden="true">
            <RackBack layout={layout} />
          </svg>
          <svg className={svgClass} width={boxWidth} height={boxHeight} viewBox={viewBox} aria-hidden="true">
            {caustics}
            {rackTubes}
          </svg>
          <svg className={svgClass} width={boxWidth} height={boxHeight} viewBox={viewBox} aria-hidden="true">
            <RackFront layout={layout} />
          </svg>
          <svg className={svgClass} width={boxWidth} height={boxHeight} viewBox={viewBox} aria-hidden="true">
            {gloss > 0 && <WoodSheen layout={layout} sheen={sheen} gloss={gloss} />}
            {tags}
            {topTubes}
            {streams}
          </svg>
          {state.map((bottle, index) => {
            const slot = layout.slots[index];
            if (!slot) {
              return null;
            }
            const contents =
              bottle.length === 0
                ? "空"
                : bottle.map((color) => getWaterColorView(color).name).join("、");
            return (
              <button
                key={`b${index}`}
                type="button"
                aria-label={`ボトル ${index + 1}: ${contents}`}
                aria-pressed={index === sourceBottleIndex}
                disabled={interactionDisabled}
                onClick={() => {
                  if (!interactionDisabled) {
                    onSelectBottle(index);
                  }
                }}
                className="absolute cursor-pointer touch-manipulation rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6a3c]/70"
                style={{
                  left: (slot.cx - layout.spacing / 2) * scale,
                  top: (slot.ty - 24) * scale,
                  width: layout.spacing * scale,
                  height: 240 * scale,
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

type WoodSheenProps = { layout: RackLayout; sheen: number; gloss: number };

function WoodSheen({ layout, sheen, gloss }: WoodSheenProps) {
  const surfaces = woodSurfaces(layout);
  const bandCenter = lerp(-0.3, 1.3, sheen) * layout.width;
  return (
    <g>
      <defs>
        <linearGradient id="lbl-sheen" gradientUnits="userSpaceOnUse" x1={bandCenter - 90} x2={bandCenter + 90} y1="0" y2="60">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fffaf0" stopOpacity={sheen > 0 && sheen < 1 ? 0.75 : 0} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lbl-gloss" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff8e8" stopOpacity=".7" />
          <stop offset=".45" stopColor="#fff8e8" stopOpacity=".12" />
          <stop offset="1" stopColor="#fff8e8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {surfaces.map((surface) => (
        <g key={`${surface.x}-${surface.y}`}>
          <rect x={surface.x} y={surface.y} width={surface.w} height={surface.h} rx="1.5" fill="url(#lbl-gloss)" opacity={(gloss * (surface.kind === "post" ? 0.35 : 0.55)).toFixed(2)} />
          <rect x={surface.x} y={surface.y} width={surface.w} height={surface.h} rx="1.5" fill="url(#lbl-sheen)" />
        </g>
      ))}
    </g>
  );
}

export function Background() {
  return (
    <div
      className="size-full"
      style={{
        background:
          "radial-gradient(70% 45% at 22% 18%, rgba(255,251,242,0.85) 0%, rgba(255,251,242,0) 70%), radial-gradient(120% 85% at 35% 38%, #eef1f2 0%, #e3e8eb 55%, #d4dbe0 100%)",
      }}
    />
  );
}

/** 封と完成に合わせて自分で音を鳴らすので、今の効果音は止める。 */
export const muteDefaultSounds = true;

