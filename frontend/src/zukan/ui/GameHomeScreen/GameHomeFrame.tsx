import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { BrowserBottomSurface } from "@/components/BrowserBottomSurface";

type GameHomeFrameProps = {
  /** ゲーム固有の地。ブランドの帯から下端まで、画面全体の背景として敷く。 */
  ground: ReactNode;
  children: ReactNode;
};

/**
 * ゲームのホームの外枠。画面全体を覆ってゲーム固有の地を敷き、ブランドの帯と下端もその地につなげる。
 * 地をプレイ画面と同じにして、ゲームを選んだときからそのゲームの場にいるようにし、プレイへ地続きで入れるようにする。
 * 画面の高さに収め、中身は自分の中でスクロールさせる。
 */
export function GameHomeFrame({ ground, children }: GameHomeFrameProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex flex-col overflow-hidden bg-[var(--browser-surface,var(--background))]">
      <div
        aria-hidden="true"
        data-browser-surface="child"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {ground}
      </div>
      <BrandIdentityHeader linkToHome surface="game" pinned />
      <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {children}
      </div>
      <BrowserBottomSurface surface="game" />
    </section>
  );
}
