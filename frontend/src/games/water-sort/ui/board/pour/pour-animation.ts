import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

export type BottleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PourOperation = Extract<WaterSortOperation, { type: "poured" }>;

type PourAnimationBottle = {
  bottleIndex: number;
  before: WaterSortBottle;
  after: WaterSortBottle;
  /** 置かれている位置。注ぎ元として持ち上げていても、持ち上げる前の位置にする。 */
  rect: BottleRect;
};

/** 注ぐ動きを収める範囲（viewport 座標）。盤面の入れ物の左右と上の端。 */
export type PourBounds = {
  left: number;
  right: number;
  top: number;
};

/**
 * 注ぎ元を傾けて注ぐときの姿勢。注ぎ元の口（上端の中央）を注ぎ先の口の真上に置き、そこを軸に傾ける。
 * - `deltaX`・`hoverY`: 置かれている位置から、傾ける位置までの移動量（px）。
 * - `tiltDeg`: 傾ける角度。正は時計回りで、胴が口から左へ伸びる。
 * - `mouthY`: 傾けている間の口の高さ（viewport 座標）。
 */
export type PourPose = {
  deltaX: number;
  hoverY: number;
  tiltDeg: number;
  mouthY: number;
};

export type PourAnimation = {
  id: number;
  source: PourAnimationBottle & {
    /** 注ぎ始めたときに注ぎ元を持ち上げていた量（px、上が負）。注ぐ動きはこの高さから始め、置かれている位置へ戻す。 */
    liftY: number;
  };
  destination: PourAnimationBottle;
  colorIndex: number;
  isClearingMove: boolean;
  durationMs: number;
  pose: PourPose;
};

const POUR_TILT_DEG = 68;
/** 注ぎ元の口を、注ぎ先の口からボトルの高さのこの割合だけ上に置く。 */
const POUR_MOUTH_GAP_RATIO = 0.3;
/** 傾けた注ぎ元が、盤面の端から離れておく量（px）。 */
const POUR_BOUNDS_MARGIN = 4;

/** 1単位注ぐときの長さと、1単位増えるごとに延ばす長さ。満杯の3単位でも 1200ms に収める。 */
const POUR_BASE_DURATION_MS = 820;
const POUR_DURATION_PER_UNIT_MS = 110;

export function getPourAnimationDurationMs(unitCount: number): number {
  return (
    POUR_BASE_DURATION_MS +
    POUR_DURATION_PER_UNIT_MS * Math.max(1, Math.min(3, unitCount))
  );
}

/** 注いだ量（単位）。 */
export function getPouredUnitCount(operation: PourOperation): number {
  const sourceBefore = operation.stateBefore[operation.sourceBottleIndex] ?? [];
  const sourceAfter = operation.stateAfter[operation.sourceBottleIndex] ?? [];
  return sourceBefore.length - sourceAfter.length;
}

/**
 * 傾けた注ぎ元が盤面の左右にはみ出さないよう、胴を盤面の内側へ伸ばす向きに傾ける。
 * 上の段へ注ぐときは、傾けた角が盤面の上の端を越えない高さまで口を下げる。
 */
export function getPourPose(
  sourceRect: BottleRect,
  destinationRect: BottleRect,
  bounds: PourBounds,
): PourPose {
  const radians = (POUR_TILT_DEG * Math.PI) / 180;
  const mouthX = destinationRect.left + destinationRect.width / 2;
  const reach =
    sourceRect.height * Math.sin(radians) +
    (sourceRect.width / 2) * Math.cos(radians);
  const roomLeft = mouthX - reach - bounds.left;
  const roomRight = bounds.right - (mouthX + reach);
  const tiltSign = roomLeft >= roomRight ? 1 : -1;
  const raisedCorner = (sourceRect.width / 2) * Math.sin(radians);
  const mouthY = Math.max(
    destinationRect.top - sourceRect.height * POUR_MOUTH_GAP_RATIO,
    bounds.top + raisedCorner + POUR_BOUNDS_MARGIN,
  );

  return {
    deltaX: mouthX - (sourceRect.left + sourceRect.width / 2),
    hoverY: mouthY - sourceRect.top,
    tiltDeg: tiltSign * POUR_TILT_DEG,
    mouthY,
  };
}

export function createPourAnimation(
  operation: PourOperation,
  sourceRect: BottleRect,
  sourceLiftY: number,
  destinationRect: BottleRect,
  bounds: PourBounds,
): PourAnimation | null {
  const sourceBefore = operation.stateBefore[operation.sourceBottleIndex] ?? [];
  const colorIndex = sourceBefore[sourceBefore.length - 1];
  if (colorIndex === undefined) {
    return null;
  }

  return {
    id: operation.id,
    source: {
      bottleIndex: operation.sourceBottleIndex,
      before: sourceBefore,
      after: operation.stateAfter[operation.sourceBottleIndex] ?? [],
      rect: sourceRect,
      liftY: sourceLiftY,
    },
    destination: {
      bottleIndex: operation.destinationBottleIndex,
      before: operation.stateBefore[operation.destinationBottleIndex] ?? [],
      after: operation.stateAfter[operation.destinationBottleIndex] ?? [],
      rect: destinationRect,
    },
    colorIndex,
    isClearingMove: operation.isClearingMove,
    durationMs: getPourAnimationDurationMs(getPouredUnitCount(operation)),
    pose: getPourPose(sourceRect, destinationRect, bounds),
  };
}

export function addPourAnimation(
  current: readonly PourAnimation[],
  next: PourAnimation,
): readonly PourAnimation[] {
  return [
    ...current.filter((active) => canAnimateConcurrently(active, next)),
    next,
  ];
}

export function interruptPourAnimationsForBottle(
  current: readonly PourAnimation[],
  bottleIndex: number,
): readonly PourAnimation[] {
  return current.filter(
    (animation) =>
      animation.source.bottleIndex !== bottleIndex &&
      animation.destination.bottleIndex !== bottleIndex,
  );
}

export function groupPourAnimationsByDestination(
  animations: readonly PourAnimation[],
): readonly (readonly PourAnimation[])[] {
  const groups = new Map<number, PourAnimation[]>();

  for (const animation of animations) {
    const destinationBottleIndex = animation.destination.bottleIndex;
    const current = groups.get(destinationBottleIndex) ?? [];
    current.push(animation);
    groups.set(destinationBottleIndex, current);
  }

  return [...groups.values()];
}

function canAnimateConcurrently(
  active: PourAnimation,
  next: PourAnimation,
): boolean {
  return (
    active.source.bottleIndex !== next.source.bottleIndex &&
    active.destination.bottleIndex !== next.source.bottleIndex &&
    active.source.bottleIndex !== next.destination.bottleIndex
  );
}
