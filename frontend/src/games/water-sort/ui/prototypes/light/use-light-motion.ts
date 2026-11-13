import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import { prefersReducedMotion } from "@/lib/motion";

export const POUR_MS = 1180;
/** 注ぎの流れが出ている間（注ぐ動きの長さに対する割合） */
export const FLOW_START = 0.33;
export const FLOW_END = 0.7;
export const SHAKE_MS = 560;
export const REVEAL_MS = 1100;
export const CORK_MS = 520;
export const FINALE_MS = 1900;

export type PourMotion = {
  id: number;
  src: number;
  dst: number;
  srcBefore: readonly number[];
  srcAfter: readonly number[];
  dstBefore: readonly number[];
  dstAfter: readonly number[];
  color: number;
  amount: number;
  start: number;
  startLift: number;
  isClearing: boolean;
  corked: boolean;
};

type Timed = { bottle: number; start: number };
/** 通らなかった揺れ。target はタップした管、source は選んだまま残る管。 */
type Shake = Timed & { role: "target" | "source"; toward: number };

type Model = {
  now: number;
  last: number;
  pours: PourMotion[];
  shakes: Shake[];
  reveals: Timed[];
  corks: Timed[];
  finaleStart: number | null;
  finaleNotified: boolean;
  lifts: number[];
  dim: number;
  active: boolean;
};

export type MotionSnapshot = Readonly<Model>;

type UseLightMotionOptions = {
  bottleCount: number;
  operation: WaterSortOperation | null;
  sourceBottleIndex: number | null;
  deadlocked: boolean;
  onActivityChange?: (active: boolean) => void;
  onClearAnimationComplete?: () => void;
};

