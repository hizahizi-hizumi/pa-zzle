import {
  CircleHelp,
  Home,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type PlayMenuProps = {
  onRestart?: () => void;
  canRestart: boolean;
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay?: () => void;
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
  onOpenDiagnostics,
}: PlayMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
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
              {PLAY_OPERATION_LABELS.restart}
            </DropdownMenuItem>
          )}
          {onReplay && (
            <DropdownMenuItem onSelect={onReplay}>
              <RefreshCw />
              {PLAY_OPERATION_LABELS.replay}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={withPlayStartSound(onStartNewProblem)}>
            <Play />
            {PLAY_OPERATION_LABELS.startNewProblem}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onChangeDifficulty}>
            <SlidersHorizontal />
            難易度変更
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBackToHome}>
            <Home />
            ホーム
          </DropdownMenuItem>
          {onOpenHowToPlay && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpenHowToPlay}>
                <CircleHelp />
                遊び方
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings />
            設定
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
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
