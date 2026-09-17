import { BrandMark } from "@/components/BrandMark";
import { Link } from "@/router";

type BrandIdentityHeaderProps = {
  linkToHome?: boolean;
  size?: "compact" | "regular";
};

const brandIdentityHeaderClassNames = {
  compact:
    "flex h-[calc(1.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-center bg-brand-inverse px-3 pt-[env(safe-area-inset-top)]",
  regular:
    "flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center justify-center bg-brand-inverse px-3 pt-[env(safe-area-inset-top)]",
} satisfies Record<NonNullable<BrandIdentityHeaderProps["size"]>, string>;

const brandMarkSize = {
  compact: "compact",
  regular: "default",
} satisfies Record<
  NonNullable<BrandIdentityHeaderProps["size"]>,
  "compact" | "default"
>;

export function BrandIdentityHeader({
  linkToHome = false,
  size = "compact",
}: BrandIdentityHeaderProps) {
  const brandMark = <BrandMark size={brandMarkSize[size]} tone="inverse" />;

  return (
    <header className={brandIdentityHeaderClassNames[size]}>
      {linkToHome ? <Link to="/">{brandMark}</Link> : brandMark}
    </header>
  );
}
