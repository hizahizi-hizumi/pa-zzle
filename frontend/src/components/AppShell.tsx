import type { ReactNode } from "react";

import { useAppBackgroundMusic } from "@/components/app-background-music";
import { usePrepareAppDecisionSounds } from "@/components/app-decision-sound";
import { BgmAuditionSwitcher } from "@/components/BgmAuditionSwitcher";
import { useBgmAuditionCandidate } from "@/components/BgmAuditionSwitcher/bgm-audition-candidates";
import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";

type AppShellProps = {
  children: ReactNode;
  /**
   * - `contained`: 読みやすい幅と余白に収める。
   * - `full`: 横幅いっぱいに使い、余白は内容に任せる。
   * - `fill`: ヘッダー下の残りの領域を縦横とも埋める。内容は `flex-1` で伸ばせる。
   */
  contentLayout?: "contained" | "full" | "fill";
};

const mainClassNames = {
  contained: "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12",
  full: "w-full",
  fill: "flex w-full flex-1 flex-col",
} satisfies Record<NonNullable<AppShellProps["contentLayout"]>, string>;

export function AppShell({
  children,
  contentLayout = "contained",
}: AppShellProps) {
  usePrepareAppDecisionSounds();
  const [bgmAuditionCandidate, selectBgmAuditionCandidate] =
    useBgmAuditionCandidate();
  const backgroundMusicScene = useAppBackgroundMusic(
    bgmAuditionCandidate.tracks,
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 font-ui">
      <BrandIdentityHeader linkToHome size="regular" />
      <main className={mainClassNames[contentLayout]}>{children}</main>
      <BgmAuditionSwitcher
        candidate={bgmAuditionCandidate}
        onSelect={selectBgmAuditionCandidate}
        // プレイ画面と結果画面は、低いブランドの帯を持つ画面でページ全体を覆う。
        band={backgroundMusicScene === "home" ? "regular" : "compact"}
      />
    </div>
  );
}
