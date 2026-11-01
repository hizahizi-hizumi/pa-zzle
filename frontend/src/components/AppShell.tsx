import type { ReactNode } from "react";

import { usePrepareAppDecisionSounds } from "@/components/app-decision-sound";
import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";

type AppShellProps = {
  children: ReactNode;
  /**
   * - `contained`: 読みやすい幅と余白に収める。
   * - `full`: 横幅いっぱいに使い、余白は内容に任せる。
   * - `fill`: ヘッダー下の残りの領域を縦横とも埋める。内容は `flex-1` で伸ばせる。
   * - `viewport`: ヘッダー下の、今見えている画面の高さちょうどに収め、ページをスクロールさせない。内容は `flex-1` で伸ばし、自分の中でスクロールさせる。
   */
  contentLayout?: "contained" | "full" | "fill" | "viewport";
};

const mainClassNames = {
  contained: "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12",
  full: "w-full",
  fill: "flex w-full flex-1 flex-col",
  // アドレスバーの伸び縮みで見えている高さが変わっても収まるよう、動的なビューポートの高さからヘッダーの高さを引く。
  viewport:
    "flex h-[calc(100dvh-3rem-env(safe-area-inset-top))] w-full flex-col",
} satisfies Record<NonNullable<AppShellProps["contentLayout"]>, string>;

export function AppShell({
  children,
  contentLayout = "contained",
}: AppShellProps) {
  usePrepareAppDecisionSounds();
  return (
    <div className="flex min-h-screen flex-col bg-muted/30 font-ui">
      <BrandIdentityHeader linkToHome size="regular" />
      <main className={mainClassNames[contentLayout]}>{children}</main>
    </div>
  );
}
