import { BrandLogo } from "@/components/BrandMark/BrandLogo";

type BrandMarkProps = {
  size?: "default" | "compact" | "title";
  tone?: "default" | "inverse";
};

const brandMarkToneClassNames = {
  // ブランド色は暗い配色の値を持たないので、暗い面では前景色で示す。
  default: "text-brand-foreground dark:text-foreground",
  inverse: "text-brand-inverse-foreground",
} satisfies Record<NonNullable<BrandMarkProps["tone"]>, string>;

export function BrandMark({
  size = "default",
  tone = "default",
}: BrandMarkProps) {
  return (
    <span
      role="img"
      aria-label="pa-zzle"
      className={`inline-flex items-center ${brandMarkToneClassNames[tone]}`}
    >
      <BrandLogo size={size} />
    </span>
  );
}
