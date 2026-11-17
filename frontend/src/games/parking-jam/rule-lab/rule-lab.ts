import type {
  ParkingJamBoard,
  ParkingJamState,
} from "@/games/parking-jam/puzzle/board";
import { listParkingJamLegalMoves } from "@/games/parking-jam/puzzle/rules";
import largeDispatch from "@/games/parking-jam/rule-lab/dispatch-large.json";
import smallDispatch from "@/games/parking-jam/rule-lab/dispatch-small.json";
import { largeRuleLabBoard } from "@/games/parking-jam/rule-lab/large-board";
import largeColors from "@/games/parking-jam/rule-lab/large-colors.json";
import { pairBoard } from "@/games/parking-jam/rule-lab/pair-board";
import pairColors from "@/games/parking-jam/rule-lab/pair-colors.json";
import largeQueue from "@/games/parking-jam/rule-lab/queue-large.json";
import smallQueue from "@/games/parking-jam/rule-lab/queue-small.json";

export type RuleLabMode = "standard" | "passengers" | "pairs" | "dispatch";
export type RuleLabColor = "A" | "B" | "C" | "D" | "E" | "F";
export type RuleLabSize = "small" | "large";
export type RuleLabBayCount = 2 | 3 | 4 | 5;
type WaitingVehicle = { vehicleId: string; boarded: number };
export type RuleLabState = {
  remainingVehicleIds: readonly string[];
  waiting: readonly WaitingVehicle[];
  nextPassengerIndex: number;
  departedVehicleIds: readonly string[];
};
export type RuleLabScenario = {
  board: ParkingJamBoard;
  mode: RuleLabMode;
  colors: readonly RuleLabColor[];
  queue: readonly RuleLabColor[];
  bayCount: number;
};

export function getRuleLabScenario(
  mode: RuleLabMode,
  size: RuleLabSize = "small",
  bayCount: RuleLabBayCount = 2,
): RuleLabScenario {
  return {
    board: size === "small" ? pairBoard : largeRuleLabBoard,
    mode,
    colors:
      size === "small"
        ? (pairColors as RuleLabColor[])
        : (largeColors as RuleLabColor[]),
    queue:
      mode === "passengers"
        ? size === "small"
          ? (smallQueue as RuleLabColor[])
          : (largeQueue as RuleLabColor[])
        : mode === "dispatch"
          ? size === "small"
            ? (smallDispatch as RuleLabColor[])
            : (largeDispatch as RuleLabColor[])
          : [],
    bayCount:
      mode === "standard"
        ? 0
        : mode === "pairs" || mode === "dispatch"
          ? bayCount
          : 3,
  };
}

export function createRuleLabState(scenario: RuleLabScenario): RuleLabState {
  return {
    remainingVehicleIds: scenario.board.vehicles.map((vehicle) => vehicle.id),
    waiting: [],
    nextPassengerIndex: 0,
    departedVehicleIds: [],
  };
}

export function vehicleColor(
  scenario: RuleLabScenario,
  vehicleId: string,
): RuleLabColor {
  const index = scenario.board.vehicles.findIndex(
    (vehicle) => vehicle.id === vehicleId,
  );
  const color = scenario.colors[index];
  if (!color) throw new Error(`Unknown vehicle: ${vehicleId}`);
  return color;
}

export function legalRuleLabExits(
  scenario: RuleLabScenario,
  state: RuleLabState,
): string[] {
  if (scenario.mode !== "standard" && state.waiting.length >= scenario.bayCount)
    return [];
  const moves = listParkingJamLegalMoves(
    scenario.board,
    state as ParkingJamState,
  );
  return [...new Set(moves.map((move) => move.vehicleId))];
}

