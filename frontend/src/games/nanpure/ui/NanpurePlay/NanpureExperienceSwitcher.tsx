import type { NanpureExperienceVariant } from "@/games/nanpure/ui/nanpure-experience-variant";
import { cn } from "@/lib/utils";

type NanpureExperienceSwitcherProps = {
  value: NanpureExperienceVariant;
  onChange: (variant: NanpureExperienceVariant) => void;
};

const options = [
  { value: "classic", label: "現行" },
  { value: "paint", label: "数字先行" },
] as const;

export function NanpureExperienceSwitcher({
  value,
  onChange,
}: NanpureExperienceSwitcherProps) {
  return (
    <nav
      aria-label="ナンプレ体験比較"
      className="mx-auto flex w-full max-w-xl shrink-0 justify-center gap-1 px-3 py-1.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            "min-w-0 flex-1 rounded-full border border-foreground/10 px-1 py-1.5 text-xs font-semibold transition-colors",
            value === option.value
              ? "bg-foreground text-background"
              : "bg-background/50 text-foreground/65 hover:bg-background",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}
