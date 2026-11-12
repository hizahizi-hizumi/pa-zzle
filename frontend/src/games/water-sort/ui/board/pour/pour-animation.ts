import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

/** 注ぐ動き1回の長さ。盤面の外で、注ぐ動きに合わせて間合いを取るときもこの値を使う。 */
export const POUR_ANIMATION_DURATION_MS = 1600;
/** 注ぐ動きの中で、水が移り始める所と移り終える所（動きの長さに対する割合）。注ぐ音もこの間に鳴らす。 */
export const POUR_TRANSFER_START_OFFSET = 0.38;
export const POUR_TRANSFER_END_OFFSET = 0.72;

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

export type PourAnimation = {
  id: number;
  source: PourAnimationBottle & {
    /** 注ぎ始めたときに注ぎ元を持ち上げていた量（px、上が負）。注ぐ動きはこの高さから始め、置かれている位置へ戻す。 */
    liftY: number;
  };
  destination: PourAnimationBottle;
  colorIndex: number;
  isClearingMove: boolean;
};

export function createPourAnimation(
  operation: PourOperation,
  sourceRect: BottleRect,
  sourceLiftY: number,
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
