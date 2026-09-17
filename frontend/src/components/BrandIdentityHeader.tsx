import { BrandMark } from "@/components/BrandMark";

export function BrandIdentityHeader() {
  return (
    <div className="flex h-[calc(1.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-center bg-brand-inverse px-3 pt-[env(safe-area-inset-top)]">
      <BrandMark size="compact" tone="inverse" />
    </div>
  );
}
