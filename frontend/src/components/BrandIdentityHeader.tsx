import { BrandMark } from "@/components/BrandMark";
import { Link } from "@/router";

type BrandIdentityHeaderProps = {
  linkToHome?: boolean;
};

export function BrandIdentityHeader({
  linkToHome = false,
}: BrandIdentityHeaderProps) {
  const brandMark = <BrandMark size="compact" tone="inverse" />;

  return (
    <header className="flex h-[calc(1.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-center bg-brand-inverse px-3 pt-[env(safe-area-inset-top)]">
      {linkToHome ? <Link to="/">{brandMark}</Link> : brandMark}
    </header>
  );
}
