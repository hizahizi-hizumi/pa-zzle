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
import { useSyncExternalStore } from "react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import {
  isBackgroundMusicEnabled,
  setBackgroundMusicEnabled,
  subscribeBackgroundMusicEnabled,
} from "@/lib/background-music-setting";
import {
  isSoundEffectsEnabled,
  setSoundEffectsEnabled,
  subscribeSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

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
  const soundEffectsEnabled = useSyncExternalStore(
    subscribeSoundEffectsEnabled,
    isSoundEffectsEnabled,
  );
  const backgroundMusicEnabled = useSyncExternalStore(
    subscribeBackgroundMusicEnabled,
    isBackgroundMusicEnabled,
  );

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
        <DropdownMenuCheckboxItem
          checked={soundEffectsEnabled}
          onCheckedChange={setSoundEffectsEnabled}
          onSelect={keepMenuOpen}
        >
          効果音
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={backgroundMusicEnabled}
          onCheckedChange={setBackgroundMusicEnabled}
          onSelect={keepMenuOpen}
        >
          BGM
        </DropdownMenuCheckboxItem>
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

/** 切り替えた結果をその場で確かめられるよう、メニューを開いたままにする。 */
function keepMenuOpen(event: Event) {
  event.preventDefault();
}
