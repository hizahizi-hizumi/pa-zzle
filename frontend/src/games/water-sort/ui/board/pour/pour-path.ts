import {
  getPouredRatio,
  type PourTiming,
} from "@/games/water-sort/ui/board/pour/pour-timing";
import { getLipReachingTiltDeg } from "@/games/water-sort/ui/board/pour/tilted-liquid";

/**
 * 注ぎ元の試験管の道筋。持ち上げた所から傾けながら注ぎ先の口へ運び、口の縁を注ぎ先の口に当てたまま、
 * 残りの液がちょうど口に届く角度より少し深く傾け続け、注ぎ終えたら起こして置かれていた所へ戻す。
 * 位置は viewport の px。試験管は上の端の中央を中心に回す（CSS の `transform-origin: top`）。
 */

export type BottleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 注ぐ動きがはみ出してはいけない範囲（viewport の px）。上は見出しの下端、左右は画面の端。 */
export type PourBounds = {
  top: number;
  left: number;
  right: number;
};

export type PourDirection = 1 | -1;

type ScreenPoint = {
  x: number;
  y: number;
};

export type PourPath = {
  /** 注ぎ先のある向き（右が 1）。試験管はこの向きへ口を倒す。 */
  direction: PourDirection;
  /** 注ぐ間、注ぎ元の口の縁を当てておく所。流れはここから落ちる。 */
  lip: ScreenPoint;
  source: BottleRect;
  liftY: number;
  /** 持って行く途中で、注ぎ先の口より上へ持ち上げる高さ。 */
  hoverPx: number;
  /** 戻す途中で、注ぎ先の口から注ぎ元の側へ離す量。 */
  sideRetreatPx: number;
  sourceSlotsBefore: number;
  sourceSlotsAfter: number;
  timing: PourTiming;
};

export type SourcePose = {
  x: number;
  y: number;
  tiltDeg: number;
  /** 注ぎ元に残っている液（段、小数も取る）。 */
  amount: number;
};

/** 試験管の形の座標（幅 36・高さ 100）での、右へ傾けたときにいちばん低くなる口の縁の外側。 */
const RIM_LIP = { x: 33.8, y: 7 } as const;
const TUBE_VIEW_WIDTH = 36;
/** 口の縁を、注ぎ先の口の中ほどより注ぎ元の側へ寄せる量（注ぎ先の幅に対する割合）。 */
const LIP_INSET_RATIO = 0.1;
/** 口の縁を当てる高さ（注ぎ先の高さに対する割合、上の端から）。注ぎ先の口の縁にわずかに重ねて、触れて見せる。 */
const LIP_DROP_RATIO = 0.03;
/** 注いでいる間、残りが口に届く角度より深く傾ける量。この分だけ液が口からあふれ続ける。 */
const OVER_TILT_DEG = 4;
/** 注ぎ元を空にするときに、最後のしずくまで落とすよう注ぎ終わりへ向けて足す傾き。 */
const EMPTYING_EXTRA_TILT_DEG = 8;
const HOVER_RATIO = 0.14;
/** 注ぎ終えて流れを切るのに起こす角度と長さ。最後のしずくが注ぎ先へ落ちきる間、口を注ぎ先に当てておく。 */
const FLOW_CUT_TILT_DEG = 10;
const FLOW_CUT_MS = 60;
/** 見出しにかからないよう口の縁を注ぎ先の口の中へ下ろすときの、下ろす量の上限（注ぎ先の高さに対する割合）。首の空きの中に収める。 */
const MAX_EXTRA_DROP_RATIO = 0.2;
const RETREAT_RATIO = 0.1;
const SIDE_RETREAT_RATIO = 0.7;
/**
 * はみ出しを確かめる試験管の点（試験管の形の座標）。口の縁の両端、底の丸みの両端と底、
 * 右の側に柄を出した試験管ばさみの柄の先。左に柄を出すときは左右を返す。
 */
