import { BrandMark } from "@/components/BrandMark";
import { Link } from "@/router";

type BrandIdentityHeaderProps = {
  linkToHome?: boolean;
  size?: "compact" | "regular";
  /** プレイ中はゲームの地を透かし、それ以外ではブランドの反転面を使う。 */
  surface?: "brand" | "game";
};

const brandIdentityHeaderClassNames = {
  compact:
    "flex h-[calc(1.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-center px-3 pt-[env(safe-area-inset-top)]",
  regular:
    "flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center justify-center px-3 pt-[env(safe-area-inset-top)]",
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
  surface = "brand",
}: BrandIdentityHeaderProps) {
  const brandMark = (
    <BrandMark
      size={brandMarkSize[size]}
      tone={surface === "brand" ? "inverse" : "default"}
    />
  );

  return (
    <header
      className={`${brandIdentityHeaderClassNames[size]} ${surface === "brand" ? "bg-brand-inverse" : "bg-transparent"}`}
    >
      {linkToHome ? (
        <Link to="/" aria-label="pa-zzle ホーム" className="flex">
          {brandMark}
        </Link>
      ) : (
        brandMark
      )}
    </header>
  );
}
