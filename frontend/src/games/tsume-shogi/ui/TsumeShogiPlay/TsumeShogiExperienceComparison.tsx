import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type TsumeShogiExperience = "current" | "focus";

type TsumeShogiExperienceComparisonProps = {
  experience: TsumeShogiExperience;
  onChange: (experience: TsumeShogiExperience) => void;
};

const experiences = [
  { value: "current", label: "現行" },
  { value: "focus", label: "駒を運ぶ" },
] as const;

/** 比較用の操作。通常プレイでは表示しない。 */
export function TsumeShogiExperienceComparison({
  experience,
  onChange,
}: TsumeShogiExperienceComparisonProps) {
  return (
    <div
      role="group"
      aria-label="詰将棋の体験案を比較"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto flex w-fit max-w-[calc(100%-1rem)] items-center gap-2 rounded-xl border border-border bg-background/95 px-2 py-1.5 text-foreground shadow-lg backdrop-blur-sm sm:inset-x-auto sm:right-3 sm:mx-0"
    >
      <span className="shrink-0 px-1 text-xs text-muted-foreground">比較</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={experience}
        onValueChange={(value) => {
          if (value === "current" || value === "focus") {
            onChange(value);
          }
        }}
      >
        {experiences.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value} aria-label={label}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
