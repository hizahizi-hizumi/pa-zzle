import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { countShuttleParkingStates } from "@/games/shuttle-parking/puzzle/clearability";
import {
  SHUTTLE_PARKING_SIDES,
  type ShuttleParkingCapacity,
  type ShuttleParkingCar,
  type ShuttleParkingColor,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  assertShuttleParkingPuzzle,
  type ShuttleParkingPuzzle,
} from "@/games/shuttle-parking/puzzle/rules";
import { isPositiveInteger, isRecordObject } from "@/lib/type-guards";

export type ShuttleParkingProblem = ShuttleParkingPuzzle;

/** 問題の符号（`seed`）の書き方が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const SHUTTLE_PARKING_GENERATOR_VERSION = "1";

export type ShuttleParkingProblemConditions = {
  size: number;
};

/**
 * 同じ問題を再現するための情報。`seed` は乱数の種ではなく問題そのものの符号（`createShuttleParkingProblemIdentity`）なので、
 * 生成器を走らせずに問題を復元できる。
 */
export type ShuttleParkingProblemIdentity = {
  generatorVersion: typeof SHUTTLE_PARKING_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: ShuttleParkingProblemConditions;
};

export type ShuttleParkingRecordedProblemIdentity =
  RecordedProblemIdentity<ShuttleParkingProblemConditions>;

export type ShuttleParkingIdentifiedProblem = {
  problem: ShuttleParkingProblem;
  identity: ShuttleParkingProblemIdentity;
};

// 確かめた範囲（車8台・6×6〜7×7・待機枠2〜4）を含み、説明の例に使う小さな駐車場も受け付ける範囲。
const minimumLotSize = 4;
const maximumLotSize = 7;
const maximumCarCount = 8;
const maximumBayCount = 4;
const sideCodes = {
  top: "t",
  right: "r",
  bottom: "b",
  left: "l",
} as const satisfies Record<ShuttleParkingSide, string>;
const orientationCodes = { horizontal: "h", vertical: "v" } as const;
const carPattern = /^([0-8])([0-8])([hv])([23])([a-d])$/;
const seedPattern =
  /^([4-9])([trbl]+)([1-9])-((?:[0-8][0-8][hv][23][a-d])+)-([a-d]+)$/;
const carCodeLength = 5;

function isLotSize(value: unknown): value is number {
  return (
    isPositiveInteger(value) &&
    minimumLotSize <= value &&
    value <= maximumLotSize
  );
}

export function assertShuttleParkingProblem(
  problem: ShuttleParkingProblem,
): void {
  if (!isLotSize(problem.lot.size)) {
    throw new RangeError(
      `Unsupported shuttle parking lot size: ${problem.lot.size}`,
    );
  }
  if (
    problem.lot.cars.length > maximumCarCount ||
    problem.bayCount > maximumBayCount
  ) {
    throw new RangeError(
      `Unsupported shuttle parking problem size: ${problem.lot.cars.length} cars, ${problem.bayCount} bays`,
    );
  }
  assertShuttleParkingPuzzle(problem);
  countShuttleParkingStates(problem);
}

function encodeCar(car: ShuttleParkingCar): string {
  return `${car.row}${car.column}${orientationCodes[car.orientation]}${car.capacity}${car.color}`;
}

function decodeCar(code: string): ShuttleParkingCar | null {
  const matched = carPattern.exec(code);
  if (!matched) return null;
  const [, row = "", column = "", orientation, capacity, color = ""] = matched;
  return {
    row: Number(row),
    column: Number(column),
    orientation: orientation === "h" ? "horizontal" : "vertical",
    capacity: Number(capacity) as ShuttleParkingCapacity,
    color: color as ShuttleParkingColor,
  };
}

