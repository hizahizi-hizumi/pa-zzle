import {
  createProblemSeededRandom,
  type ProblemRandom,
  type ProblemSeed,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";
import { findShuttleParkingMinimumBays } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import {
  listShuttleParkingCarCells,
  listShuttleParkingCarExitSides,
  listShuttleParkingPathCells,
  SHUTTLE_PARKING_COLORS,
  type ShuttleParkingCapacity,
  type ShuttleParkingCar,
  type ShuttleParkingLot,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";

/**
 * 生成条件（D-03）。車8台、駐車場は 6×6 か 7×7、出口は上だけか上と右、定員は2と3を半々に引く、
 * 色は3色か4色か2台ずつの組。待機枠は解ける最小の数（2〜4。範囲の外は捨てる）。レベルでは絞らない。
 */
export const SHUTTLE_PARKING_CAR_COUNT = 8;
export const SHUTTLE_PARKING_LOT_SIZES = [6, 7] as const;
export const SHUTTLE_PARKING_OPENINGS = {
  adjacent2: ["top", "right"],
  one: ["top"],
} as const satisfies Record<string, readonly ShuttleParkingSide[]>;
export type ShuttleParkingOpening = keyof typeof SHUTTLE_PARKING_OPENINGS;
export const SHUTTLE_PARKING_COLOR_SCHEMES = ["3", "4", "pairs"] as const;
export type ShuttleParkingColorScheme =
  (typeof SHUTTLE_PARKING_COLOR_SCHEMES)[number];

const LONG_CAR_SHARE = 0.5;
/** すでに出せる車のどれかを塞ぐ位置を選ぶ確率。逆順が必ず出せる順になるよう、置く時点で出られる車だけを置く。 */
const BLOCKING_PLACEMENT_SHARE = 0.8;
const BOARD_ATTEMPTS = 200;
const MINIMUM_BAY_COUNT = 2;
const MAXIMUM_BAY_COUNT = 4;

export type ShuttleParkingGenerationConditions = {
  size: (typeof SHUTTLE_PARKING_LOT_SIZES)[number];
  opening: ShuttleParkingOpening;
};

type Placement = Omit<ShuttleParkingCar, "color">;

/** 駐車場に置ける車の位置。横・縦、定員2・3の順に、行・列の順で並べる。 */
function listPlacements(size: number): Placement[] {
  const placements: Placement[] = [];
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (const capacity of [2, 3] as const) {
      const rows = size - (orientation === "vertical" ? capacity : 1) + 1;
      const columns = size - (orientation === "horizontal" ? capacity : 1) + 1;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          placements.push({ row, column, orientation, capacity });
        }
      }
    }
  }
  return placements;
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function occupies(
  placement: Placement,
  occupied: ReadonlySet<string>,
): boolean {
  return listShuttleParkingCarCells({ ...placement, color: "a" }).some(
    ({ row, column }) => occupied.has(cellKey(row, column)),
  );
}

function canExit(
  lot: Omit<ShuttleParkingLot, "cars">,
  placement: Placement,
  occupied: ReadonlySet<string>,
): boolean {
  const car = { ...placement, color: "a" as const };
  return listShuttleParkingCarExitSides({ ...lot, cars: [] }, car).some(
    (side) =>
      listShuttleParkingPathCells({ ...lot, cars: [] }, car, side).every(
        ({ row, column }) => !occupied.has(cellKey(row, column)),
      ),
  );
}

function occupy(placements: readonly Placement[]): Set<string> {
  return new Set(
    placements.flatMap((placement) =>
      listShuttleParkingCarCells({ ...placement, color: "a" }).map(
        ({ row, column }) => cellKey(row, column),
      ),
    ),
  );
}

/** 置いた車のうち、いま出られる車の番号。 */
function listExitable(
  lot: Omit<ShuttleParkingLot, "cars">,
  placements: readonly Placement[],
): Set<number> {
  return new Set(
    placements.flatMap((placement, index) =>
      canExit(
        lot,
        placement,
        occupy(placements.filter((_, other) => other !== index)),
      )
        ? [index]
        : [],
    ),
  );
}

/** 置く時点で出口へ出られる車だけを、1台ずつ置く。置けなくなったら `null`。 */
function placeCars(
  lot: Omit<ShuttleParkingLot, "cars">,
  candidates: readonly Placement[],
  random: ProblemRandom,
): Placement[] | null {
  const usable = candidates.filter((placement) =>
    canExit(lot, placement, new Set()),
  );
  const placed: Placement[] = [];
  for (let index = 0; index < SHUTTLE_PARKING_CAR_COUNT; index += 1) {
    const occupied = occupy(placed);
    let options = usable.filter(
      (placement) =>
        !occupies(placement, occupied) && canExit(lot, placement, occupied),
    );
    if (options.length === 0) return null;
    const capacity: ShuttleParkingCapacity = random() < LONG_CAR_SHARE ? 3 : 2;
    const sized = options.filter(
      (placement) => placement.capacity === capacity,
    );
    if (sized.length) options = sized;
    const before = listExitable(lot, placed);
    if (before.size && random() < BLOCKING_PLACEMENT_SHARE) {
      const blocking = options.filter((placement) => {
        const after = listExitable(lot, [...placed, placement]);
        return [...before].some((carIndex) => !after.has(carIndex));
      });
      if (blocking.length) options = blocking;
    }
    placed.push(pickProblemValue(options, random));
  }
  return placed;
}

function assignColors(
  scheme: ShuttleParkingColorScheme,
  random: ProblemRandom,
): ShuttleParkingCar["color"][] {
  const count =
    scheme === "pairs" ? SHUTTLE_PARKING_CAR_COUNT / 2 : Number(scheme);
  return shuffleProblemValues(
    Array.from(
      { length: SHUTTLE_PARKING_CAR_COUNT },
      (_, index) => SHUTTLE_PARKING_COLORS[index % count]!,
    ),
    random,
  );
}

/**
 * 1つの seed から、生成条件どおりの候補を1つ作る。待機枠は解ける最小の数にし、それが範囲の外なら `null`。
 * 「色」の組（3色・4色・2台ずつ）は seed から引く。
 */
export function generateShuttleParkingCandidate(
  conditions: ShuttleParkingGenerationConditions,
  seed: ProblemSeed,
): ShuttleParkingProblem | null {
  const random = createProblemSeededRandom(seed);
  const lot = {
    size: conditions.size,
    openSides: SHUTTLE_PARKING_OPENINGS[conditions.opening],
  };
  const candidates = listPlacements(conditions.size);
  let placements: Placement[] | null = null;
  for (let attempt = 0; attempt < BOARD_ATTEMPTS && !placements; attempt += 1) {
    placements = placeCars(lot, candidates, random);
  }
  if (!placements) return null;
  const colors = assignColors(
    pickProblemValue(SHUTTLE_PARKING_COLOR_SCHEMES, random),
    random,
  );
  const cars = placements.map((placement, index) => ({
    ...placement,
    color: colors[index]!,
  }));
  const passengers = shuffleProblemValues(
    cars.flatMap(({ color, capacity }) =>
      Array.from({ length: capacity }, () => color),
    ),
    random,
  );
  const problem = { lot: { ...lot, cars }, passengers, bayCount: 0 };
  const bayCount = findShuttleParkingMinimumBays(problem);
  return bayCount !== null &&
    MINIMUM_BAY_COUNT <= bayCount &&
    bayCount <= MAXIMUM_BAY_COUNT
    ? { ...problem, bayCount }
    : null;
}
