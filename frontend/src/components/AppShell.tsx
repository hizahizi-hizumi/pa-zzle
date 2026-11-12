import type { ReactNode } from "react";
import { useBrowserSurface } from "@/components/AppShell/use-browser-surface";
import { useAppBackgroundMusic } from "@/components/app-background-music";
import { usePrepareAppDecisionSounds } from "@/components/app-decision-sound";
import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { BrowserBottomSurface } from "@/components/BrowserBottomSurface";

type AppShellProps = {
  children: ReactNode;
  /**
   * - `contained`: 読みやすい幅と余白に収める。
   * - `full`: 横幅いっぱいに使い、余白は内容に任せる。
   * - `fill`: ヘッダー下の残りの領域を縦横とも埋める。内容は `flex-1` で伸ばせる。
   * - `viewport`: ヘッダー下の、今見えている画面の高さちょうどに収め、ページをスクロールさせない。内容は `flex-1` で伸ばし、自分の中でスクロールさせる。
   *   地は内容が敷き、ブランドの帯と下端の面をその地につなげる。
   */
  contentLayout?: "contained" | "full" | "fill" | "viewport";
};

const mainClassNames = {
  contained: "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12",
  full: "w-full",
  fill: "flex w-full flex-1 flex-col",
  // アドレスバーの伸び縮みで見えている高さが変わっても収まるよう、動的なビューポートの高さからブランドの帯と下端の面の高さを引く。
  viewport:
    "flex h-[calc(100dvh-2.5rem-env(safe-area-inset-top))] w-full flex-col",
} satisfies Record<NonNullable<AppShellProps["contentLayout"]>, string>;

export function AppShell({
  children,
  contentLayout = "contained",
}: AppShellProps) {
  usePrepareAppDecisionSounds();
  useAppBackgroundMusic();
  useBrowserSurface();

  // 内容が敷く地を透かすよう、地を内容に任せる画面では、外枠とその中の面を塗らない。
  const hasContentGround = contentLayout === "viewport";

  return (
    <div
      className={`flex min-h-dvh flex-col font-ui ${hasContentGround ? "" : "bg-background"}`}
    >
      {hasContentGround ? (
        <BrandIdentityHeader linkToHome surface="game" />
      ) : (
        <BrandIdentityHeader linkToHome size="regular" />
      )}
      <div
        className={`flex flex-1 flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${hasContentGround ? "" : "bg-muted/30"}`}
      >
        <main className={mainClassNames[contentLayout]}>{children}</main>
      </div>
      <BrowserBottomSurface
        surface={contentLayout === "full" || hasContentGround ? "game" : "page"}
      />
    </div>
  );
}
