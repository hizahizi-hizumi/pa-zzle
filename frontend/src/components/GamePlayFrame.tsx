import { type ReactNode, type Ref, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { BrowserBottomSurface } from "@/components/BrowserBottomSurface";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { PlayHeader } from "@/components/PlayHeader";
import type { PlayHeaderMetric } from "@/components/play-header-metric";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
} from "@/games/play";
import { cn } from "@/lib/utils";

type GamePlayFrameProps<Result> = Pick<
  GamePlayScreenProps<unknown, Result>,
  | "progress"
  | "result"
  | "onReplay"
  | "onStartNewProblem"
  | "onOpenGameHome"
  | "onBackToAppHome"
  | "onOpenHowToPlay"
  | "onOpenTutorial"
  | "onOpenDiagnostics"
  | "renderSettingsDialog"
> &
  Partial<RestartableGamePlayScreenProps> & {
    title: string;
    entryAnimation?: boolean;
    background?: ReactNode;
    metrics: readonly PlayHeaderMetric[];
    trailingAction?: ReactNode;
    renderResultScreen: (result: Result) => ReactNode;
    renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
    /**
     * ゲーム固有のチュートリアルを描く。開閉の状態は外枠が持ち、引数で渡す。
     * チュートリアルは遊び方の中からだけ開く。省略すると、遊び方にチュートリアルを始める操作を出さない。
     */
    renderTutorial?: (control: HowToPlayDialogControl) => ReactNode;
    /** プレイ画面の範囲。盤面の外へ描かれるメニューやダイアログでの操作と見分けるために使う。 */
    ref?: Ref<HTMLElement>;
    children: ReactNode;
  };

export function GamePlayFrame<Result>({
  progress,
  result,
  title,
  entryAnimation = true,
  background,
  metrics,
  trailingAction,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
  renderResultScreen,
  renderHowToPlayDialog,
  renderTutorial,
  renderSettingsDialog,
  ref,
  children,
}: GamePlayFrameProps<Result>) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (progress === "result" && result !== null) {
    return renderResultScreen(result);
  }

  return (
    <section
      ref={ref}
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-[var(--browser-surface,var(--background))]"
    >
      <div
        aria-hidden="true"
        data-browser-surface="child"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {background ?? <div className="size-full bg-background" />}
      </div>
      <BrandIdentityHeader surface="game" pinned />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
          entryAnimation &&
            "animate-in duration-(--duration-slow) ease-enter fade-in motion-reduce:animate-none",
        )}
      >
        <PlayHeader
          title={title}
          metrics={metrics}
          trailingAction={trailingAction}
          canRestart={canRestart}
          onRestart={onRestart}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onBackToAppHome={onBackToAppHome}
          onOpenHowToPlay={onOpenHowToPlay ?? (() => setHowToPlayOpen(true))}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDiagnostics={onOpenDiagnostics}
        />
        {renderHowToPlayDialog({
          open: howToPlayOpen,
          onClose: () => setHowToPlayOpen(false),
          onOpenTutorial:
            renderTutorial &&
            (() => {
              setHowToPlayOpen(false);
              if (onOpenTutorial) onOpenTutorial();
              else setTutorialOpen(true);
            }),
        })}
        {renderTutorial?.({
          open: tutorialOpen,
          onClose: () => setTutorialOpen(false),
        })}
        {renderSettingsDialog({
          open: settingsOpen,
          onClose: () => setSettingsOpen(false),
        })}
        {children}
      </div>
      <BrowserBottomSurface surface="game" />
    </section>
  );
}
