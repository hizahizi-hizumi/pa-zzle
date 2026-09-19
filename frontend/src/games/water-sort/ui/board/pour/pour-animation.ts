import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-play";
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
  rect: BottleRect;
};

export type PourAnimation = {
  id: number;
  source: PourAnimationBottle;
  destination: PourAnimationBottle;
  colorIndex: number;
  isClearingMove: boolean;
};

export function createPourAnimation(
  operation: PourOperation,
  sourceRect: BottleRect,
  destinationRect: BottleRect,
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
    },
    destination: {
      bottleIndex: operation.destinationBottleIndex,
      before: operation.stateBefore[operation.destinationBottleIndex] ?? [],
      after: operation.stateAfter[operation.destinationBottleIndex] ?? [],
      rect: destinationRect,
    },
    colorIndex,
    isClearingMove: operation.isClearingMove,
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
