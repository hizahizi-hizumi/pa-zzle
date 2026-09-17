type BrandMarkProps = {
  size?: "default" | "compact";
  tone?: "default" | "inverse";
};

const brandMarkClassNames = {
  default: {
    default: "font-semibold tracking-tight text-brand-foreground",
    inverse: "font-semibold tracking-tight text-brand-inverse-foreground",
  },
  compact: {
    default:
      "select-none text-[11px] font-semibold tracking-[0.12em] text-brand-foreground",
    inverse:
      "select-none text-[11px] font-semibold tracking-[0.12em] text-brand-inverse-foreground",
  },
} satisfies Record<
  NonNullable<BrandMarkProps["size"]>,
  Record<NonNullable<BrandMarkProps["tone"]>, string>
>;

export function BrandMark({
  size = "default",
  tone = "default",
}: BrandMarkProps) {
  return (
    <span className={brandMarkClassNames[size][tone]}>パズル pa-zzle</span>
  );
}
