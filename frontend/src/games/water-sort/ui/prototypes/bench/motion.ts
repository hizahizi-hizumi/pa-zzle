// 試作 bench の動き。盤面の出来事（持ち上げ・注ぎ・跳ね返り・栓・完成）と、その時刻の試験管の姿勢を決める。
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  angleForVolume,
  type BenchLayout,
  centerForPoint,
  clamp01,
  easeIn,
  easeInOut,
  easeInOutSine,
  easeOut,
  easeOutBack,
  INSERT_HEIGHT,
  LIFT,
  lerp,
  PIVOT_Y,
  type Pose,
  RIM,
  SINK,
  volumeOfUnits,
} from "@/games/water-sort/ui/prototypes/bench/geometry";
import type { LiquidSegment } from "@/games/water-sort/ui/prototypes/bench/TubeArt";

export const POUR_MS = 1600;
/** 注ぐ動きの区切り。今の効果音（泡の音・クリア音）の鳴る時刻に合わせる。 */
export const POUR_TRANSFER_START = 0.38;
export const POUR_TRANSFER_END = 0.72;
const POUR_RETURN_INSERT = 0.93;
export const LIFT_UP_MS = 280;
export const LIFT_DOWN_MS = 320;
export const BUMP_MS = 600;
export const RATTLE_MS = 360;
export const CORK_MS = 620;
/** 注ぎ始めから栓が落ち始めるまで。 */
export const CORK_DELAY_MS = 1180;
export const CLEAR_MS = 2600;

export type PourEvent = {
  kind: "pour";
  id: number;
  start: number;
  source: number;
  dest: number;
  sourceBefore: WaterSortBottle;
  sourceAfter: WaterSortBottle;
  destBefore: WaterSortBottle;
  color: number;
  amount: number;
  dir: 1 | -1;
  startPose: Pose;
};
export type LiftEvent = {
  kind: "lift";
  start: number;
  bottle: number;
  up: boolean;
};
export type BumpEvent = {
  kind: "bump";
  start: number;
  source: number;
  dest: number;
  dir: 1 | -1;
  startPose: Pose;
};
export type RattleEvent = { kind: "rattle"; start: number; bottle: number };
export type CorkEvent = { kind: "cork"; start: number; bottle: number };
export type ClearEvent = { kind: "clear"; start: number };
export type BenchEvent =
  | PourEvent
  | LiftEvent
  | BumpEvent
  | RattleEvent
  | CorkEvent
  | ClearEvent;

export function eventDuration(event: BenchEvent): number {
  switch (event.kind) {
    case "pour":
      return POUR_MS;
    case "lift":
      return event.up ? LIFT_UP_MS : LIFT_DOWN_MS;
    case "bump":
      return BUMP_MS;
    case "rattle":
      return RATTLE_MS;
    case "cork":
      return CORK_MS;
    case "clear":
      return CLEAR_MS;
  }
}

export function eventInvolves(event: BenchEvent, bottle: number): boolean {
  switch (event.kind) {
    case "pour":
    case "bump":
      return event.source === bottle || event.dest === bottle;
    case "lift":
    case "rattle":
    case "cork":
      return event.bottle === bottle;
    case "clear":
      return false;
  }
}

export function toSegments(bottle: readonly number[]): LiquidSegment[] {
  const segments: LiquidSegment[] = [];
  for (const color of bottle) {
    const last = segments[segments.length - 1];
    if (last && last.color === color) last.units += 1;
    else segments.push({ color, units: 1 });
  }
  return segments;
}

function addUnits(
  segments: LiquidSegment[],
  color: number,
  units: number,
): LiquidSegment[] {
  if (units <= 0) return segments;
  const copy = segments.map((s) => ({ ...s }));
  const last = copy[copy.length - 1];
  if (last && last.color === color) last.units += units;
  else copy.push({ color, units });
  return copy;
}

// ---- 姿勢 ----

export function restPose(layout: BenchLayout, index: number, sink = 0): Pose {
  const slot = layout.slots[index];
  return {
    x: slot?.x ?? 0,
    y: (slot?.y ?? 0) + (PIVOT_Y + sink) * layout.k,
    angle: 0,
    scale: 1,
    layer: "rack",
  };
}

function insertPose(layout: BenchLayout, index: number): Pose {
  const rest = restPose(layout, index);
  return { ...rest, y: rest.y - INSERT_HEIGHT * layout.k };
}

