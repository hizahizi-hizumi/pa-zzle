// 試作 glass: 演出の時間割と、ある時刻の試験管の姿を求める計算。
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";

import { angleForVolume, heightOfUnits, RO, volumeOfUnits } from "./geometry";
import type { RackLayout } from "./rack";
import type { Joint, Run, TubeView, Xf } from "./Tube";
import { xfApply } from "./Tube";

export type Vec = readonly [number, number];
export type Pose = { lift: number; tilt: number };

export const REST: Pose = { lift: 0, tilt: 0 };
export const LIFTED: Pose = { lift: 22, tilt: 6 };

/** 注ぐ演出の時刻（ms）。今の効果音（水が流れる 608〜1152ms）に合わせる。 */
export const POUR = {
  streamStart: 600,
  streamEnd: 1150,
  landed: 1600,
  seamGone: 1650,
  corkStart: 1280,
  corkSeated: 1500,
  glintStart: 1230,
  glintEnd: 1780,
  end: 2400,
  finaleStart: 1750,
} as const;
export const FINALE_DURATION = 1500;
const POSE_LIFT_MS = 260;
const POSE_DROP_MS = 230;
const SLOSH_MS = 1500;
const SHAKE_MS = 560;
const MAX_POUR_ANGLE = 118;

export type PourFx = {
  kind: "pour";
  start: number;
  src: number;
  dst: number;
  color: number;
  amount: number;
  srcBefore: WaterSortBottle;
  srcAfter: WaterSortBottle;
  dstBefore: WaterSortBottle;
  dstAfter: WaterSortBottle;
  side: 1 | -1;
  w0: Vec;
  a0: number;
  isMerge: boolean;
  completes: boolean;
  empties: boolean;
  clearing: boolean;
};
export type PoseFx = {
  kind: "pose";
  start: number;
  tube: number;
  from: Pose;
  to: Pose;
  dur: number;
};
export type SloshFx = { kind: "slosh"; start: number; tube: number; amp: number };
/** 通らなかった操作の返し。target は押した管（横に首を振る）、source は選んでいた管（持ち上げたまま傾きを振る）。 */
export type ShakeFx = { kind: "shake"; start: number; tube: number; role: "target" | "source" };
export type FinaleFx = { kind: "finale"; start: number };
export type Fx = PourFx | PoseFx | SloshFx | ShakeFx | FinaleFx;

