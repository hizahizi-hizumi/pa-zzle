import type { CSSProperties } from "react";
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

export function ParkingJamRuleLabBoard({
  scenario,
  state,
  onExit,
  showAnalysis,
  outcomeByVehicle,
}: ParkingJamRuleLabBoardProps) {
  const { board } = scenario;
  return (
    <div
      className="relative aspect-square w-full max-w-[470px] overflow-hidden rounded-2xl border-[7px] border-slate-500 bg-[#e4e9e8] shadow-inner"
      aria-label="試作パーキングジャムの盤面"
    >
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
            className="absolute flex items-center justify-center gap-1 rounded-lg border-2 border-[#334155] font-bold text-slate-950 shadow-[inset_0_-4px_0_#0002] outline-offset-2 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <span className="text-[10px] sm:text-xs">{color}</span>
            <span className="text-sm sm:text-lg">{index + 1}</span>
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
  );
}
