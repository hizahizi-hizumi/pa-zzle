import { type ReactNode, type Ref, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
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
  | "onChangeDifficulty"
  | "onBackToHome"
  | "onOpenDiagnostics"
> &
  Partial<RestartableGamePlayScreenProps> & {
    /** ゲームの表示名。 */
    title: string;
    metrics: readonly PlayHeaderMetric[];
    /** 見出しのメニューの手前に置くゲーム固有の操作。 */
    trailingAction?: ReactNode;
    /** 結果表示へ進み、評価があるときに盤面の代わりに描く結果画面。 */
    renderResultScreen: (result: Result) => ReactNode;
    /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は外枠が持ち、引数で渡す。 */
    renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
    /** プレイ画面の範囲。盤面の外へ描かれるメニューやダイアログでの操作と見分けるために使う。 */
    ref?: Ref<HTMLElement>;
    /** 盤面（`main`）と、その下に置くゲーム固有の操作（`footer`）。 */
    children: ReactNode;
  };

/**
 * 全ゲームのプレイ画面の外枠。画面全体を覆い、ブランドの帯・見出し・遊び方を描き、その下に盤面と操作を置く。
 * 結果表示へ進んで評価があれば、盤面の代わりに結果画面を描く。
 */
export function GamePlayFrame<Result>({
  progress,
  result,
  title,
  metrics,
  trailingAction,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
  renderResultScreen,
  renderHowToPlayDialog,
  ref,
  children,
}: GamePlayFrameProps<Result>) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  if (progress === "result" && result !== null) {
    return renderResultScreen(result);
  }

  return (
    <section
      ref={ref}
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <BrandIdentityHeader />
      <PlayHeader
        title={title}
        metrics={metrics}
        trailingAction={trailingAction}
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      {renderHowToPlayDialog({
        open: howToPlayOpen,
        onClose: () => setHowToPlayOpen(false),
      })}
      {children}
    </section>
  );
}
