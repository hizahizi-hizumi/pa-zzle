import {
  CircleHelp,
  Home,
  MoreHorizontal,
  Play,
  Pointer,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlayMenuProps = {
  onRestart?: () => void;
  canRestart: boolean;
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay?: () => void;
  /** 省略するとメニューに「チュートリアル」を出さない。 */
  onOpenTutorial?: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayMenu({
  onRestart,
  canRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
}: PlayMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="その他の操作"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onRestart && (
          <DropdownMenuItem disabled={!canRestart} onSelect={onRestart}>
            <RotateCcw />
            盤面を戻す
          </DropdownMenuItem>
        )}
        {onReplay && (
          <DropdownMenuItem onSelect={onReplay}>
            <RefreshCw />
            リセット
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onStartNewProblem}>
          <Play />
          別の問題
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChangeDifficulty}>
          <SlidersHorizontal />
          難易度変更
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onBackToHome}>
          <Home />
          ホーム
        </DropdownMenuItem>
        {(onOpenHowToPlay || onOpenTutorial) && <DropdownMenuSeparator />}
        {onOpenHowToPlay && (
          <DropdownMenuItem onSelect={onOpenHowToPlay}>
            <CircleHelp />
            遊び方
          </DropdownMenuItem>
        )}
        {onOpenTutorial && (
          <DropdownMenuItem onSelect={onOpenTutorial}>
            <Pointer />
            チュートリアル
          </DropdownMenuItem>
        )}
        {onOpenDiagnostics && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenDiagnostics}>
              <Wrench />
              検証情報
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
