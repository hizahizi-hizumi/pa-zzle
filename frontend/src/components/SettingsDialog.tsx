import { createLucideIcon, Music, Volume2, VolumeX, X } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";

import { playSoundEffectsVolumePreview } from "@/components/app-decision-sound";
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
import { soundEffectsVolumeSetting } from "@/lib/sound-effects-setting";

/** 音符に斜線を引いた、BGM を流さない設定の印。lucide に無いので、音符のアイコンに斜線を足して作る。 */
const MusicOff = createLucideIcon("music-off", [
  ["path", { d: "M9 18V5l12-2v13", key: "music-stem" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "music-left-head" }],
  ["circle", { cx: "18", cy: "16", r: "3", key: "music-right-head" }],
  ["path", { d: "m2 2 20 20", key: "off-slash" }],
]);

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 開くボタン。渡すと、閉じたときにこのボタンへ操作の位置を戻す。 */
  trigger?: ReactNode;
  initialGameId?: string;
};

/** 効果音・BGMの音量とランダム出題条件をまとめて変更する。 */
export function SettingsDialog({
  open,
  onOpenChange,
  trigger,
  initialGameId,
}: SettingsDialogProps) {
  const soundEffectsVolume = useSyncExternalStore(
    soundEffectsVolumeSetting.subscribe,
    soundEffectsVolumeSetting.getVolume,
  );
  const backgroundMusicVolume = useSyncExternalStore(
    backgroundMusicVolumeSetting.subscribe,
    backgroundMusicVolumeSetting.getVolume,
  );

  function commitSoundEffectsVolume(volume: number) {
    soundEffectsVolumeSetting.commitVolume(volume);
    playSoundEffectsVolumePreview();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,48rem)] flex-col overflow-hidden sm:max-w-md"
      >
        <DialogHeader className="shrink-0 text-left">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>設定</DialogTitle>
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
            音量とランダム出題の対象を選びます。
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
            <section
              aria-labelledby="sound-settings-title"
              className="grid gap-2"
            >
              <h3
                id="sound-settings-title"
                className="text-supporting font-medium"
              >
                サウンド
              </h3>
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
            </section>
            <section
              aria-labelledby="random-settings-title"
              className="grid gap-3 border-t border-border pt-4"
            >
              <h3
                id="random-settings-title"
                className="text-supporting font-medium"
              >
                ランダム出題
              </h3>
              <RandomProblemSettingsPanel initialGameId={initialGameId} />
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
