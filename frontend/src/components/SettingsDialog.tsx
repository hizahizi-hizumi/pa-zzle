import { createLucideIcon, Music, Volume2, VolumeX, X } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";

import { playSoundEffectsVolumePreview } from "@/components/app-decision-sound";
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
};

/**
 * 全ゲームで共通の設定を選ぶダイアログ。効果音と BGM の音量を選ぶ。
 * 選んだ音量はその場で鳴っている音に効き、端末に保存して次に開いたときも引き継ぐ。
 * 設定の操作には音を鳴らさない。ただし効果音の音量は、選び終えたときに選んだ音量で確かめの音を鳴らす。
 */
export function SettingsDialog({
  open,
  onOpenChange,
  trigger,
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
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="text-left">
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
          <DialogDescription>音量は全てのゲームで共通です。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
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
      </DialogContent>
    </Dialog>
  );
}
