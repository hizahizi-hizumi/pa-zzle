import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { getBarLiquidSurface } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { getPouringTiltDeg } from "@/games/water-sort/ui/ideas/bar/tilted-glass";

/** 注ぐ所作1回の長さ。 */
export const BAR_POUR_DURATION_MS = 1600;

/**
 * 注ぐ所作の区切り（長さに対する割合）。
 * グラスを運んで傾け、バースプーンの柄に伝わせて静かに液を重ね、スプーンを抜いて戻す。
 */
export const BAR_POUR_PHASE = {
  arrive: 0.2,
  tilted: 0.32,
  transferStart: 0.36,
  transferEnd: 0.72,
  upright: 0.82,
  spoonIn: 0.1,
  spoonSettled: 0.28,
  spoonOut: 0.76,
  spoonGone: 0.88,
  iceDrop: 0.8,
  iceLand: 0.89,
} as const;

export const BAR_POUR_EASING = {
  travel: "cubic-bezier(.45,0,.25,1)",
  settle: "cubic-bezier(.2,.7,.3,1)",
  linear: "linear",
} as const;

/** 傾けたグラスを画面の端から離しておく間（px）。 */
const SCREEN_MARGIN = 6;
/** 残りがわずかでも、これより深くは傾けない（度）。 */
const MAX_TILT_DEG = 125;

type Point = { x: number; y: number };

/** 注ぎ元の置き方。`pivot` はグラスの口の中心（画面の座標、px）で、グラスはここを軸に傾く。 */
export type BarPourPose = {
  pivot: Point;
  angleDeg: number;
};

export type BarPourPlan = {
  direction: 1 | -1;
  box: { width: number; height: number };
  /** 注ぎ元の液の量（段）。 */
  amountBefore: number;
  amountAfter: number;
  startTiltDeg: number;
  endTiltDeg: number;
  /** 注いでいる間、口の縁を置く所。液はここから柄に乗る。 */
  lip: Point;
  /** グラスの枠の中で見た、口の縁の位置。 */
  lipInBox: Point;
  restPivot: Point;
  liftY: number;
  hoverPivot: Point;
  /** バースプーンの柄の位置と、液が柄に乗る高さ（画面の座標、px）。 */
  spoonX: number;
  streamTopY: number;
  /** スプーンの先を置く液面（注ぐ前と後）。 */
  surfaceBeforeY: number;
  surfaceAfterY: number;
};

function rotate({ x, y }: Point, angleDeg: number): Point {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}

function getLipInBox(width: number, height: number, direction: 1 | -1): Point {
  // 傾けたときに下がる側の、口の内側の角。
  const inset = width * 0.05;
  return { x: direction > 0 ? width - inset : inset, y: height * 0.012 };
}

/** 口の縁を `lip` に置いて `angleDeg` 傾けたときの、グラスの軸。 */
function getPivotForLip(
  lip: Point,
  lipInBox: Point,
  width: number,
  angleDeg: number,
): Point {
  const offset = rotate({ x: lipInBox.x - width / 2, y: lipInBox.y }, angleDeg);
  return { x: lip.x - offset.x, y: lip.y - offset.y };
}

/** 口の縁から見た、傾けたグラスの四隅の広がり。 */
function getReach(
  width: number,
  height: number,
  lipInBox: Point,
  angles: readonly number[],
) {
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ];
  const points = angles.flatMap((angle) =>
    corners.map((corner) =>
      rotate({ x: corner.x - lipInBox.x, y: corner.y - lipInBox.y }, angle),
    ),
  );
  return {
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
  };
}

function getPreferredDirection(animation: PourAnimation): 1 | -1 {
  const { source, destination } = animation;
  const deltaX = destination.rect.left - source.rect.left;
  if (Math.abs(deltaX) > destination.rect.width / 2) {
    return deltaX > 0 ? 1 : -1;
  }
  const center = destination.rect.left + destination.rect.width / 2;
  return center < window.innerWidth / 2 ? -1 : 1;
}

function getTilts(
  box: { width: number; height: number },
  amountBefore: number,
  amountAfter: number,
  direction: 1 | -1,
) {
  const clamp = (angle: number) =>
    direction * Math.min(Math.abs(angle), MAX_TILT_DEG);
  return {
    start: clamp(getPouringTiltDeg(box, amountBefore, direction)),
    end: clamp(getPouringTiltDeg(box, amountAfter, direction)),
  };
}

