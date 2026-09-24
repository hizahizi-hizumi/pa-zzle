import { BrandLogo } from "@/components/BrandMark/BrandLogo";

type BrandMarkProps = {
  content?: "symbol-and-name" | "name";
  size?: "default" | "compact";
  tone?: "default" | "inverse";
};

const brandMarkToneClassNames = {
  default: "text-brand-foreground",
  inverse: "text-brand-inverse-foreground",
} satisfies Record<NonNullable<BrandMarkProps["tone"]>, string>;

export function BrandMark({
  content = "symbol-and-name",
  size = "default",
  tone = "default",
}: BrandMarkProps) {
  return (
    <span
      role="img"
      aria-label="pa-zzle"
      className={`inline-flex items-center ${brandMarkToneClassNames[tone]}`}
    >
      <BrandLogo content={content} size={size} />
    </span>
  );
}
