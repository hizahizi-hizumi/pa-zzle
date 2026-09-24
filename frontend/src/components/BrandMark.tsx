import { BrandSymbol } from "@/components/BrandMark/BrandSymbol";

type BrandMarkProps = {
  content?: "symbol-and-name" | "symbol";
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
  content = "symbol-and-name",
  size = "default",
  tone = "default",
}: BrandMarkProps) {
  if (content === "symbol") {
    return (
      <span
        role="img"
        aria-label="pa-zzle"
        className={`inline-flex items-center ${brandMarkClassNames[size][tone]}`}
      >
        <BrandSymbol size={size} />
      </span>
    );
  }

  return (
    <span
      className={`font-brand inline-flex items-center gap-2 ${brandMarkClassNames[size][tone]}`}
    >
      <BrandSymbol size={size} />
      <span>パズル pa-zzle</span>
    </span>
  );
}