export function getBarPourPlan(animation: PourAnimation): BarPourPlan {
  const { source, destination } = animation;
  const { width, height } = source.rect;
  const box = { width, height };
  const amountBefore = source.before.length;
  const amountAfter = source.after.length;
  const spoonX = destination.rect.left + destination.rect.width / 2;
  const viewportWidth = window.innerWidth;

  // 胴を倒す側に、傾けたグラスが画面の内側に収まる向きを選ぶ。
  const preferred = getPreferredDirection(animation);
  const candidates = [preferred, -preferred as 1 | -1].map((direction) => {
    const tilts = getTilts(box, amountBefore, amountAfter, direction);
    const lipInBox = getLipInBox(width, height, direction);
    const samples = [0, 0.25, 0.5, 0.75, 1].map(
      (ratio) => tilts.start + (tilts.end - tilts.start) * ratio,
    );
    const reach = getReach(width, height, lipInBox, samples);
    const overflow =
      Math.max(0, SCREEN_MARGIN - (spoonX + reach.left)) +
      Math.max(0, spoonX + reach.right - (viewportWidth - SCREEN_MARGIN));
    return { direction, tilts, lipInBox, reach, overflow };
  });
  const chosen =
    candidates.find(({ overflow }) => overflow === 0) ??
    [...candidates].sort((a, b) => a.overflow - b.overflow)[0];
  if (!chosen) {
    throw new Error("注ぐ向きを決められない");
  }
  const { direction, tilts, lipInBox, reach } = chosen;

  // 上の段へ注ぐときは、傾けたグラスが画面の上に出ないよう、液を柄に乗せる高さを下げる。
  const destinationTop = destination.rect.top;
  const destinationHeight = destination.rect.height;
  const streamTopY = Math.min(
    Math.max(
      destinationTop - destinationHeight * 0.3,
      SCREEN_MARGIN - reach.top,
    ),
    destinationTop - destinationHeight * 0.03,
  );
  // 収まらない分は、柄の外から細く落とす。
  const lipX = Math.min(
    Math.max(spoonX, SCREEN_MARGIN - reach.left),
    viewportWidth - SCREEN_MARGIN - reach.right,
  );
  const lip = { x: lipX, y: streamTopY };
  const pourPivot = getPivotForLip(lip, lipInBox, width, tilts.start);
  const hoverPivot = {
    x: pourPivot.x,
    y: Math.max(SCREEN_MARGIN + width, pourPivot.y - height * 0.35),
  };

  return {
    direction,
    box,
    amountBefore,
    amountAfter,
    startTiltDeg: tilts.start,
    endTiltDeg: tilts.end,
    lip,
    lipInBox,
    restPivot: { x: source.rect.left + width / 2, y: source.rect.top },
    liftY: source.liftY,
    hoverPivot: { x: hoverPivot.x, y: Math.min(hoverPivot.y, pourPivot.y) },
    spoonX,
    streamTopY,
    surfaceBeforeY:
      destinationTop +
      destinationHeight * getBarLiquidSurface(destination.before.length),
    surfaceAfterY:
      destinationTop +
      destinationHeight * getBarLiquidSurface(destination.after.length),
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function progressBetween(progress: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (progress - from) / (to - from)));
}

function mixPose(from: BarPourPose, to: BarPourPose, t: number): BarPourPose {
  return {
    pivot: {
      x: from.pivot.x + (to.pivot.x - from.pivot.x) * t,
      y: from.pivot.y + (to.pivot.y - from.pivot.y) * t,
    },
    angleDeg: from.angleDeg + (to.angleDeg - from.angleDeg) * t,
  };
}

/** 注ぎ元に残っている液の量（段）。 */
export function getSourceAmount(plan: BarPourPlan, progress: number): number {
  const t = progressBetween(
    progress,
    BAR_POUR_PHASE.transferStart,
    BAR_POUR_PHASE.transferEnd,
  );
  return plan.amountBefore + (plan.amountAfter - plan.amountBefore) * t;
}

function getPouringPose(plan: BarPourPlan, amount: number): BarPourPose {
  const raw = getPouringTiltDeg(plan.box, amount, plan.direction);
  const angleDeg = plan.direction * Math.min(Math.abs(raw), MAX_TILT_DEG);
  return {
    pivot: getPivotForLip(plan.lip, plan.lipInBox, plan.box.width, angleDeg),
    angleDeg,
  };
}

/** 注ぎ元の置き方。注いでいる間は、残っている液がちょうど口の縁に届く角度まで傾け、縁を柄の上に置き続ける。 */
export function getSourcePose(
  plan: BarPourPlan,
  progress: number,
): BarPourPose {
  const { arrive, tilted, transferStart, transferEnd, upright } =
    BAR_POUR_PHASE;
  const lifted: BarPourPose = {
    pivot: { x: plan.restPivot.x, y: plan.restPivot.y + plan.liftY },
    angleDeg: 0,
  };
  const rest: BarPourPose = { pivot: plan.restPivot, angleDeg: 0 };
  const hover: BarPourPose = {
    pivot: plan.hoverPivot,
    angleDeg: plan.startTiltDeg * 0.45,
  };
  const pourStart = getPouringPose(plan, plan.amountBefore);
  if (progress < arrive) {
    return mixPose(
      lifted,
      hover,
      easeInOut(progressBetween(progress, 0, arrive)),
    );
  }
  if (progress < tilted) {
    return mixPose(
      hover,
      pourStart,
      easeOut(progressBetween(progress, arrive, tilted)),
    );
  }
  if (progress < transferStart) {
    return pourStart;
  }
  if (progress < transferEnd) {
    return getPouringPose(plan, getSourceAmount(plan, progress));
  }
  if (progress < upright) {
    const pourEnd = getPouringPose(plan, plan.amountAfter);
    return mixPose(
      pourEnd,
      hover,
      easeInOut(progressBetween(progress, transferEnd, upright)),
    );
  }
  return mixPose(hover, rest, easeInOut(progressBetween(progress, upright, 1)));
}
