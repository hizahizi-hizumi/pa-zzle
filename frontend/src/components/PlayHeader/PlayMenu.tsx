import {
  CircleHelp,
  Grid2x2,
  Home,
  MoreHorizontal,
  Play,
  Pointer,
  RotateCcw,
  Settings,
  SkipBack,
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
  onOpenGameHome: () => void;
  onBackToAppHome: () => void;
  onOpenHowToPlay?: () => void;
  onOpenTutorial?: () => void;
  onOpenDiagnostics?: () => void;
};

export function PlayMenu({
  onRestart,
  canRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
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
            <DropdownMenuItem
              variant="destructive"
              disabled={!canRestart}
              onSelect={onRestart}
            >
              <SkipBack />
              {PLAY_OPERATION_LABELS.restart}
            </DropdownMenuItem>
          )}
          {onReplay && (
            <DropdownMenuItem variant="destructive" onSelect={onReplay}>
              <RotateCcw />
              {PLAY_OPERATION_LABELS.replay}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={withPlayStartSound(onStartNewProblem)}>
            <Play />
            {PLAY_OPERATION_LABELS.startNewProblem}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenGameHome}>
            <Grid2x2 />
            問題選択
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBackToAppHome}>
            <Home />
            パズル選択
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
