import {
  CircleHelp,
  Grid2x2,
  Home,
  MoreHorizontal,
  Settings,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import {
  PLAY_MENU_TRIGGER_LABEL,
  type PlayMenuOperationItem,
  playMenuOperationItems,
} from "@/components/play-menu-operations";
import { SettingsDialog } from "@/components/SettingsDialog";
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
  onOpenGameHome: () => void;
  onBackToAppHome: () => void;
  onOpenHowToPlay?: () => void;
  onOpenDiagnostics?: () => void;
};

const { restart, replay, startNewProblem } = playMenuOperationItems;

function getItemVariant({
  destructive,
}: PlayMenuOperationItem): "default" | "destructive" {
  return destructive ? "destructive" : "default";
}

export function PlayMenu({
  onRestart,
  canRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
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
            aria-label={PLAY_MENU_TRIGGER_LABEL}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onRestart && (
            <DropdownMenuItem
              variant={getItemVariant(restart)}
              disabled={!canRestart}
              onSelect={onRestart}
            >
              <restart.icon />
              {restart.label}
            </DropdownMenuItem>
          )}
          {onReplay && (
            <DropdownMenuItem
              variant={getItemVariant(replay)}
              onSelect={onReplay}
            >
              <replay.icon />
              {replay.label}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant={getItemVariant(startNewProblem)}
            onSelect={withPlayStartSound(onStartNewProblem)}
          >
            <startNewProblem.icon />
            {startNewProblem.label}
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