export function fxEnd(fx: Fx): number {
  switch (fx.kind) {
    case "pour":
      return fx.start + POUR.end;
    case "pose":
      return fx.start + fx.dur;
    case "slosh":
      return fx.start + SLOSH_MS;
    case "shake":
      return fx.start + SHAKE_MS;
    case "finale":
      return fx.start + FINALE_DURATION;
  }
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}
function easeOutCubic(t: number) {
  return 1 - (1 - clamp01(t)) ** 3;
}
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}
function easeOutBack(t: number) {
  const x = clamp01(t);
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export function toRuns(bottle: WaterSortBottle): Run[] {
  const runs: Run[] = [];
  for (const color of bottle) {
    const last = runs[runs.length - 1];
    if (last && last.color === color) last.units += 1;
    else runs.push({ color, units: 1 });
  }
  return runs;
}

const restingMix = (i: number): Joint => ({
  kind: "mix",
  width: 5.5,
  amp: 0,
  phase: i,
});

function restingJoints(runs: readonly Run[]): (Joint | undefined)[] {
  return runs.map((_, i) => (i === 0 ? undefined : restingMix(i)));
}

export function tubeColumn(layout: RackLayout, i: number) {
  return i % layout.columns;
}
export function tubeRow(layout: RackLayout, i: number) {
  return Math.floor(i / layout.columns);
}
export function tubeRestX(layout: RackLayout, i: number) {
  return layout.tubeX(tubeColumn(layout, i));
}
export function tubeRestTop(layout: RackLayout, i: number) {
  return layout.tierTops[tubeRow(layout, i)] ?? 0;
}

const POSE_PIVOT_Y = 30;

export function poseXf(layout: RackLayout, i: number, pose: Pose): Xf {
  return {
    wx: tubeRestX(layout, i),
    wy: tubeRestTop(layout, i) + POSE_PIVOT_Y - pose.lift,
    pvx: 0,
    pvy: POSE_PIVOT_Y,
    a: pose.tilt,
  };
}

function lipLocal(side: 1 | -1): Vec {
  return [side * (RO + 1), 1.5];
}

function lipXf(w: Vec, side: 1 | -1, a: number): Xf {
  const [pvx, pvy] = lipLocal(side);
  return { wx: w[0], wy: w[1], pvx, pvy, a };
}

export function lipWorld(xf: Xf, side: 1 | -1): Vec {
  const [x, y] = lipLocal(side);
  return xfApply(xf, x, y);
}

export function currentPose(
  fxs: readonly Fx[],
  i: number,
  selected: boolean,
  now: number,
): Pose {
  let latest: PoseFx | null = null;
  for (const fx of fxs) {
    if (fx.kind === "pose" && fx.tube === i && (!latest || fx.start >= latest.start)) latest = fx;
  }
  if (latest && now < latest.start + latest.dur) {
    const t = (now - latest.start) / latest.dur;
    const lifting = latest.to.lift > latest.from.lift;
    const e = lifting ? easeOutBack(t) : easeInOutCubic(t);
    return {
      lift: lerp(latest.from.lift, latest.to.lift, e),
      tilt: lerp(latest.from.tilt, latest.to.tilt, e),
    };
  }
  return selected ? LIFTED : REST;
}

export function createPoseFx(tube: number, from: Pose, to: Pose, now: number): PoseFx {
  return {
    kind: "pose",
    start: now,
    tube,
    from,
    to,
    dur: to.lift > from.lift ? POSE_LIFT_MS : POSE_DROP_MS,
  };
}

function sloshAt(fxs: readonly Fx[], i: number, now: number): number {
  let total = 0;
  for (const fx of fxs) {
    if (fx.kind === "slosh" && fx.tube === i) {
      const t = now - fx.start;
      if (t >= 0 && t < SLOSH_MS) total += fx.amp * Math.exp(-t / 360) * Math.sin((2 * Math.PI * t) / 320);
    }
    if (fx.kind === "shake" && fx.tube === i) {
      const t = now - fx.start;
      if (t >= 0 && t < SHAKE_MS) total += 13 * Math.exp(-t / 170) * Math.sin((2 * Math.PI * (t + 40)) / 230);
    }
  }
  return total;
}

function shakeAt(fxs: readonly Fx[], i: number, now: number) {
  const out = { dx: 0, tilt: 0, corkSink: 0, reject: 0 };
  for (const fx of fxs) {
    if (fx.kind !== "shake" || fx.tube !== i) continue;
    const t = now - fx.start;
    if (t < 0 || t >= SHAKE_MS) continue;
    const decay = Math.exp(-t / 150);
    if (fx.role === "target") {
      out.dx += 7 * decay * Math.sin((2 * Math.PI * t) / 150);
      out.corkSink = t < 360 ? 3.2 * Math.sin((Math.PI * t) / 360) : 0;
    } else {
      out.tilt += -7 * decay * Math.sin((2 * Math.PI * t) / 190);
      out.dx += 2.5 * decay * Math.sin((2 * Math.PI * t) / 190);
    }
    out.reject = Math.max(out.reject, 1 - clamp01((t - 120) / 420));
  }
  return out;
}

function finaleSheen(fxs: readonly Fx[], layout: RackLayout, i: number, now: number) {
  for (const fx of fxs) {
    if (fx.kind === "finale") {
      const delay = tubeColumn(layout, i) * 70 + tubeRow(layout, i) * 110;
      return clamp01((now - fx.start - delay) / 650);
    }
  }
  return undefined;
}

function pourGeometry(layout: RackLayout, fx: PourFx) {
  const destX = tubeRestX(layout, fx.dst);
  const destTop = tubeRestTop(layout, fx.dst);
  const P: Vec = [destX - fx.side * 2, destTop - 10];
  const rest = lipWorld(poseXf(layout, fx.src, REST), fx.side);
  const totalBefore = fx.srcBefore.length;
  const aStart = fx.side * Math.max(0, angleForVolume(volumeOfUnits(totalBefore)) - 1);
  const aEnd = fx.side * Math.min(MAX_POUR_ANGLE, angleForVolume(volumeOfUnits(fx.srcAfter.length)) + 3);
  return { destX, destTop, P, rest, aStart, aEnd, totalBefore };
}

/** 注いでいる注ぎ元の姿。注ぎ終えて置き場へ戻った後は null。 */
export function pourSourceView(layout: RackLayout, fx: PourFx, now: number) {
  const t = now - fx.start;
  if (t >= POUR.landed) return null;
  const g = pourGeometry(layout, fx);
  let w: Vec;
  let a: number;
  let movedUnits = 0;
  if (t < POUR.streamStart) {
    const e = easeInOutCubic(t / 540);
    w = [lerp(fx.w0[0], g.P[0], e), lerp(fx.w0[1], g.P[1], e) - 34 * Math.sin(Math.PI * e)];
    a = lerp(fx.a0, g.aStart, easeInOutCubic(t / POUR.streamStart));
  } else if (t < POUR.streamEnd) {
    const q = easeInOutSine((t - POUR.streamStart) / (POUR.streamEnd - POUR.streamStart));
    movedUnits = fx.amount * q;
    w = g.P;
    const remaining = g.totalBefore - movedUnits;
    a =
      fx.side *
      Math.min(MAX_POUR_ANGLE, Math.max(Math.abs(g.aStart), angleForVolume(volumeOfUnits(remaining)) + 3 * q));
  } else {
    movedUnits = fx.amount;
    const e = easeInOutCubic((t - POUR.streamEnd) / (POUR.landed - POUR.streamEnd));
    w = [lerp(g.P[0], g.rest[0], e), lerp(g.P[1], g.rest[1], e) - 26 * Math.sin(Math.PI * e)];
    a = lerp(g.aEnd, 0, e);
  }
  const runs = toRuns(fx.srcBefore);
  const top = runs[runs.length - 1];
  if (top) top.units = Math.max(0, top.units - movedUnits);
  const visibleRuns = runs.filter((run) => run.units > 0.0005);
  const film =
    fx.empties && t > POUR.streamEnd - 120 ? { color: fx.color, opacity: 1 } : undefined;
  const view: TubeView = {
    xf: lipXf(w, fx.side, a),
    runs: visibleRuns,
    joints: restingJoints(visibleRuns),
    slosh: 0,
    droplets: fx.empties ? clamp01((t - POUR.streamEnd) / 400) : 0,
    film,
    cork: null,
  };
  return view;
}

/** 水の筋（世界座標）。流れていないときは null。 */
export function pourStream(layout: RackLayout, fx: PourFx, now: number) {
  const t = now - fx.start;
  if (t < POUR.streamStart || t > POUR.streamEnd + 90) return null;
  const g = pourGeometry(layout, fx);
  const pd = destFill(t);
  const surfaceY = g.destTop + heightOfUnits(fx.dstBefore.length + fx.amount * pd) - 1;
  const head = lerp(g.P[1], surfaceY, clamp01((t - POUR.streamStart) / 70));
  const tail = lerp(g.P[1], surfaceY, clamp01((t - POUR.streamEnd) / 90));
  const width = 5.4 * (1 - 0.55 * clamp01((t - POUR.streamEnd + 90) / 90)) * (0.6 + 0.4 * clamp01((t - POUR.streamStart) / 60));
  return { x: g.P[0], top: tail, bottom: head, width, color: fx.color, surfaceY };
}

function destFill(t: number) {
  return easeInOutSine((t - POUR.streamStart - 40) / (POUR.streamEnd - POUR.streamStart - 20));
}

/** 注ぎ先の姿の上書き。演出が済んでいれば null。 */
function pourDestView(layout: RackLayout, fx: PourFx, now: number, base: TubeView): TubeView | null {
  const t = now - fx.start;
  if (t >= POUR.end) return null;
  const g = pourGeometry(layout, fx);
  const beforeTotal = fx.dstBefore.length;
  const pd = destFill(t);
  const view: TubeView = { ...base };

  if (t < POUR.seamGone || !fx.isMerge) {
    const runs = toRuns(fx.dstBefore);
    const joints = restingJoints(runs);
    if (pd > 0) {
      runs.push({ color: fx.color, units: fx.amount * pd });
      if (runs.length > 1) {
        if (fx.isMerge) {
          const fadeIn = clamp01((t - POUR.streamStart - 40) / 120);
          const fadeOut = 1 - easeOutCubic((t - POUR.streamEnd) / (POUR.seamGone - POUR.streamEnd));
          joints.push({
            kind: "seam",
            opacity: Math.min(fadeIn, fadeOut),
            amp: 0.7 + 2.6 * clamp01((t - POUR.streamEnd + 80) / 480),
            phase: t / 85,
          });
        } else {
          const settle = easeOutCubic((t - POUR.streamEnd) / 520);
          joints.push({
            kind: "mix",
            width: lerp(15, 5.5, settle),
            amp: 2.4 * (1 - settle),
            phase: t / 100,
          });
        }
      } else {
        joints.push(undefined);
      }
    }
    view.runs = runs;
    view.joints = joints;
  }

  if (beforeTotal > 0) {
    const ghostOpacity = fx.isMerge
      ? 0.95 * (1 - clamp01((t - 1050) / 450))
      : 0.9 * (1 - clamp01((t - POUR.streamStart - 40) / 220));
    if (ghostOpacity > 0 && t > POUR.streamStart) {
      view.ghost = {
        units: beforeTotal,
        amp: fx.isMerge ? 0.3 + 2.8 * clamp01((t - 700) / 650) : 0.6,
        opacity: ghostOpacity,
        phase: t / 65,
      };
    }
  }

  if (t > POUR.streamStart) {
    const freshOpacity =
      t < POUR.streamEnd
        ? clamp01((t - POUR.streamStart - 40) / 150)
        : 1 - clamp01((t - POUR.streamEnd) / 600);
    if (freshOpacity > 0) {
      view.fresh = { fromUnits: beforeTotal, opacity: freshOpacity, t: t / 1000 };
    }
  }

  if (t > POUR.streamStart && t < POUR.streamEnd + 250) {
    view.splash = { x: g.P[0] - g.destX, p: clamp01((t - POUR.streamStart - 40) / (POUR.streamEnd - POUR.streamStart + 200)) };
    view.slosh += 1.6 * Math.sin(t / 45) * clamp01((t - POUR.streamStart) / 120) * (1 - clamp01((t - POUR.streamEnd) / 250));
  }

  if (fx.isMerge || fx.completes) {
    const afterRuns = toRuns(fx.dstAfter);
    const topRun = afterRuns[afterRuns.length - 1];
    if (topRun) {
      const toUnits = fx.dstAfter.length;
      view.glint = {
        fromUnits: toUnits - topRun.units,
        toUnits,
        p: clamp01((t - POUR.glintStart) / (POUR.glintEnd - POUR.glintStart)),
      };
    }
  }

  if (fx.completes) {
    if (t < POUR.corkStart) {
      view.cork = null;
      view.glow = null;
    } else if (t < POUR.corkSeated) {
      const e = clamp01((t - POUR.corkStart) / (POUR.corkSeated - POUR.corkStart));
      view.cork = { y: -52 * (1 - e * e) };
      view.glow = null;
    } else {
      const b = (t - POUR.corkSeated) / 170;
      view.cork = { y: b < 1 ? 2.2 * Math.sin(Math.PI * b) : 0 };
    }
  }
  return view;
}

export type BoardScene = {
  views: (TubeView | null)[];
  overlay: { tube: number; view: TubeView }[];
  streams: NonNullable<ReturnType<typeof pourStream>>[];
  lifts: number[];
  finale: number | null;
};

export function buildScene(
  layout: RackLayout,
  state: readonly WaterSortBottle[],
  selected: number | null,
  fxs: readonly Fx[],
  now: number,
): BoardScene {
  const views: (TubeView | null)[] = [];
  const overlay: { tube: number; view: TubeView }[] = [];
  const streams: NonNullable<ReturnType<typeof pourStream>>[] = [];
  const lifts: number[] = [];
  const pours = fxs.filter((fx): fx is PourFx => fx.kind === "pour");
  const raised: { tube: number; view: TubeView }[] = [];

  state.forEach((bottle, i) => {
    const complete = isCompleteWaterSortBottle(bottle);
    const pose = currentPose(fxs, i, selected === i, now);
    const shake = shakeAt(fxs, i, now);
    const runs = toRuns(bottle);
    const xf = poseXf(layout, i, pose);
    xf.wx += shake.dx;
    xf.a += shake.tilt;
    let view: TubeView = {
      xf,
      runs,
      joints: restingJoints(runs),
      slosh: sloshAt(fxs, i, now),
      droplets: 0,
      cork: complete ? { y: shake.corkSink } : null,
      glow: complete ? (bottle[0] ?? null) : null,
      sheen: finaleSheen(fxs, layout, i, now),
      reject: shake.reject,
    };
    lifts.push(pose.lift);

    const asSource = pours.find((fx) => fx.src === i);
    if (asSource) {
      const moving = pourSourceView(layout, asSource, now);
      if (moving) {
        overlay.push({ tube: i, view: moving });
        const stream = pourStream(layout, asSource, now);
        if (stream) streams.push(stream);
        views.push(null);
        lifts[i] = 999;
        return;
      }
      if (asSource.empties) {
        const t = now - asSource.start;
        const filmOpacity = 1 - clamp01((t - POUR.landed - 50) / 650);
        view = {
          ...view,
          film: filmOpacity > 0 ? { color: asSource.color, opacity: filmOpacity } : undefined,
          droplets: t < 2000 ? 1 : 1 - clamp01((t - 2000) / 400),
        };
      }
    }
    const asDest = pours.find((fx) => fx.dst === i);
    if (asDest) {
      view = pourDestView(layout, asDest, now, view) ?? view;
    }
    // 持ち上げた管は、穴の前板に液面が隠れないよう、立ての前に描く。
    // 注ぐ管が飛んでいる間に通らなかった管は、飛ぶ管に隠れないよう、その上に描く。
    if (pose.lift > 0.5 || (shake.reject > 0 && pours.some((fx) => now - fx.start < POUR.landed))) {
      raised.push({ tube: i, view });
      views.push(null);
      return;
    }
    views.push(view);
  });

  overlay.push(...raised);
  const finaleFx = fxs.find((fx): fx is FinaleFx => fx.kind === "finale");
  return {
    views,
    overlay,
    streams,
    lifts,
    finale: finaleFx ? clamp01((now - finaleFx.start) / FINALE_DURATION) : null,
  };
}
