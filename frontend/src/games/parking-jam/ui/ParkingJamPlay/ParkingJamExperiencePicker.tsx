import type { ParkingJamBoardConcept } from "@/games/parking-jam/ui/board/ParkingJamBoard";

type ParkingJamExperiencePickerProps = {
  concept: ParkingJamBoardConcept;
  onChange: (concept: ParkingJamBoardConcept) => void;
};

const CONCEPTS = [
  { value: "original", label: "現行" },
  { value: "plan", label: "順番を組み立てる" },
] as const satisfies readonly {
  value: ParkingJamBoardConcept;
  label: string;
}[];

export function ParkingJamExperiencePicker({
  concept,
  onChange,
}: ParkingJamExperiencePickerProps) {
  return (
    <div
      role="group"
      aria-label="パーキングジャムのプレイ体験比較"
      className="flex h-9 items-center gap-1 rounded-full bg-black/8 p-1 dark:bg-white/10"
    >
      {CONCEPTS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={concept === value}
          onClick={() => onChange(value)}
          className={`h-7 rounded-full px-3 text-xs font-semibold transition-colors ${concept === value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-200" : "text-slate-600 hover:bg-white/45 dark:text-slate-200 dark:hover:bg-white/10"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
