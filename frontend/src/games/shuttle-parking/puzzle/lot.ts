export const SHUTTLE_PARKING_SIDES = [
  "top",
  "right",
  "bottom",
  "left",
] as const;
export const SHUTTLE_PARKING_CAR_CAPACITIES = [2, 3] as const;
export const SHUTTLE_PARKING_COLORS = ["a", "b", "c", "d"] as const;

export type ShuttleParkingSide = (typeof SHUTTLE_PARKING_SIDES)[number];
export type ShuttleParkingOrientation = "horizontal" | "vertical";
/** 車の長さ（占めるマスの数）と同じ。 */
export type ShuttleParkingCapacity =
  (typeof SHUTTLE_PARKING_CAR_CAPACITIES)[number];
/** 車と乗客の色。同じ色の乗客だけが乗る。 */
export type ShuttleParkingColor = (typeof SHUTTLE_PARKING_COLORS)[number];
/** 駐車場の `cars` の添字。 */
export type ShuttleParkingCarId = number;

export type ShuttleParkingCell = {
  row: number;
  column: number;
};

export type ShuttleParkingCar = ShuttleParkingCell & {
  orientation: ShuttleParkingOrientation;
  capacity: ShuttleParkingCapacity;
  color: ShuttleParkingColor;
};

/** 正方形の駐車場。車は `openSides` の辺からだけ外へ出られる。 */
export type ShuttleParkingLot = {
  size: number;
  openSides: readonly ShuttleParkingSide[];
  cars: readonly ShuttleParkingCar[];
};

export function listShuttleParkingCarCells(
  car: ShuttleParkingCar,
): ShuttleParkingCell[] {
  return Array.from({ length: car.capacity }, (_, offset) => ({
    row: car.row + (car.orientation === "vertical" ? offset : 0),
    column: car.column + (car.orientation === "horizontal" ? offset : 0),
  }));
}

/** 車の向きに沿った2つの辺。先に小さい行・列の側。 */
function listCarAxisSides(
  car: ShuttleParkingCar,
): readonly [ShuttleParkingSide, ShuttleParkingSide] {
  return car.orientation === "horizontal"
    ? ["left", "right"]
    : ["top", "bottom"];
}

/** 車からその辺までの進路のマス。車に近い順。 */
export function listShuttleParkingPathCells(
  lot: ShuttleParkingLot,
  car: ShuttleParkingCar,
  side: ShuttleParkingSide,
): ShuttleParkingCell[] {
  const end = car.capacity - 1;
  switch (side) {
    case "top":
      return Array.from({ length: car.row }, (_, offset) => ({
        row: car.row - 1 - offset,
        column: car.column,
      }));
    case "bottom":
      return Array.from(
        { length: lot.size - car.row - end - 1 },
        (_, offset) => ({
          row: car.row + end + 1 + offset,
          column: car.column,
        }),
      );
    case "left":
      return Array.from({ length: car.column }, (_, offset) => ({
        row: car.row,
        column: car.column - 1 - offset,
      }));
    case "right":
      return Array.from(
        { length: lot.size - car.column - end - 1 },
        (_, offset) => ({
          row: car.row,
          column: car.column + end + 1 + offset,
        }),
      );
  }
}

/** 車が向きに沿って出られる辺。開いた辺だけを、小さい行・列の側から返す。 */
export function listShuttleParkingCarExitSides(
  lot: ShuttleParkingLot,
  car: ShuttleParkingCar,
): ShuttleParkingSide[] {
  return listCarAxisSides(car).filter((side) => lot.openSides.includes(side));
}

export function assertShuttleParkingLot(lot: ShuttleParkingLot): void {
  if (!Number.isInteger(lot.size) || lot.size < 2) {
    throw new RangeError(`Invalid shuttle parking lot size: ${lot.size}`);
  }
  if (
    lot.openSides.length === 0 ||
    new Set(lot.openSides).size !== lot.openSides.length ||
    lot.openSides.some((side) => !SHUTTLE_PARKING_SIDES.includes(side))
  ) {
    throw new RangeError("Shuttle parking lot needs distinct open sides");
  }

  const occupied = new Set<string>();
  lot.cars.forEach((car, carId) => {
    if (
      !SHUTTLE_PARKING_CAR_CAPACITIES.includes(car.capacity) ||
      !SHUTTLE_PARKING_COLORS.includes(car.color)
    ) {
      throw new RangeError(`Invalid shuttle parking car ${carId}`);
    }
    for (const { row, column } of listShuttleParkingCarCells(car)) {
      const key = `${row}:${column}`;
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(column) ||
        row < 0 ||
        column < 0 ||
        row >= lot.size ||
        column >= lot.size ||
        occupied.has(key)
      ) {
        throw new RangeError(`Shuttle parking car ${carId} does not fit`);
      }
      occupied.add(key);
    }
    if (listShuttleParkingCarExitSides(lot, car).length === 0) {
      throw new RangeError(
        `Shuttle parking car ${carId} cannot face an open side`,
      );
    }
  });
}
