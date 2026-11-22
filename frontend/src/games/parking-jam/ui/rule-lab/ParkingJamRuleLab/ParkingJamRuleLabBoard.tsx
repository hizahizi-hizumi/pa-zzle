import type { CSSProperties } from "react";
import type {
  ParkingJamBoard,
  ParkingJamSide,
} from "@/games/parking-jam/puzzle/board";
import type {
  RuleLabScenario,
  RuleLabState,
} from "@/games/parking-jam/rule-lab/rule-lab";
import { vehicleColor } from "@/games/parking-jam/rule-lab/rule-lab";
import { ruleLabColorStyle } from "@/games/parking-jam/ui/rule-lab/rule-lab-colors";

type ParkingJamRuleLabBoardProps = {
  scenario: RuleLabScenario;
  state: RuleLabState;
  onExit: (vehicleId: string) => void;
  showAnalysis: boolean;
  outcomeByVehicle: ReadonlyMap<string, boolean>;
};

type WallSegment = {
  side: ParkingJamSide;
  start: number;
  length: number;
};

const EDGE_BAND = "7px";

/** 辺ごとに、開口に覆われていない区間を壁として返す。 */
function wallSegments(board: ParkingJamBoard): WallSegment[] {
  const segments: WallSegment[] = [];
  for (const side of ["up", "right", "down", "left"] as const) {
    const size = side === "up" || side === "down" ? board.width : board.height;
    let start: number | null = null;
    for (let offset = 0; offset <= size; offset += 1) {
      const open =
        offset === size ||
        board.roadOpenings.some(
          (opening) =>
            opening.side === side &&
            offset >= opening.startOffset &&
            offset < opening.startOffset + opening.length,
        );
      if (!open && start === null) start = offset;
      if (open && start !== null) {
        segments.push({ side, start, length: offset - start });
        start = null;
      }
    }
  }
  return segments;
}

/** 壁は、車を置く領域の外側の帯に描く。帯の中での位置は、内側の領域に対する割合で決める。 */
function wallStyle(board: ParkingJamBoard, wall: WallSegment): CSSProperties {
  const horizontal = wall.side === "up" || wall.side === "down";
  const size = horizontal ? board.width : board.height;
  const inner = `(100% - 2 * ${EDGE_BAND})`;
  const from = `calc(${EDGE_BAND} + ${inner} * ${wall.start / size})`;
  const span = `calc(${inner} * ${wall.length / size})`;
  return horizontal
    ? {
        left: from,
        width: span,
        height: EDGE_BAND,
        ...(wall.side === "up" ? { top: 0 } : { bottom: 0 }),
      }
    : {
        top: from,
        height: span,
        width: EDGE_BAND,
        ...(wall.side === "left" ? { left: 0 } : { right: 0 }),
      };
}

export function ParkingJamRuleLabBoard({
  scenario,
  state,
  onExit,
  showAnalysis,
  outcomeByVehicle,
}: ParkingJamRuleLabBoardProps) {
  const { board } = scenario;
  const walls = wallSegments(board);
  return (
    <div
      className="relative aspect-square w-full max-w-[470px] overflow-hidden rounded-xl bg-[#cbd5d1] shadow-inner"
      style={{ padding: EDGE_BAND }}
      aria-label="試作パーキングジャムの盤面"
    >
      {walls.map((wall) => (
        <div
          key={`${wall.side}-${wall.start}`}
          className="absolute bg-[#334155]"
          style={wallStyle(board, wall)}
        />
      ))}
      <div className="relative size-full bg-[#e4e9e8]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, #aab6b5 1px, transparent 1px),linear-gradient(to bottom,#aab6b5 1px, transparent 1px)",
            backgroundSize: `${100 / board.width}% ${100 / board.height}%`,
          }}
        />
        {board.vehicles.map((vehicle, index) => {
          if (!state.remainingVehicleIds.includes(vehicle.id)) return null;
          const color = vehicleColor(scenario, vehicle.id);
          const horizontal = vehicle.orientation === "horizontal";
          const hint = showAnalysis
            ? outcomeByVehicle.get(vehicle.id)
            : undefined;
          const style: CSSProperties = {
            top: `${(vehicle.row / board.height) * 100}%`,
            left: `${(vehicle.column / board.width) * 100}%`,
            width: `${((horizontal ? vehicle.length : 1) / board.width) * 100}%`,
            height: `${((horizontal ? 1 : vehicle.length) / board.height) * 100}%`,
            backgroundColor: ruleLabColorStyle(color),
          };
          return (
            <button
              key={vehicle.id}
              type="button"
              aria-label={`車${index + 1}・色${color}を出庫`}
              onClick={() => onExit(vehicle.id)}
              style={style}
              className={`absolute flex items-center justify-center rounded-lg border-2 border-[#334155] font-bold text-slate-950 shadow-[inset_0_-4px_0_#0002] outline-offset-2 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-blue-700 ${horizontal ? "gap-1" : "flex-col leading-none"}`}
            >
              <span className="text-[11px] sm:text-xs">{color}</span>
              <span className="text-base sm:text-lg">{index + 1}</span>
              <span className="text-[11px] opacity-65">
                {horizontal ? "↔" : "↕"}
              </span>
              {hint !== undefined && (
                <span className="absolute -right-1 -top-1 rounded-full border border-slate-600 bg-white px-1.5 py-0.5 text-[10px] text-slate-900">
                  {hint ? "○" : "×"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
