import type { WaterSortBottle } from "@/games/water-sort/game/state";
import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-game";

export type BottleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PourOperation = Extract<WaterSortOperation, { type: "poured" }>;

type PourPresentationBottle = {
  bottleIndex: number;
  before: WaterSortBottle;
  after: WaterSortBottle;
  rect: BottleRect;
};

export type PourPresentation = {
  id: number;
  source: PourPresentationBottle;
  destination: PourPresentationBottle;
  colorIndex: number;
  isClearingMove: boolean;
};

export function createPourPresentation(
  operation: PourOperation,
  sourceRect: BottleRect,
  destinationRect: BottleRect,
): PourPresentation | null {
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

export function addPourPresentation(
  current: readonly PourPresentation[],
  next: PourPresentation,
): readonly PourPresentation[] {
  return [
    ...current.filter((active) => canPresentConcurrently(active, next)),
    next,
  ];
}

export function interruptPourPresentationsForBottle(
  current: readonly PourPresentation[],
  bottleIndex: number,
): readonly PourPresentation[] {
  return current.filter(
    (presentation) =>
      presentation.source.bottleIndex !== bottleIndex &&
      presentation.destination.bottleIndex !== bottleIndex,
  );
}

export function groupPourPresentationsByDestination(
  presentations: readonly PourPresentation[],
): readonly (readonly PourPresentation[])[] {
  const groups = new Map<number, PourPresentation[]>();

  for (const presentation of presentations) {
    const destinationBottleIndex = presentation.destination.bottleIndex;
    const current = groups.get(destinationBottleIndex) ?? [];
    current.push(presentation);
    groups.set(destinationBottleIndex, current);
  }

  return [...groups.values()];
}

function canPresentConcurrently(
  active: PourPresentation,
  next: PourPresentation,
): boolean {
  return (
    active.source.bottleIndex !== next.source.bottleIndex &&
    active.destination.bottleIndex !== next.source.bottleIndex &&
    active.source.bottleIndex !== next.destination.bottleIndex
  );
}
