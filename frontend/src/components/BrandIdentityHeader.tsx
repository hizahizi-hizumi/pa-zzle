import { BrandMark } from "@/components/BrandMark";
import { Link } from "@/router";

type BrandIdentityHeaderProps = {
  linkToHome?: boolean;
  size?: "compact" | "regular";
  /** プレイ中はゲームの地を使い、それ以外ではブランドの反転面を使う。 */
  surface?: "brand" | "game";
  /** 全画面のプレイ・結果では、上端の面をブラウザが参照できるよう固定する。 */
  pinned?: boolean;
};

const brandIdentityHeaderClassNames = {
  compact:
    "flex h-[calc(1.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-center pt-[env(safe-area-inset-top)] pl-[max(--spacing(3),env(safe-area-inset-left))] pr-[max(--spacing(3),env(safe-area-inset-right))]",
  regular:
    "flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center justify-center pt-[env(safe-area-inset-top)] pl-[max(--spacing(3),env(safe-area-inset-left))] pr-[max(--spacing(3),env(safe-area-inset-right))]",
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
  pinned = false,
}: BrandIdentityHeaderProps) {
  const brandMark = (
    <BrandMark
      size={brandMarkSize[size]}
      tone={surface === "brand" ? "inverse" : "default"}
    />
  );

  return (
    <header
      data-browser-surface={surface === "brand" ? "self" : undefined}
      className={`${brandIdentityHeaderClassNames[size]} ${surface === "brand" ? "bg-brand-inverse" : "bg-[var(--browser-surface,var(--background))]"} ${pinned ? "sticky top-0 z-20" : ""}`}
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
