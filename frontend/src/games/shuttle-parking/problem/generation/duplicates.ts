import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import {
  SHUTTLE_PARKING_SIDES,
  type ShuttleParkingCar,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";

/** 色を、乗客の列に初めて出てくる順の番号に付け直す。列が同じ並びなら、色の名前が違っても同じ問題として扱う。 */
function createColorIndex(problem: ShuttleParkingProblem): Map<string, number> {
  const index = new Map<string, number>();
  for (const color of problem.passengers) {
    if (!index.has(color)) index.set(color, index.size);
  }
  return index;
}

type Transform = {
  cell: (row: number, column: number, size: number) => [number, number];
  side: Record<ShuttleParkingSide, ShuttleParkingSide>;
  swapsAxes: boolean;
};

/** 正方形の駐車場の回転・反転の8通り。 */
const transforms: readonly Transform[] = [
  {
    cell: (row, column) => [row, column],
    side: { top: "top", right: "right", bottom: "bottom", left: "left" },
    swapsAxes: false,
  },
  {
    cell: (row, column, size) => [column, size - 1 - row],
    side: { top: "right", right: "bottom", bottom: "left", left: "top" },
    swapsAxes: true,
  },
  {
    cell: (row, column, size) => [size - 1 - row, size - 1 - column],
    side: { top: "bottom", right: "left", bottom: "top", left: "right" },
    swapsAxes: false,
  },
  {
    cell: (row, column, size) => [size - 1 - column, row],
    side: { top: "left", right: "top", bottom: "right", left: "bottom" },
    swapsAxes: true,
  },
  {
    cell: (row, column, size) => [row, size - 1 - column],
    side: { top: "top", right: "left", bottom: "bottom", left: "right" },
    swapsAxes: false,
  },
  {
    cell: (row, column, size) => [size - 1 - row, column],
    side: { top: "bottom", right: "right", bottom: "top", left: "left" },
    swapsAxes: false,
  },
  {
    cell: (row, column) => [column, row],
    side: { top: "left", right: "bottom", bottom: "right", left: "top" },
    swapsAxes: true,
  },
  {
    cell: (row, column, size) => [size - 1 - column, size - 1 - row],
    side: { top: "right", right: "top", bottom: "left", left: "bottom" },
    swapsAxes: true,
  },
];

function transformCar(
  car: ShuttleParkingCar,
  size: number,
  transform: Transform,
): string {
  const end =
    car.orientation === "horizontal"
      ? [car.row, car.column + car.capacity - 1]
      : [car.row + car.capacity - 1, car.column];
  const [startRow, startColumn] = transform.cell(car.row, car.column, size);
  const [endRow, endColumn] = transform.cell(end[0]!, end[1]!, size);
  const orientation =
    transform.swapsAxes === (car.orientation === "horizontal") ? "v" : "h";
  return `${Math.min(startRow, endRow)}${Math.min(startColumn, endColumn)}${orientation}${car.capacity}`;
}

/**
 * 見た目のキー。回転・反転の8通りと、色を列の初出順で付け直したものの中で最も小さい書き方。
 * 同じキーの問題は、盤面を回したり色を塗り替えたりしただけの同じ問題。
 */
export function createShuttleParkingVisualKey(
  problem: ShuttleParkingProblem,
): string {
  const colors = createColorIndex(problem);
  const { lot } = problem;
  const passengers = problem.passengers
    .map((color) => colors.get(color))
    .join("");
  return transforms
    .map((transform) => {
      const sides = SHUTTLE_PARKING_SIDES.filter((side) =>
        lot.openSides.some((open) => transform.side[open] === side),
      ).join(",");
      const cars = lot.cars
        .map(
          (car) =>
            `${transformCar(car, lot.size, transform)}${colors.get(car.color)}`,
        )
        .sort()
        .join(".");
      return `${lot.size}|${sides}|${problem.bayCount}|${cars}|${passengers}`;
    })
    .sort()[0]!;
}

const REFINEMENT_ROUNDS = 4;

/**
 * 解き味のキー。車の並べ替えで同じになる、色（列の初出順）・定員・塞ぎの関係・列・待機枠の数。
 * 塞ぎの関係は、車ごとの進路と、その進路を塞ぐ車の集合。車の名前を外すため、車の印を「自分の色と定員」と
 * 「進路ごとの、塞ぐ車の印の組」から繰り返し作り直し、最後の印の組を並べて書く。
 * 違う関係の問題が同じキーになることはありうるが、同じ関係の問題が違うキーになることは無い（重なりを多めに見る向き）。
 */
export function createShuttleParkingPlayKey(
  problem: ShuttleParkingProblem,
): string {
  const colors = createColorIndex(problem);
  const { sides } = new AnalysisGame(problem);
  let labels = problem.lot.cars.map(
    (car) => `${colors.get(car.color)}-${car.capacity}`,
  );
  for (let round = 0; round < REFINEMENT_ROUNDS; round += 1) {
    labels = labels.map((label, carId) => {
      const rays = sides[carId]!.map((ray) =>
        labels
          .filter((_, other) => (ray >> other) & 1)
          .sort()
          .join("+"),
      ).sort();
      return `${label}[${rays.join("|")}]`;
    });
  }
  const passengers = problem.passengers
    .map((color) => colors.get(color))
    .join("");
  return `${problem.bayCount}|${[...labels].sort().join(";")}|${passengers}`;
}

/**
 * 2つの問題が同じ位置・向き・定員で持つ車の台数。色は見ない。片方を回転・反転した8通りのうち最も多いもの
 * （回転・反転すると重なる盤面も近い盤面として数える）。
 */
export function countSharedShuttleParkingCars(
  problem: ShuttleParkingProblem,
  other: ShuttleParkingProblem,
): number {
  const { size } = problem.lot;
  if (size !== other.lot.size) return 0;
  const placements = problem.lot.cars.map((car) =>
    transformCar(car, size, transforms[0]!),
  );
  return Math.max(
    ...transforms.map((transform) => {
      const moved = new Set(
        other.lot.cars.map((car) => transformCar(car, size, transform)),
      );
      return placements.filter((placement) => moved.has(placement)).length;
    }),
  );
}

/** 出せる車を一様に無作為に選び続けても、必ず全員を送り出せる問題。 */
export function isShuttleParkingTrivial(
  problem: ShuttleParkingProblem,
): boolean {
  return new AnalysisGame(problem).uniformWinProbability() >= 1;
}
