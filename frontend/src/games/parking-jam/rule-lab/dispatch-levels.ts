import type {
  ParkingJamSide,
  ParkingJamVehicleLength,
} from "@/games/parking-jam/puzzle/board";
import problems from "@/games/parking-jam/rule-lab/dispatch-levels.json";
import passengerProblemData from "@/games/parking-jam/rule-lab/passenger-problems.json";
import type {
  RuleLabColor,
  RuleLabScenario,
} from "@/games/parking-jam/rule-lab/rule-lab";

type ExportedProblem = {
  id: string;
  title: string;
  level: number;
  kind: string;
  bayCount: number;
  solutions: number;
  queue: string[];
  board: {
    width: number;
    height: number;
    vehicles: {
      id: string;
      row: number;
      column: number;
      orientation: string;
      length: number;
      color: string;
    }[];
    roadOpenings: { side: string; startOffset: number; length: number }[];
  };
};

export type DispatchLevelProblem = {
  id: string;
  title: string;
  level: number;
  kind: string;
  /** 研究用スクリプトが厳密探索で数えた、クリアできる出庫順の数。 */
  solutions: number;
  scenario: RuleLabScenario;
};

function toProblem(
  problem: ExportedProblem,
  mode: "dispatch" | "passengers",
): DispatchLevelProblem {
  return {
    id: problem.id,
    title: problem.title,
    level: problem.level,
    kind: problem.kind,
    solutions: problem.solutions,
    scenario: {
      mode,
      bayCount: problem.bayCount,
      queue: problem.queue as RuleLabColor[],
      colors: problem.board.vehicles.map(
        (vehicle) => vehicle.color as RuleLabColor,
      ),
      board: {
        width: problem.board.width,
        height: problem.board.height,
        vehicles: problem.board.vehicles.map((vehicle) => ({
          id: vehicle.id,
          row: vehicle.row,
          column: vehicle.column,
          orientation:
            vehicle.orientation === "horizontal" ? "horizontal" : "vertical",
          length: vehicle.length as ParkingJamVehicleLength,
        })),
        fixedAreas: [],
        roadOpenings: problem.board.roadOpenings.map((opening) => ({
          side: opening.side as ParkingJamSide,
          startOffset: opening.startOffset,
          length: opening.length,
        })),
      },
    },
  };
}

/** `scripts/research/parking_jam_dispatch_levels.examples.json` から画面に要る項目だけを写した問題例。 */
export const dispatchLevelProblems: readonly DispatchLevelProblem[] = (
  problems as ExportedProblem[]
).map((problem) => toProblem(problem, "dispatch"));

/** `scripts/research/parking_jam_passenger_examples.json` から画面に要る項目だけを写した乗客列型の問題例。 */
export const passengerProblems: readonly DispatchLevelProblem[] = (
  passengerProblemData as ExportedProblem[]
).map((problem) => toProblem(problem, "passengers"));
