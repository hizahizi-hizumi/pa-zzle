type BrandMarkProps = {
  size?: "default" | "compact";
};

const brandMarkClassNames = {
  default: "font-semibold tracking-tight text-brand-foreground",
  compact:
    "select-none text-[11px] font-semibold tracking-[0.12em] text-brand-foreground",
} satisfies Record<NonNullable<BrandMarkProps["size"]>, string>;

export function BrandMark({ size = "default" }: BrandMarkProps) {
  return <span className={brandMarkClassNames[size]}>パズル pa-zzle</span>;
}