export function liftedPose(layout: BenchLayout, index: number): Pose {
  const rest = restPose(layout, index);
  const leanTowardCenter = rest.x < layout.width / 2 ? 2.5 : -2.5;
  return {
    x: rest.x,
    y: rest.y - LIFT * layout.k,
    angle: leanTowardCenter,
    scale: 1.06,
    layer: "front",
  };
}

function mixPose(a: Pose, b: Pose, t: number, layer: Pose["layer"]): Pose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    angle: lerp(a.angle, b.angle, t),
    scale: lerp(a.scale, b.scale, t),
    layer,
  };
}

export function liftPose(
  layout: BenchLayout,
  event: LiftEvent,
  now: number,
): Pose {
  const insert = insertPose(layout, event.bottle);
  const rest = restPose(layout, event.bottle);
  const lifted = liftedPose(layout, event.bottle);
  if (event.up) {
    const t = clamp01((now - event.start) / LIFT_UP_MS);
    if (t < 0.32) return mixPose(rest, insert, easeIn(t / 0.32), "rack");
    return mixPose(insert, lifted, easeOutBack((t - 0.32) / 0.68, 1.2), "front");
  }
  const t = clamp01((now - event.start) / LIFT_DOWN_MS);
  if (t < 0.55) return mixPose(lifted, insert, easeInOut(t / 0.55), "front");
  return mixPose(insert, rest, easeOutBack((t - 0.55) / 0.45, 2.2), "rack");
}

function pourPoint(layout: BenchLayout, event: PourEvent) {
  const dest = layout.slots[event.dest];
  const k = layout.k;
  return {
    x: (dest?.x ?? 0) - event.dir * 7 * k,
    y: (dest?.y ?? 0) + (RIM - 15) * k,
  };
}

/** 注ぐときに口として使う縁の局所座標。 */
export function pourLip(dir: 1 | -1): [number, number] {
  return [dir * 25, 3];
}

/**
 * 残りが u 単位のときの傾き。液面が口に届く傾きに、残りが少ないほど口を下へ向ける分を足す。
 * 少ない液が細長く寝た試験管に薄く広がって見えなくならないよう、口の側に溜めて見せる。
 */
function tiltFor(event: PourEvent, units: number) {
  const reachLip = angleForVolume(volumeOfUnits(units));
  const mouthDown = 26 * (1 - units / 4);
  return event.dir * Math.min(118, reachLip + 5 + mouthDown);
}

function poseAtPourPoint(
  layout: BenchLayout,
  event: PourEvent,
  angle: number,
): Pose {
  const p = pourPoint(layout, event);
  const [lx, ly] = pourLip(event.dir);
  const [x, y] = centerForPoint(p.x, p.y, lx, ly, angle, layout.k);
  return { x, y, angle, scale: 1, layer: "front" };
}

export type PourFrame = {
  sourcePose: Pose;
  sourceSegments: LiquidSegment[];
  destSegments: LiquidSegment[];
  /** 注いでいる間の 0〜1。注ぐ前は null。 */
  transfer: number | null;
  /** 戻り始めてからの 0〜1。 */
  settle: number | null;
  stream: { width: number; color: number } | null;
};

