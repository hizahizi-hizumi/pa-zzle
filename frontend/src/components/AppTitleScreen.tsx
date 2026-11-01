import { Dialog as DialogPrimitive } from "radix-ui";
import { type MouseEvent, useRef } from "react";
import { Link } from "react-router";

import { playGameSelectSound } from "@/components/app-decision-sound";
import { BrandMark } from "@/components/BrandMark";
import { GamePictogram } from "@/components/GamePictogram";
import { SoundEffectsToggle } from "@/components/SoundEffectsToggle";
import { Dialog, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { AppLaunchTitle } from "@/lib/app-launch";
import type { Path } from "@/router";

type AppTitleScreenGame = {
  name: string;
  pictogramSvg: string;
  to: Path;
};

type AppTitleScreenProps = {
  title: AppLaunchTitle;
  games: readonly AppTitleScreenGame[];
  /** 利用者がタイトルから入った。ゲームのピクトグラムで入ったときは、続けてそのゲームのホームへ移る。 */
  onEnter: () => void;
};

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * アプリを開いたときにホームの上へ重ねる、全面のタイトル。効果音を読み込む間は進みを見せ、読み込み終えたら入れる。
 * どこを押しても入り、ゲームのピクトグラムを押すとそのゲームのホームへ直接入る。
 */
export function AppTitleScreen({ title, games, onEnter }: AppTitleScreenProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const ready = title.status === "ready";

  function enter(event: MouseEvent) {
    event.stopPropagation();
    if (ready) {
      onEnter();
    }
  }

  function enterGame(event: MouseEvent) {
    event.stopPropagation();
    playGameSelectSound();
    onEnter();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && ready) {
      onEnter();
    }
  }

  // 開いた直後に最初の操作部品へ枠を出さないよう、面そのものを選んでおく。Tab で面の中の操作へ進める。
  function focusSurface(event: Event) {
    event.preventDefault();
    surfaceRef.current?.focus();
  }

  return (
    <Dialog open={title.status !== "hidden"} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          ref={surfaceRef}
          aria-describedby={undefined}
          onOpenAutoFocus={focusSurface}
          onClick={enter}
          className="fixed inset-0 z-(--layer-overlay) flex flex-col bg-background font-ui outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--duration-normal) data-[state=closed]:ease-exit motion-reduce:animate-none"
        >
          {/* 効果音の切り替えで入らないよう、押した操作を面へ伝えない。 */}
          <div
            onClick={stopPropagation}
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 sm:right-6"
          >
            <SoundEffectsToggle />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:gap-12">
            <DialogTitle className="flex justify-center">
              <BrandMark size="title" />
            </DialogTitle>

            <ul className="flex max-w-68 flex-wrap justify-center gap-3 sm:max-w-none sm:flex-nowrap sm:gap-4">
              {games.map((game) => (
                <li key={game.to} className="size-14 sm:size-20">
                  {/* 読み込み中も同じ要素のまま押せなくし、入れるようになったときにピクトグラムを描き直さない。 */}
                  <Link
                    to={game.to}
                    aria-label={`${game.name}を遊ぶ`}
                    inert={!ready}
                    onClick={enterGame}
                    className="flex size-full items-center justify-center rounded-lg border-(length:--border-width-normal) border-border bg-background p-[18%] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <GamePictogram svg={game.pictogramSvg} />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex h-10 w-40 items-center justify-center">
              {title.status === "loading" ? (
                <Progress
                  value={Math.round(title.progress * 100)}
                  aria-label="効果音の読み込み"
                  className="h-1 bg-muted motion-reduce:*:transition-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={enter}
                  className="flex h-full w-full items-center justify-center rounded-md text-supporting font-medium text-muted-foreground animate-in fade-in duration-(--duration-slow) ease-enter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:animate-none"
                >
                  タップしてはじめる
                </button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
