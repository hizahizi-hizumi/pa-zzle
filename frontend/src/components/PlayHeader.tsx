import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import {
  type PlayHeaderMetricGroup,
  PlayHeaderSummary,
} from "@/components/PlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/components/PlayHeader/PlayMenu";
import { Button } from "@/components/ui/button";

type PlayHeaderProps = {
  title: string;
  /** 1群なら常に1行に並べる。複数群なら、1行に収まらない幅で群ごとに行を分ける。 */
  metricGroups: readonly PlayHeaderMetricGroup[];
  /**
   * メニューの手前に置くゲーム固有の操作。
   * 渡すと、`null` で一時的に隠す間も見出しが動かないよう、両端の幅を広げて確保する。
   */
  trailingAction?: ReactNode;
  /** 省略するとメニューに「盤面を戻す」を出さない。 */
  onRestart?: () => void;
  canRestart?: boolean;
  /** 省略するとメニューに「リセット」を出さない。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay?: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayHeader({
  title,
  metricGroups,
  trailingAction,
  onRestart,
  canRestart = true,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenHowToPlay,
  onOpenDiagnostics,
}: PlayHeaderProps) {
  const hasTrailingAction = trailingAction !== undefined;
  const menu = (
    <PlayMenu
      onRestart={onRestart}
      canRestart={canRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );

  return (
    <header
      className={
        hasTrailingAction
          ? "grid h-[4.5rem] shrink-0 grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-start bg-background px-3 pt-2"
          : "grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2"
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary title={title} metricGroups={metricGroups} />
      {hasTrailingAction ? (
        <div className="flex justify-end gap-1">
          {trailingAction}
          {menu}
        </div>
      ) : (
        menu
      )}
    </header>
  );
}
