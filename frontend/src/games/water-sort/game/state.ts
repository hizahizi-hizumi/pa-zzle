export const WATER_SORT_BOTTLE_CAPACITY = 4;
export const WATER_SORT_EMPTY_BOTTLE_COUNT = 2;

export type WaterSortColor = number;
export type WaterSortBottle = readonly WaterSortColor[];
export type WaterSortState = readonly WaterSortBottle[];

export type WaterSortMove = {
  sourceBottleIndex: number;
  destinationBottleIndex: number;
};

export function isCompleteWaterSortBottle(bottle: WaterSortBottle): boolean {
  return (
    bottle.length === WATER_SORT_BOTTLE_CAPACITY &&
    bottle.every((color) => color === bottle[0])
  );
}

export function isWaterSortCleared(state: WaterSortState): boolean {
  return state.every(
    (bottle) => bottle.length === 0 || isCompleteWaterSortBottle(bottle),
  );
}

export function countWaterSortColorBlocks(state: WaterSortState): number {
  let blockCount = 0;

  for (const bottle of state) {
    let previousColor: WaterSortColor | undefined;
    for (const color of bottle) {
      if (color !== previousColor) {
        blockCount += 1;
        previousColor = color;
      }
    }
  }

  return blockCount;
}

export function countWaterSortColors(state: WaterSortState): number {
  const colors = new Set<WaterSortColor>();
  for (const bottle of state) {
    for (const color of bottle) {
      colors.add(color);
    }
  }

  return colors.size;
}

export function countEmptyWaterSortBottles(state: WaterSortState): number {
  return state.filter((bottle) => bottle.length === 0).length;
}

export function createWaterSortStateKey(state: WaterSortState): string {
  return state
    .map((bottle) => bottle.join(","))
    .sort()
    .join("|");
}

export function isStandardWaterSortInitialState(
  state: WaterSortState,
  colorCount: number,
): boolean {
  if (!Number.isInteger(colorCount) || colorCount < 1) {
    return false;
  }

  if (state.length !== colorCount + WATER_SORT_EMPTY_BOTTLE_COUNT) {
    return false;
  }

  const emptyBottleCount = countEmptyWaterSortBottles(state);
  if (emptyBottleCount !== WATER_SORT_EMPTY_BOTTLE_COUNT) {
    return false;
  }

  const colorCounts = new Map<WaterSortColor, number>();
  for (const bottle of state) {
    if (
      bottle.length !== 0 &&
      bottle.length !== WATER_SORT_BOTTLE_CAPACITY
    ) {
      return false;
    }

    for (const color of bottle) {
      if (!Number.isInteger(color) || color < 0 || color >= colorCount) {
        return false;
      }
      colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
    }
  }

  if (colorCounts.size !== colorCount) {
    return false;
  }

  for (let color = 0; color < colorCount; color += 1) {
    if (colorCounts.get(color) !== WATER_SORT_BOTTLE_CAPACITY) {
      return false;
    }
  }

  return true;
}
