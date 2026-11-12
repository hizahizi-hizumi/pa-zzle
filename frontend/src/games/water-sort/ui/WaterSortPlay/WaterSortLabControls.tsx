import type { WaterSortExperience } from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";
import { WATER_SORT_EXPERIENCES } from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";

const labels: Record<WaterSortExperience, string> = {
  classic: "現行",
  settle: "なじむ",
  touch: "つかむ",
};

type WaterSortLabControlsProps = {
  experience: WaterSortExperience;
  onChange: (experience: WaterSortExperience) => void;
  disabled?: boolean;
};

export function WaterSortLabControls({
  experience,
  onChange,
  disabled = false,
}: WaterSortLabControlsProps) {
  return (
    <div
      role="group"
      aria-label="体験比較"
      className="mb-2 flex shrink-0 justify-center gap-1.5 rounded-full bg-white/65 p-1 shadow-sm dark:bg-slate-900/65"
    >
      {WATER_SORT_EXPERIENCES.map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-pressed={experience === value}
          onClick={() => onChange(value)}
          className={`min-w-0 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--duration-normal) ${experience === value ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700/70"}`}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