/**
 * `seed` から問題を復号する。書き方が違うときと、駐車場・乗客・座席が合わないときは `null`。
 * 書き方: `<駐車場の辺の長さ><開いた辺（t・r・b・l の順）><待機枠の数>-<車>-<乗客の列>`。
 * 車は1台を「行・列・向き（h・v）・定員・色」の5文字で並べ、乗客は先頭から色を並べる。
 * 例: 6×6 で上と右が開き、待機枠3つ、車2台の問題 `6tr3-00h2a20v3b-abbab`。
 */
function decodeShuttleParkingProblem(
  seed: string,
): ShuttleParkingProblem | null {
  const matched = seedPattern.exec(seed);
  if (!matched) return null;
  const [, size = "", sides = "", bays = "", cars = "", passengers = ""] =
    matched;
  const openSides = SHUTTLE_PARKING_SIDES.filter((side) =>
    sides.includes(sideCodes[side]),
  );
  const isCanonicalSides =
    openSides.map((side) => sideCodes[side]).join("") === sides;
  const decodedCars = Array.from(
    { length: cars.length / carCodeLength },
    (_, index) =>
      decodeCar(cars.slice(index * carCodeLength, (index + 1) * carCodeLength)),
  );
  if (!isCanonicalSides || decodedCars.some((car) => car === null)) {
    return null;
  }

  const problem: ShuttleParkingProblem = {
    lot: {
      size: Number(size),
      openSides,
      cars: decodedCars.filter((car) => car !== null),
    },
    passengers: Array.from(passengers) as ShuttleParkingColor[],
    bayCount: Number(bays),
  };
  try {
    assertShuttleParkingProblem(problem);
  } catch {
    return null;
  }
  return problem;
}

export function createShuttleParkingProblemSeed(
  problem: ShuttleParkingProblem,
): ProblemSeed {
  const { lot, passengers, bayCount } = problem;
  const sides = SHUTTLE_PARKING_SIDES.filter((side) =>
    lot.openSides.includes(side),
  )
    .map((side) => sideCodes[side])
    .join("");
  return `${lot.size}${sides}${bayCount}-${lot.cars.map(encodeCar).join("")}-${passengers.join("")}`;
}

export function createShuttleParkingProblemIdentity(
  problem: ShuttleParkingProblem,
): ShuttleParkingProblemIdentity {
  return {
    generatorVersion: SHUTTLE_PARKING_GENERATOR_VERSION,
    seed: createShuttleParkingProblemSeed(problem),
    conditions: { size: problem.lot.size },
  };
}

/** identity の `seed` から問題を復号する。生成器は走らせない。 */
export function restoreShuttleParkingProblem(
  identity: ShuttleParkingProblemIdentity,
): ShuttleParkingIdentifiedProblem {
  if (identity.generatorVersion !== SHUTTLE_PARKING_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported shuttle parking generator version: ${identity.generatorVersion}`,
    );
  }
  const problem = decodeShuttleParkingProblem(identity.seed);
  if (!problem || problem.lot.size !== identity.conditions.size) {
    throw new RangeError(
      `Invalid shuttle parking problem seed: ${identity.seed}`,
    );
  }
  return { problem, identity };
}

/** 記録・診断など外部から読み戻した値が、復元できる識別情報かを確かめる。 */
export function isCurrentShuttleParkingProblemIdentity(
  value: unknown,
): value is ShuttleParkingProblemIdentity {
  if (
    !isRecordObject(value) ||
    !isRecordObject(value.conditions) ||
    value.generatorVersion !== SHUTTLE_PARKING_GENERATOR_VERSION ||
    typeof value.seed !== "string"
  ) {
    return false;
  }
  const problem = decodeShuttleParkingProblem(value.seed);
  return problem !== null && problem.lot.size === value.conditions.size;
}

export function isShuttleParkingRecordedProblemIdentity(
  value: unknown,
): value is ShuttleParkingRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: SHUTTLE_PARKING_GENERATOR_VERSION,
      isProblemIdentity: isCurrentShuttleParkingProblemIdentity,
    }) && isLotSize(value.conditions.size)
  );
}

export const _private = {
  decodeShuttleParkingProblem,
};
