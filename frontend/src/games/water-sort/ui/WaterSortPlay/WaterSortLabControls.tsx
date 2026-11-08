import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";

type WaterSortLabControlsProps = {
  appearance: WaterSortAppearance;
  onChange: (appearance: WaterSortAppearance) => void;
};

const appearances = [
  { value: "classic", label: "現行" },
  { value: "glass", label: "硝子" },
] as const;

/** このIssueの比較試作中だけ表示する切り替え操作。 */
export function WaterSortLabControls({
  appearance,
  onChange,
}: WaterSortLabControlsProps) {
  return (
    <fieldset
      aria-label="ウォーターソート体験比較"
      className="z-10 mb-2 flex shrink-0 gap-1 rounded-full bg-card/90 p-1 shadow-sm ring-1 ring-border/60 backdrop-blur"
    >
      {appearances.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={appearance === value}
          onClick={() => onChange(value)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-(--duration-fast) ${appearance === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"}`}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