export function useLightMotion({
  bottleCount,
  operation,
  sourceBottleIndex,
  deadlocked,
  onActivityChange,
  onClearAnimationComplete,
}: UseLightMotionOptions) {
  const model = useRef<Model>({
    now: 0,
    last: 0,
    pours: [],
    shakes: [],
    reveals: [],
    corks: [],
    finaleStart: null,
    finaleNotified: false,
    lifts: Array.from({ length: bottleCount }, () => 0),
    dim: deadlocked ? 1 : 0,
    active: false,
  });
  const [, setFrame] = useState(0);
  const raf = useRef<number | null>(null);
  const latest = useRef({
    sourceBottleIndex,
    deadlocked,
    onActivityChange,
    onClearAnimationComplete,
  });
  latest.current = {
    sourceBottleIndex,
    deadlocked,
    onActivityChange,
    onClearAnimationComplete,
  };
  const processed = useRef(new Set<number>());

  const step = useCallback((time: number) => {
    raf.current = null;
    const m = model.current;
    const dt = m.last ? Math.min(64, time - m.last) : 16;
    m.last = time;
    m.now = time;
    const { sourceBottleIndex: source, deadlocked: dead } = latest.current;

    let moving = false;
    const liftK = 1 - Math.exp(-dt / 70);
    for (let i = 0; i < m.lifts.length; i += 1) {
      const target = i === source ? 1 : 0;
      const value = m.lifts[i] ?? 0;
      const next = value + (target - value) * liftK;
      m.lifts[i] = Math.abs(target - next) < 0.002 ? target : next;
      if (m.lifts[i] !== target) moving = true;
    }

    const remaining: PourMotion[] = [];
    for (const pour of m.pours) {
      const t = (time - pour.start) / POUR_MS;
      if (!pour.corked && t >= FLOW_END) {
        pour.corked = true;
        if (isCompleteWaterSortBottle(pour.dstAfter)) {
          m.corks.push({ bottle: pour.dst, start: time });
        }
        if (pour.isClearing) {
          m.finaleStart = time + 60;
        }
      }
      if (t >= 1) {
        const top = pour.srcAfter[pour.srcAfter.length - 1];
        if (top !== undefined && top !== pour.color) {
          m.reveals.push({ bottle: pour.src, start: time });
        }
        continue;
      }
      remaining.push(pour);
    }
    m.pours = remaining;
    const dimTarget = dead && m.pours.length === 0 ? 1 : 0;
    const dimNext = m.dim + (dimTarget - m.dim) * (1 - Math.exp(-dt / 380));
    m.dim = Math.abs(dimTarget - dimNext) < 0.003 ? dimTarget : dimNext;
    if (m.dim !== dimTarget) moving = true;
    m.shakes = m.shakes.filter((s) => time - s.start < SHAKE_MS);
    m.reveals = m.reveals.filter((s) => time - s.start < REVEAL_MS);
    m.corks = m.corks.filter((s) => time - s.start < CORK_MS);

    let finaleRunning = false;
    if (m.finaleStart !== null && !m.finaleNotified) {
      finaleRunning = true;
      if (time - m.finaleStart >= FINALE_MS) {
        m.finaleNotified = true;
        latest.current.onClearAnimationComplete?.();
      }
    }

    const pouring = m.pours.length > 0;
    if (pouring !== m.active) {
      m.active = pouring;
      latest.current.onActivityChange?.(pouring);
    }

    setFrame((n) => n + 1);
    if (
      moving ||
      pouring ||
      finaleRunning ||
      m.shakes.length > 0 ||
      m.reveals.length > 0 ||
      m.corks.length > 0
    ) {
      raf.current = requestAnimationFrame(step);
    }
  }, []);

  const ensureLoop = useCallback(() => {
    if (raf.current === null) {
      model.current.last = 0;
      raf.current = requestAnimationFrame(step);
    }
  }, [step]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    },
    [],
  );

  if (model.current.lifts.length !== bottleCount) {
    model.current.lifts = Array.from({ length: bottleCount }, () => 0);
  }

  useLayoutEffect(() => {
    const m = model.current;
    if (!operation) {
      processed.current.clear();
      m.pours = [];
      m.shakes = [];
      m.reveals = [];
      m.corks = [];
      m.finaleStart = null;
      m.finaleNotified = false;
      if (m.active) {
        m.active = false;
        latest.current.onActivityChange?.(false);
      }
      setFrame((n) => n + 1);
      return;
    }
    if (processed.current.has(operation.id)) return;
    processed.current.add(operation.id);
    const now = performance.now();
    if (operation.type === "invalid") {
      if (!prefersReducedMotion()) {
        const source = latest.current.sourceBottleIndex;
        m.shakes = m.shakes.filter(
          (s) => s.bottle !== operation.bottleIndex && s.bottle !== source,
        );
        m.shakes.push({
          bottle: operation.bottleIndex,
          start: now,
          role: "target",
          toward: operation.bottleIndex,
        });
        if (source !== null && source !== operation.bottleIndex) {
          m.shakes.push({
            bottle: source,
            start: now + 40,
            role: "source",
            toward: operation.bottleIndex,
          });
        }
      }
      ensureLoop();
      return;
    }
    if (operation.type !== "poured") {
      ensureLoop();
      return;
    }
    const { sourceBottleIndex: src, destinationBottleIndex: dst } = operation;
    const srcBefore = operation.stateBefore[src] ?? [];
    const srcAfter = operation.stateAfter[src] ?? [];
    const color = srcBefore[srcBefore.length - 1];
    if (prefersReducedMotion() || color === undefined) {
      m.lifts[src] = 0;
      if (operation.isClearingMove) {
        latest.current.onClearAnimationComplete?.();
      }
      setFrame((n) => n + 1);
      return;
    }
    m.pours = m.pours.filter(
      (p) => p.src !== src && p.dst !== src && p.src !== dst && p.dst !== dst,
    );
    m.reveals = m.reveals.filter((r) => r.bottle !== src && r.bottle !== dst);
    m.pours.push({
      id: operation.id,
      src,
      dst,
      srcBefore,
      srcAfter,
      dstBefore: operation.stateBefore[dst] ?? [],
      dstAfter: operation.stateAfter[dst] ?? [],
      color,
      amount: srcBefore.length - srcAfter.length,
      start: now,
      startLift: m.lifts[src] ?? 0,
      isClearing: operation.isClearingMove,
      corked: false,
    });
    m.lifts[src] = 0;
    ensureLoop();
  }, [operation, ensureLoop]);

  useLayoutEffect(() => {
    void sourceBottleIndex;
    void deadlocked;
    ensureLoop();
  }, [sourceBottleIndex, deadlocked, ensureLoop]);

  /** そのボトルが関わる注ぐ動きを、すぐ終えた姿にする。 */
  const settleBottle = useCallback(
    (bottleIndex: number) => {
      const m = model.current;
      const hit = m.pours.filter(
        (p) => p.src === bottleIndex || p.dst === bottleIndex,
      );
      if (hit.length === 0) return;
      for (const pour of hit) {
        if (!pour.corked && isCompleteWaterSortBottle(pour.dstAfter)) {
          m.corks.push({ bottle: pour.dst, start: performance.now() });
        }
        if (!pour.corked && pour.isClearing) {
          m.finaleStart = performance.now();
        }
      }
      m.pours = m.pours.filter((p) => !hit.includes(p));
      ensureLoop();
    },
    [ensureLoop],
  );

  return { snapshot: model.current as MotionSnapshot, settleBottle };
}
