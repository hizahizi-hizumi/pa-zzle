import {
  ArrowLeft,
  ChevronRight,
  createLucideIcon,
  Music,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";

import { playSoundEffectsVolumePreview } from "@/components/app-decision-sound";
import { useGameCatalog } from "@/components/GameCatalogContext";
import { GameSelectionOrderPanel } from "@/components/SettingsDialog/GameSelectionOrderPanel";
import { RandomProblemSettingsPanel } from "@/components/SettingsDialog/RandomProblemSettingsPanel";
import { VolumeSettingRow } from "@/components/SettingsDialog/VolumeSettingRow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { backgroundMusicVolumeSetting } from "@/lib/background-music-setting";
import { gameSelectionOrderSetting } from "@/lib/game-selection-order-setting";
import {
  randomProblemSettings,
  randomProblemStatuses,
} from "@/lib/random-problem-settings";
import { soundEffectsVolumeSetting } from "@/lib/sound-effects-setting";

const MusicOff = createLucideIcon("music-off", [
  ["path", { d: "M9 18V5l12-2v13", key: "music-stem" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "music-left-head" }],
  ["circle", { cx: "18", cy: "16", r: "3", key: "music-right-head" }],
  ["path", { d: "m2 2 20 20", key: "off-slash" }],
]);

type SettingsPanel = "settings" | "order" | "random" | "sound";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  initialGameId?: string;
};

const panelTitles: Record<SettingsPanel, string> = {
  settings: "設定",
  order: "パズルの並び順",
  random: "ランダム出題",
  sound: "サウンド",
};

export function SettingsDialog({
  open,
  onOpenChange,
  trigger,
  initialGameId,
}: SettingsDialogProps) {
  const [panel, setPanel] = useState<SettingsPanel>("settings");
  const gameCatalog = useGameCatalog();
  const soundEffectsVolume = useSyncExternalStore(
    soundEffectsVolumeSetting.subscribe,
    soundEffectsVolumeSetting.getVolume,
  );
  const backgroundMusicVolume = useSyncExternalStore(
    backgroundMusicVolumeSetting.subscribe,
    backgroundMusicVolumeSetting.getVolume,
  );
  const preferredOrder = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getSnapshot,
    gameSelectionOrderSetting.getSnapshot,
  );
  const randomSettings = useSyncExternalStore(
    randomProblemSettings.subscribe,
    randomProblemSettings.getSnapshot,
    randomProblemSettings.getSnapshot,
  );
  const defaultGameIds = gameCatalog.map(({ id }) => id);
  const currentOrder = gameSelectionOrderSetting.sortGameIds(
    defaultGameIds,
    preferredOrder,
  );
  const isDefaultOrder = currentOrder.every(
    (id, index) => id === defaultGameIds[index],
  );
  const overriddenGames = gameCatalog.filter(({ id }) =>
    Object.hasOwn(randomSettings.overrides, id),
  ).length;
  const settingEntries = [
    {
      id: "order",
      summary: isDefaultOrder ? "初期順" : "並び替え済み",
    },
    {
      id: "random",
      summary: `出題対象 ${randomSettings.global.length}/${randomProblemStatuses.length}${overriddenGames > 0 ? ` · 個別設定 ${overriddenGames}件` : ""}`,
    },
    {
      id: "sound",
      summary: `効果音 ${soundEffectsVolume === 0 ? "オフ" : soundEffectsVolume} · BGM ${backgroundMusicVolume === 0 ? "オフ" : backgroundMusicVolume}`,
    },
  ] as const;

  function commitSoundEffectsVolume(volume: number) {
    soundEffectsVolumeSetting.commitVolume(volume);
    playSoundEffectsVolumePreview();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setPanel("settings");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,48rem)] flex-col overflow-hidden sm:max-w-md"
      >
        <DialogHeader className="shrink-0 text-left">
          <div className="flex items-center justify-between gap-4">
            {panel !== "settings" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="設定に戻る"
                onClick={() => setPanel("settings")}
              >
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle className="mr-auto">{panelTitles[panel]}</DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="閉じる"
              >
                <X />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            パズルの並び順、ランダム出題、サウンドを設定します。
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          {panel === "settings" && (
            <nav aria-label="設定項目" className="divide-y divide-border">
              {settingEntries.map(({ id, summary }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id)}
                  className="flex min-h-18 w-full items-center gap-3 rounded-sm px-2 py-3 text-left transition-colors hover:bg-accent/50 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="text-body font-medium">
                      {panelTitles[id]}
                    </span>
                    <span className="text-supporting text-muted-foreground">
                      {summary}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </nav>
          )}
          {panel === "order" && <GameSelectionOrderPanel />}
          {panel === "random" && (
            <RandomProblemSettingsPanel initialGameId={initialGameId} />
          )}
          {panel === "sound" && (
            <div className="grid gap-4 py-1">
              <VolumeSettingRow
                label="効果音"
                volume={soundEffectsVolume}
                icon={Volume2}
                mutedIcon={VolumeX}
                onChange={soundEffectsVolumeSetting.setVolume}
                onCommit={commitSoundEffectsVolume}
                onToggleMuted={soundEffectsVolumeSetting.toggleMuted}
              />
              <VolumeSettingRow
                label="BGM"
                volume={backgroundMusicVolume}
                icon={Music}
                mutedIcon={MusicOff}
                onChange={backgroundMusicVolumeSetting.setVolume}
                onCommit={backgroundMusicVolumeSetting.commitVolume}
                onToggleMuted={backgroundMusicVolumeSetting.toggleMuted}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