export function pourFrame(
  layout: BenchLayout,
  event: PourEvent,
  now: number,
): PourFrame {
  const t = clamp01((now - event.start) / POUR_MS);
  const sourceAfter = toSegments(event.sourceAfter);
  const destBefore = toSegments(event.destBefore);
  const beforeUnits = event.sourceBefore.length;
  const afterUnits = event.sourceAfter.length;
  const startAngle = tiltFor(event, beforeUnits);

  if (t < POUR_TRANSFER_START) {
    const u = easeInOut(t / POUR_TRANSFER_START);
    const target = poseAtPourPoint(layout, event, startAngle);
    const pose = mixPose(event.startPose, target, u, "front");
    pose.y -= Math.sin(Math.PI * u) * 28 * layout.k;
    return {
      sourcePose: pose,
      sourceSegments: toSegments(event.sourceBefore),
      destSegments: destBefore,
      transfer: null,
      settle: null,
      stream: null,
    };
  }
  if (t < POUR_TRANSFER_END) {
    const u = (t - POUR_TRANSFER_START) / (POUR_TRANSFER_END - POUR_TRANSFER_START);
    const f = easeInOutSine(u);
    const moved = event.amount * f;
    const remaining = beforeUnits - moved;
    const angle = tiltFor(event, remaining);
    const ramp = Math.min(1, u / 0.1, (1 - u) / 0.12);
    return {
      sourcePose: poseAtPourPoint(layout, event, angle),
      sourceSegments: addUnits(sourceAfter, event.color, event.amount - moved),
      destSegments: addUnits(destBefore, event.color, moved),
      transfer: u,
      settle: null,
      stream: { width: 1.2 + 3.4 * ramp, color: event.color },
    };
  }
  const endAngle = tiltFor(event, afterUnits);
  const from = poseAtPourPoint(layout, event, endAngle);
  const destAfter = addUnits(destBefore, event.color, event.amount);
  const settle = (t - POUR_TRANSFER_END) / (1 - POUR_TRANSFER_END);
  let pose: Pose;
  if (t < POUR_RETURN_INSERT) {
    const u = easeInOut(
      (t - POUR_TRANSFER_END) / (POUR_RETURN_INSERT - POUR_TRANSFER_END),
    );
    pose = mixPose(from, insertPose(layout, event.source), u, "front");
    pose.y -= Math.sin(Math.PI * u) * 22 * layout.k;
  } else {
    const u = (t - POUR_RETURN_INSERT) / (1 - POUR_RETURN_INSERT);
    pose = mixPose(
      insertPose(layout, event.source),
      restPose(layout, event.source),
      easeOutBack(u, 2),
      "rack",
    );
  }
  return {
    sourcePose: pose,
    sourceSegments: sourceAfter,
    destSegments: destAfter,
    transfer: null,
    settle,
    stream: null,
  };
}

export function bumpPose(
  layout: BenchLayout,
  event: BumpEvent,
  now: number,
): { pose: Pose; destKnock: number } {
  const t = clamp01((now - event.start) / BUMP_MS);
  const k = layout.k;
  const dest = layout.slots[event.dest];
  const angle = event.dir * 34;
  const [lx, ly] = pourLip(event.dir);
  const [cx, cy] = centerForPoint(
    (dest?.x ?? 0) - event.dir * 24 * k,
    (dest?.y ?? 0) + (RIM - 3) * k,
    lx,
    ly,
    angle,
    k,
  );
  const contact: Pose = { x: cx, y: cy, angle, scale: 1, layer: "front" };
  const lifted = liftedPose(layout, event.source);
  if (t < 0.4) {
    return {
      pose: mixPose(event.startPose, contact, easeIn(t / 0.4) ** 0.8, "front"),
      destKnock: 0,
    };
  }
  if (t < 0.58) {
    const u = (t - 0.4) / 0.18;
    const hop = Math.sin(Math.PI * u);
    return {
      pose: {
        ...contact,
        x: contact.x - event.dir * 7 * k * hop,
        y: contact.y - 15 * k * hop,
        angle: contact.angle - event.dir * 6 * hop,
      },
      destKnock: Math.sin(u * Math.PI * 3) * (1 - u) * 2.2,
    };
  }
  return {
    pose: mixPose(contact, lifted, easeOut((t - 0.58) / 0.42), "front"),
    destKnock: 0,
  };
}

export function rattleOffset(event: RattleEvent, now: number): number {
  const t = clamp01((now - event.start) / RATTLE_MS);
  return -7 * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
}

export type CorkFrame = {
  cork: { dy: number; squash: number; opacity: number } | null;
  sink: number;
  glint: number;
  knock: number;
};

export function corkFrame(event: CorkEvent | null, now: number): CorkFrame {
  if (!event) {
    return {
      cork: { dy: 0, squash: 0, opacity: 1 },
      sink: SINK,
      glint: 0,
      knock: 0,
    };
  }
  const t = (now - event.start) / CORK_MS;
  if (t < 0) return { cork: null, sink: 0, glint: 0, knock: 0 };
  const c = clamp01(t);
  const fall = clamp01(c / 0.38);
  const dy = 46 * (1 - easeIn(fall));
  const squashT = clamp01((c - 0.38) / 0.16);
  const squash = c >= 0.38 && c < 0.54 ? Math.sin(Math.PI * squashT) : 0;
  const sinkT = clamp01((c - 0.48) / 0.52);
  const glintT = clamp01((c - 0.44) / 0.56);
  return {
    cork: { dy, squash, opacity: clamp01(c / 0.12) },
    sink: SINK * easeOutBack(sinkT, 1.8),
    glint: Math.sin(Math.PI * glintT) * (c > 0.44 ? 1 : 0),
    knock: squash * 1.6,
  };
}
