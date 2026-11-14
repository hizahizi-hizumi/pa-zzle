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

type GamePlayFrameProps<Result> = Pick<
  GamePlayScreenProps<unknown, Result>,
  | "progress"
  | "result"
  | "onReplay"
  | "onStartNewProblem"
  | "onOpenGameHome"
  | "onBackToAppHome"
  | "onOpenDiagnostics"
  | "renderSettingsDialog"
> &
  Partial<RestartableGamePlayScreenProps> & {
    title: string;
    background?: ReactNode;
    metrics: readonly PlayHeaderMetric[];
    trailingAction?: ReactNode;
    renderResultScreen: (result: Result) => ReactNode;
    renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
    renderTutorial?: (control: HowToPlayDialogControl) => ReactNode;
    /** プレイ画面の範囲。盤面の外へ描かれるメニューやダイアログでの操作と見分けるために使う。 */
    ref?: Ref<HTMLElement>;
    children: ReactNode;
  };

export function GamePlayFrame<Result>({
  progress,
  result,
  title,
  background,
  metrics,
  trailingAction,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
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
      {/* ゲームのホームと同じ地の上に、見出しと盤面を短く浮かび上がらせて入る。地は動かさない。 */}
      <div className="flex min-h-0 flex-1 animate-in flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] duration-(--duration-slow) ease-enter fade-in motion-reduce:animate-none">
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
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
          onOpenTutorial={renderTutorial && (() => setTutorialOpen(true))}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDiagnostics={onOpenDiagnostics}
        />
        {renderHowToPlayDialog({
          open: howToPlayOpen,
          onClose: () => setHowToPlayOpen(false),
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
