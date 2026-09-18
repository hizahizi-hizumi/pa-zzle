import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";

type AppShellProps = {
  children: ReactNode;
  contentLayout?: "contained" | "full";
};

const mainClassNames = {
  contained: "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12",
  full: "w-full",
} satisfies Record<NonNullable<AppShellProps["contentLayout"]>, string>;

export function AppShell({
  children,
  contentLayout = "contained",
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <BrandIdentityHeader linkToHome size="regular" />
      <main className={mainClassNames[contentLayout]}>{children}</main>
    </div>
  );
}