function settlePassengers(
  scenario: RuleLabScenario,
  waiting: WaitingVehicle[],
  initialHead: number,
): {
  waiting: WaitingVehicle[];
  nextPassengerIndex: number;
  newlyDeparted: string[];
} {
  const docked = waiting.map((vehicle) => ({ ...vehicle }));
  const departed: string[] = [];
  let head = initialHead;
  while (head < scenario.queue.length) {
    const index = docked.findIndex(
      (vehicle) =>
        vehicleColor(scenario, vehicle.vehicleId) === scenario.queue[head],
    );
    if (index < 0) break;
    const target = docked[index];
    if (!target) throw new Error("Missing waiting vehicle");
    target.boarded += 1;
    head += 1;
    const capacity = scenario.board.vehicles.find(
      (vehicle) => vehicle.id === target.vehicleId,
    )?.length;
    if ((scenario.mode === "dispatch" ? 1 : capacity) === target.boarded) {
      departed.push(target.vehicleId);
      docked.splice(index, 1);
    }
  }
  return { waiting: docked, nextPassengerIndex: head, newlyDeparted: departed };
}

function settlePairs(
  scenario: RuleLabScenario,
  waiting: WaitingVehicle[],
): {
  waiting: WaitingVehicle[];
  newlyDeparted: string[];
} {
  const docked = waiting.map((vehicle) => ({ ...vehicle }));
  const departed: string[] = [];
  for (const color of ["A", "B", "C", "D", "E", "F"] as const) {
    const matching = docked.filter(
      (vehicle) => vehicleColor(scenario, vehicle.vehicleId) === color,
    );
    if (matching.length !== 2) continue;
    for (const vehicle of matching) {
      docked.splice(
        docked.findIndex(
          (candidate) => candidate.vehicleId === vehicle.vehicleId,
        ),
        1,
      );
      departed.push(vehicle.vehicleId);
    }
  }
  return { waiting: docked, newlyDeparted: departed };
}

export function applyRuleLabExit(
  scenario: RuleLabScenario,
  state: RuleLabState,
  vehicleId: string,
): RuleLabState | null {
  if (!legalRuleLabExits(scenario, state).includes(vehicleId)) return null;
  const remainingVehicleIds = state.remainingVehicleIds.filter(
    (id) => id !== vehicleId,
  );
  if (scenario.mode === "standard") {
    return {
      ...state,
      remainingVehicleIds,
      departedVehicleIds: [...state.departedVehicleIds, vehicleId],
    };
  }
  const waiting = [...state.waiting, { vehicleId, boarded: 0 }];
  const settled =
    scenario.mode === "passengers" || scenario.mode === "dispatch"
      ? settlePassengers(scenario, waiting, state.nextPassengerIndex)
      : {
          ...settlePairs(scenario, waiting),
          nextPassengerIndex: state.nextPassengerIndex,
        };
  return {
    remainingVehicleIds,
    waiting: settled.waiting,
    nextPassengerIndex: settled.nextPassengerIndex,
    departedVehicleIds: [...state.departedVehicleIds, ...settled.newlyDeparted],
  };
}

export function isRuleLabWon(
  scenario: RuleLabScenario,
  state: RuleLabState,
): boolean {
  return (
    state.remainingVehicleIds.length === 0 &&
    state.waiting.length === 0 &&
    state.nextPassengerIndex === scenario.queue.length
  );
}

export function isRuleLabStuck(
  scenario: RuleLabScenario,
  state: RuleLabState,
): boolean {
  return (
    !isRuleLabWon(scenario, state) &&
    legalRuleLabExits(scenario, state).length === 0
  );
}

/** 記録なしの試作盤面に限定した全探索。初手の正解を表示するときだけ呼ぶ。 */
export function analyzeRuleLab(
  scenario: RuleLabScenario,
  current: RuleLabState,
) {
  const cache = new Map<string, number>();
  function countWins(state: RuleLabState): number {
    if (isRuleLabWon(scenario, state)) return 1;
    const key = `${state.remainingVehicleIds.join(",")}|${state.waiting
      .map((vehicle) => `${vehicle.vehicleId}:${vehicle.boarded}`)
      .join(",")}|${state.nextPassengerIndex}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const count = legalRuleLabExits(scenario, state).reduce((total, id) => {
      const next = applyRuleLabExit(scenario, state, id);
      return total + (next ? countWins(next) : 0);
    }, 0);
    cache.set(key, count);
    return count;
  }
  const exits = legalRuleLabExits(scenario, current);
  return {
    totalWinningSequences: countWins(current),
    exits: exits.map((vehicleId) => {
      const next = applyRuleLabExit(scenario, current, vehicleId);
      return { vehicleId, canWin: next !== null && countWins(next) > 0 };
    }),
  };
}
