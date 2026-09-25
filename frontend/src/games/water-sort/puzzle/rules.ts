import {
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortBottle,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

function topColor(bottle: WaterSortBottle): number | undefined {
  return bottle.at(-1);
}

function countTopColorUnits(bottle: WaterSortBottle): number {
  const color = topColor(bottle);
  if (color === undefined) {
    return 0;
  }

  let count = 0;
  for (let index = bottle.length - 1; index >= 0; index -= 1) {
    if (bottle[index] !== color) {
      break;
    }
    count += 1;
  }

  return count;
}

export function getWaterSortPourAmount(
  state: WaterSortState,
  move: WaterSortMove,
): number {
  const { sourceBottleIndex, destinationBottleIndex } = move;
  if (
    sourceBottleIndex === destinationBottleIndex ||
    sourceBottleIndex < 0 ||
    destinationBottleIndex < 0 ||
    sourceBottleIndex >= state.length ||
    destinationBottleIndex >= state.length
  ) {
    return 0;
  }

  const source = state[sourceBottleIndex];
  const destination = state[destinationBottleIndex];
  if (!source || !destination || source.length === 0) {
    return 0;
  }

  const availableCapacity = WATER_SORT_BOTTLE_CAPACITY - destination.length;
  if (availableCapacity <= 0) {
    return 0;
  }

  const sourceColor = topColor(source);
  const destinationColor = topColor(destination);
  if (destinationColor !== undefined && destinationColor !== sourceColor) {
    return 0;
  }

  return Math.min(countTopColorUnits(source), availableCapacity);
}

export function applyWaterSortMove(
  state: WaterSortState,
  move: WaterSortMove,
): WaterSortState | null {
  const pourAmount = getWaterSortPourAmount(state, move);
  if (pourAmount === 0) {
    return null;
  }

  const source = state[move.sourceBottleIndex];
  const destination = state[move.destinationBottleIndex];
  if (!source || !destination) {
    return null;
  }

  const movedUnits = source.slice(source.length - pourAmount);
  const nextState = state.map((bottle) => [...bottle]);
  nextState[move.sourceBottleIndex] = source.slice(0, -pourAmount);
  nextState[move.destinationBottleIndex] = [...destination, ...movedUnits];

  return nextState;
}

export function listWaterSortLegalMoves(
  state: WaterSortState,
): WaterSortMove[] {
  const moves: WaterSortMove[] = [];

  for (
    let sourceBottleIndex = 0;
    sourceBottleIndex < state.length;
    sourceBottleIndex += 1
  ) {
    for (
      let destinationBottleIndex = 0;
      destinationBottleIndex < state.length;
      destinationBottleIndex += 1
    ) {
      const move = { sourceBottleIndex, destinationBottleIndex };
      if (getWaterSortPourAmount(state, move) > 0) {
        moves.push(move);
      }
    }
  }

  return moves;
}
