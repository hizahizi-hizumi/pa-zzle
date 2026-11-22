import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  type BottleRect,
  type PourBounds,
  type PourPath,
  planPourPath,
} from "@/games/water-sort/ui/board/pour/pour-path";
import {
  getPourTiming,
  type PourTiming,
} from "@/games/water-sort/ui/board/pour/pour-timing";

type PourOperation = Extract<WaterSortOperation, { type: "poured" }>;

type PourAnimationBottle = {
  bottleIndex: number;
  before: WaterSortBottle;
  after: WaterSortBottle;
  /** 置かれている位置。注ぎ元として持ち上げていても、持ち上げる前の位置にする。 */
  rect: BottleRect;
};

export type PourAnimation = {
  id: number;
  source: PourAnimationBottle;
  destination: PourAnimationBottle;
  colorIndex: number;
  isClearingMove: boolean;
  timing: PourTiming;
  path: PourPath;
};

export type PourPlacement = {
  sourceRect: BottleRect;
  /** 注ぎ始めたときに注ぎ元を持ち上げていた量（px、上が負）。注ぐ動きはこの高さから始め、置かれている位置へ戻す。 */
  sourceLiftY: number;
  destinationRect: BottleRect;
  bounds: PourBounds;
};

/** 1回の注ぎで移る段の数。 */
export function getPouredSlotCount(operation: PourOperation): number {
  const before = operation.stateBefore[operation.destinationBottleIndex] ?? [];
  const after = operation.stateAfter[operation.destinationBottleIndex] ?? [];
  return after.length - before.length;
}

/** `active` は今動いている注ぎ。同じ注ぎ先へ注いでいる途中の試験管と重ならない側から注ぐ。 */
export function createPourAnimation(
  operation: PourOperation,
  placement: PourPlacement,
  active: readonly PourAnimation[],
): PourAnimation | null {
  const sourceBefore = operation.stateBefore[operation.sourceBottleIndex] ?? [];
  const sourceAfter = operation.stateAfter[operation.sourceBottleIndex] ?? [];
  const colorIndex = sourceBefore[sourceBefore.length - 1];
  if (colorIndex === undefined) {
    return null;
  }
  const timing = getPourTiming(getPouredSlotCount(operation));
  const occupying = active.findLast(
    (animation) =>
      animation.destination.bottleIndex === operation.destinationBottleIndex,
  );

  return {
    id: operation.id,
    source: {
      bottleIndex: operation.sourceBottleIndex,
      before: sourceBefore,
      after: sourceAfter,
      rect: placement.sourceRect,
    },
    destination: {
      bottleIndex: operation.destinationBottleIndex,
      before: operation.stateBefore[operation.destinationBottleIndex] ?? [],
      after: operation.stateAfter[operation.destinationBottleIndex] ?? [],
      rect: placement.destinationRect,
    },
    colorIndex,
    isClearingMove: operation.isClearingMove,
    timing,
    path: planPourPath({
      source: placement.sourceRect,
      liftY: placement.sourceLiftY,
      destination: placement.destinationRect,
      bounds: placement.bounds,
      sourceSlotsBefore: sourceBefore.length,
      sourceSlotsAfter: sourceAfter.length,
      timing,
      occupiedDirection: occupying?.path.direction ?? null,
    }),
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

/** 同じ注ぎ先への注ぎを、成り立った順のまままとめる。注ぎ先は、まとめた注ぎの液を順に積んで描く。 */
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
