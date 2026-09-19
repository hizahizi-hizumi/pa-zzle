import {
  createParkingJamInitialState,
  type ParkingJamBoard,
  type ParkingJamMove,
} from "../../puzzle/board";
import { listParkingJamLegalMoves } from "../../puzzle/rules";
import type { ParkingJamSolvabilityAnalysis } from "../problem";

export function analyzeParkingJamSolvability(
  board: ParkingJamBoard,
): ParkingJamSolvabilityAnalysis {
  let state = createParkingJamInitialState(board);
  const solution: ParkingJamMove[] = [];
  const removalLayers: string[][] = [];

  while (state.remainingVehicleIds.length > 0) {
    const legalMoves = listParkingJamLegalMoves(board, state);
    const moveByVehicle = new Map(
      legalMoves.map((move) => [move.vehicleId, move]),
    );
    const removableVehicleIds = state.remainingVehicleIds.filter((vehicleId) =>
      moveByVehicle.has(vehicleId),
    );
    if (removableVehicleIds.length === 0) {
      return { status: "unsolvable", solution, removalLayers };
    }

    removalLayers.push(removableVehicleIds);
    for (const vehicleId of removableVehicleIds) {
      const move = moveByVehicle.get(vehicleId);
      if (move) solution.push(move);
    }
    const removed = new Set(removableVehicleIds);
    state = {
      remainingVehicleIds: state.remainingVehicleIds.filter(
        (vehicleId) => !removed.has(vehicleId),
      ),
    };
  }

  return { status: "solvable", solution, removalLayers };
}
