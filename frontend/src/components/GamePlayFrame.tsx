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
  | "onBackToHome"
  | "onOpenDiagnostics"
> &
  Partial<RestartableGamePlayScreenProps> & {
    /** ゲームの表示名。 */
    title: string;
    /** ゲーム固有の地。見出しから盤面まで、プレイ画面全体の背景として敷く。 */
    background?: ReactNode;
    metrics: readonly PlayHeaderMetric[];
    /** 見出しのメニューの手前に置くゲーム固有の操作。 */
    trailingAction?: ReactNode;
    /** 結果表示へ進み、評価があるときに盤面の代わりに描く結果画面。 */
    renderResultScreen: (result: Result) => ReactNode;
    /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は外枠が持ち、引数で渡す。 */
    renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
    /**
     * ゲーム固有のチュートリアルを描く。開閉の状態は外枠が持ち、引数で渡す。
     * 省略すると、メニューにチュートリアルを開く項目を出さない。
     */
    renderTutorial?: (control: HowToPlayDialogControl) => ReactNode;
    /** プレイ画面の範囲。盤面の外へ描かれるメニューやダイアログでの操作と見分けるために使う。 */
    ref?: Ref<HTMLElement>;
    /** 盤面（`main`）と、その下に置くゲーム固有の操作（`footer`）。 */
    children: ReactNode;
  };

/**
 * 全ゲームのプレイ画面の外枠。画面全体を覆い、ブランドの帯・見出し・遊び方・チュートリアルを描き、その下に盤面と操作を置く。
 * 結果表示へ進んで評価があれば、盤面の代わりに結果画面を描く。
 */
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
  onBackToHome,
  onOpenDiagnostics,
  renderResultScreen,
  renderHowToPlayDialog,
  renderTutorial,
  ref,
  children,
}: GamePlayFrameProps<Result>) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

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
      <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PlayHeader
          title={title}
          metrics={metrics}
          trailingAction={trailingAction}
          canRestart={canRestart}
          onRestart={onRestart}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onBackToHome={onBackToHome}
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
          onOpenTutorial={renderTutorial && (() => setTutorialOpen(true))}
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
        {children}
      </div>
      <BrowserBottomSurface surface="game" />
    </section>
  );
}
