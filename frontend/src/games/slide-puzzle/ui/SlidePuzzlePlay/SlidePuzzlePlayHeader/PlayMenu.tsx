import {
  Home,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlayMenuProps = {
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function PlayMenu({
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
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
        <DropdownMenuItem onSelect={onRestart}>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