const EXTENT_POINTS = [
  [1.7, 3.4],
  [34.3, 3.4],
  [3.6, 88],
  [32.4, 88],
  [18, 97.6],
] as const;
const CLAMP_HANDLE_POINTS = [
  [54.6, -18.4],
  [49.6, -20.6],
] as const;
const BOUNDS_SAMPLE_COUNT = 48;
/** はみ出しとみなさない量（px）。 */
const OVERFLOW_TOLERANCE_PX = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(value: number): number {
  return 1 - (1 - clamp01(value)) ** 3;
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function rotate(x: number, y: number, tiltDeg: number): ScreenPoint {
  const radian = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(radian);
  const sin = Math.sin(radian);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** 試験管の形の座標の点を、箱の上の端の中央からの px にする。 */
function toPivotOffset(source: BottleRect, x: number, y: number): ScreenPoint {
  const unit = source.width / TUBE_VIEW_WIDTH;
  return { x: x * unit - source.width / 2, y: y * unit };
}

function getRimLip(direction: PourDirection) {
  return {
    x: direction > 0 ? RIM_LIP.x : TUBE_VIEW_WIDTH - RIM_LIP.x,
    y: RIM_LIP.y,
  };
}

/** 口の縁を `lip` に当てたまま `tiltDeg` 度傾けたときの、置かれていた所からの移動量。 */
function getTouchingTranslate(
  path: Pick<PourPath, "direction" | "lip" | "source">,
  tiltDeg: number,
): ScreenPoint {
  const rimLip = getRimLip(path.direction);
  const offset = toPivotOffset(path.source, rimLip.x, rimLip.y);
  const rotated = rotate(offset.x, offset.y, tiltDeg);
  return {
    x: path.lip.x - rotated.x - (path.source.left + path.source.width / 2),
    y: path.lip.y - rotated.y - path.source.top,
  };
}

/** 注いでいる間の傾き（向きを含む）と、注ぎ元に残っている液。 */
function getPouringTilt(path: PourPath, elapsedMs: number) {
  const { timing, sourceSlotsBefore, sourceSlotsAfter, direction } = path;
  const flowProgress =
    (elapsedMs - timing.touchMs) / (timing.flowEndMs - timing.touchMs);
  const amount =
    sourceSlotsBefore -
    (sourceSlotsBefore - sourceSlotsAfter) * getPouredRatio(timing, elapsedMs);
  const overTilt =
    OVER_TILT_DEG * smoothstep(flowProgress / 0.15) +
    (sourceSlotsAfter === 0
      ? EMPTYING_EXTRA_TILT_DEG * smoothstep(flowProgress)
      : 0);
  return {
    tiltDeg: direction * (getLipReachingTiltDeg(amount) + overTilt),
    amount,
  };
}

export function getSourcePose(path: PourPath, elapsedMs: number): SourcePose {
  const { timing, sourceSlotsBefore, sourceSlotsAfter, liftY } = path;

  if (elapsedMs < timing.touchMs) {
    const progress = clamp01(elapsedMs / timing.touchMs);
    const eased = easeInOutCubic(progress);
    const arrivalTilt = getPouringTilt(path, timing.touchMs).tiltDeg;
    const arrival = getTouchingTranslate(path, arrivalTilt);
    return {
      x: arrival.x * eased,
      y:
        liftY +
        (arrival.y - liftY) * eased -
        path.hoverPx * Math.sin(Math.PI * progress),
      // 持ち上げてから傾け始め、口に触れる時に、残りの液がちょうど口に届く角度になる。
      tiltDeg: arrivalTilt * easeInOutCubic((progress - 0.1) / 0.9),
      amount: sourceSlotsBefore,
    };
  }

  if (elapsedMs < timing.flowEndMs) {
    const { tiltDeg, amount } = getPouringTilt(path, elapsedMs);
    const translate = getTouchingTranslate(path, tiltDeg);
    return { ...translate, tiltDeg, amount };
  }

  // 注ぎ終えたら、口を注ぎ先に当てたまま少し起こして流れを切り、最後のしずくが落ちてから離す。
  const sinceFlowEnd = elapsedMs - timing.flowEndMs;
  const endTilt = getPouringTilt(path, timing.flowEndMs).tiltDeg;
  const cutTilt = endTilt - path.direction * FLOW_CUT_TILT_DEG;
  if (sinceFlowEnd < FLOW_CUT_MS) {
    const tiltDeg =
      endTilt + (cutTilt - endTilt) * easeOutCubic(sinceFlowEnd / FLOW_CUT_MS);
    return {
      ...getTouchingTranslate(path, tiltDeg),
      tiltDeg,
      amount: sourceSlotsAfter,
    };
  }
  const progress = clamp01(
    (sinceFlowEnd - FLOW_CUT_MS) /
      (timing.durationMs - timing.flowEndMs - FLOW_CUT_MS),
  );
  const cut = getTouchingTranslate(path, cutTilt);
  // 起こすと試験管が回す中心の下へ垂れるので、起こすのと同じく初めに速く持ち上げ、ほかの試験管に重ねない。
  const remaining = (1 - progress) ** 2;
  // 注ぎ先の口から、注ぎ元の側へ離れながら戻す。注ぎ先の上を通らず、栓を差す口を空けておく。
  const retreat = Math.sin(Math.PI * progress);
  return {
    x: cut.x * remaining - path.direction * path.sideRetreatPx * retreat,
    y: cut.y * remaining - path.source.height * RETREAT_RATIO * retreat,
    tiltDeg: cutTilt * (1 - easeOutCubic(progress / 0.75)),
    amount: sourceSlotsAfter,
  };
}

type Overflow = {
  /** 左右の端からはみ出す量（px）の和。 */
  side: number;
  /** 上の端からはみ出す量（px）。 */
  top: number;
};

/**
 * 道筋で、試験管と試験管ばさみが `bounds` からはみ出す量。
 * 持ち上げた所の姿は盤面の持ち上げた試験管と同じなので、運び始めの半分と、試験管ばさみを離した後は数えない。
 */
function getOverflow(
  path: PourPath,
  bounds: PourBounds,
  startMs = path.timing.touchMs / 2,
): Overflow {
  const handle = CLAMP_HANDLE_POINTS.map(([x, y]) =>
    // 柄は傾ける向きと逆の側に出す。
    path.direction > 0
      ? ([TUBE_VIEW_WIDTH - x, y] as const)
      : ([x, y] as const),
  );
  const points = [...EXTENT_POINTS, ...handle].map(([x, y]) =>
    toPivotOffset(path.source, x, y),
  );
  const pivotX = path.source.left + path.source.width / 2;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  const endMs = path.timing.clampReleaseMs;
  for (let index = 0; index <= BOUNDS_SAMPLE_COUNT; index += 1) {
    const pose = getSourcePose(
      path,
      startMs + ((endMs - startMs) * index) / BOUNDS_SAMPLE_COUNT,
    );
    for (const point of points) {
      const rotated = rotate(point.x, point.y, pose.tiltDeg);
      const x = pivotX + pose.x + rotated.x;
      const y = path.source.top + pose.y + rotated.y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
    }
  }
  return {
    side: Math.max(0, bounds.left - minX) + Math.max(0, maxX - bounds.right),
    top: Math.max(0, bounds.top - minY),
  };
}

function getTotalOverflow({ side, top }: Overflow): number {
  return side + top;
}

export type PourPathInput = {
  source: BottleRect;
  liftY: number;
  destination: BottleRect;
  bounds: PourBounds;
  sourceSlotsBefore: number;
  sourceSlotsAfter: number;
  timing: PourTiming;
  /** 同じ注ぎ先へ注いでいる途中の試験管が口を倒している向き。重ならないよう、できれば逆の側から注ぐ。 */
  occupiedDirection: PourDirection | null;
};

function createPath(
  input: PourPathInput,
  direction: PourDirection,
  hoverPx: number,
  extraDropPx: number,
  sideRetreatPx: number,
): PourPath {
  const { destination } = input;
  return {
    direction,
    lip: {
      x:
        destination.left +
        destination.width / 2 -
        direction * destination.width * LIP_INSET_RATIO,
      y: destination.top + destination.height * LIP_DROP_RATIO + extraDropPx,
    },
    source: input.source,
    liftY: input.liftY,
    hoverPx,
    sideRetreatPx,
    sourceSlotsBefore: input.sourceSlotsBefore,
    sourceSlotsAfter: input.sourceSlotsAfter,
    timing: input.timing,
  };
}

/**
 * 注ぎ元の側から注ぎ先へ口を倒すのを基本にし、見出しや画面の端にはみ出すなら逆の側から注ぐ。
 * 持って行く途中の持ち上げや、戻す途中に注ぎ元の側へ離す動きがはみ出すなら、それをしない。
 * 大きな試験管を上の段で深く傾けると、それでも口の上の縁と試験管ばさみの柄が見出しにかかるので、
 * 口の縁を注ぎ先の口の中へ下ろして当てる。
 */
export function planPourPath(input: PourPathInput): PourPath {
  const { source, destination, occupiedDirection, bounds } = input;
  const preferred: PourDirection =
    destination.left + destination.width / 2 >= source.left + source.width / 2
      ? 1
      : -1;
  const directions: PourDirection[] =
    occupiedDirection === preferred
      ? [-preferred as PourDirection, preferred]
      : [preferred, -preferred as PourDirection];
  const hovers = [source.height * HOVER_RATIO, 0];
  const retreats = [source.width * SIDE_RETREAT_RATIO, 0];

  const candidates: { path: PourPath; overflow: number }[] = [];
  function fits(path: PourPath): boolean {
    const overflow = getTotalOverflow(getOverflow(path, bounds));
    candidates.push({ path, overflow });
    return overflow <= OVERFLOW_TOLERANCE_PX;
  }

  for (const direction of directions) {
    for (const hoverPx of hovers) {
      for (const sideRetreatPx of retreats) {
        const path = createPath(input, direction, hoverPx, 0, sideRetreatPx);
        if (fits(path)) {
          return path;
        }
      }
    }
  }
  for (const direction of directions) {
    const unlowered = createPath(input, direction, 0, 0, 0);
    const { top } = getOverflow(unlowered, bounds, input.timing.touchMs);
    const path = createPath(
      input,
      direction,
      0,
      Math.min(top, destination.height * MAX_EXTRA_DROP_RATIO),
      0,
    );
    if (fits(path)) {
      return path;
    }
  }
  const [least] = [...candidates].sort((a, b) => a.overflow - b.overflow);
  return least?.path ?? createPath(input, preferred, 0, 0, 0);
}

export const _private = { getOverflow, getTouchingTranslate, getRimLip };
