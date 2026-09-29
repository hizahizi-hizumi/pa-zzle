import {
  CircleHelp,
  Home,
  MoreHorizontal,
  Play,
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
  canRestart: boolean;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayMenu({
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenHowToPlay,
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
        <DropdownMenuItem disabled={!canRestart} onSelect={onRestart}>
          <RotateCcw />
          盤面を戻す
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReplay}>
          <RefreshCw />
          リセット
        </DropdownMenuItem>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenHowToPlay}>
          <CircleHelp />
          遊び方
        </DropdownMenuItem>
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
