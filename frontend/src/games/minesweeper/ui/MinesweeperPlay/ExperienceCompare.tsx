import type { MinesweeperVisualStyle } from "@/games/minesweeper/ui/board/MinesweeperCellFace";

type ExperienceCompareProps = {
  value: MinesweeperVisualStyle;
  onChange: (value: MinesweeperVisualStyle) => void;
};

const OPTIONS = [
  { value: "classic", label: "現行" },
  { value: "hybrid", label: "立体化" },
] as const;

/** `?experience=compare` の試遊時だけ表示する比較用の操作。採用版では除去する。 */
export function ExperienceCompare({ value, onChange }: ExperienceCompareProps) {
  return (
    <div
      role="group"
      aria-label="盤面デザイン比較"
      className="mb-4 flex items-center justify-center gap-1.5"
    >
      {OPTIONS.map(function renderOption(option) {
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-w-14 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast) ${
              value === option.value
                ? "bg-foreground text-background"
                : "bg-background/60 text-foreground/75 hover:bg-background"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
