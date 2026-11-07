import {
  ArrowLeft,
  createLucideIcon,
  Music,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";

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
  initialPanel?: "main" | "random";
  initialGameId?: string;
};

/**
 * 全ゲーム共通の設定を選ぶダイアログ。効果音・BGM の音量とランダム出題対象を選ぶ。
 * 選んだ音量はその場で鳴っている音に効き、端末に保存して次に開いたときも引き継ぐ。
 * 設定の操作には音を鳴らさない。ただし効果音の音量は、選び終えたときに選んだ音量で確かめの音を鳴らす。
 */
export function SettingsDialog({
  open,
  onOpenChange,
  trigger,
  initialPanel = "main",
  initialGameId,
}: SettingsDialogProps) {
  const [panel, setPanel] = useState(initialPanel);
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPanel(initialPanel);
        onOpenChange(nextOpen);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90dvh,44rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {panel === "random" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="設定に戻る"
                  onClick={() => setPanel("main")}
                >
                  <ArrowLeft />
                </Button>
              )}
              <DialogTitle>
                {panel === "main" ? "設定" : "ランダム出題"}
              </DialogTitle>
            </div>
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
          <DialogDescription
            className={panel === "random" ? "sr-only" : undefined}
          >
            {panel === "main"
              ? "音量と出題対象を設定します。"
              : "出題対象をゲーム共通または個別に設定します。"}
          </DialogDescription>
        </DialogHeader>

        {panel === "main" ? (
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
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => setPanel("random")}
            >
              <Shuffle />
              ランダム出題の設定
            </Button>
          </div>
        ) : (
          <RandomProblemSettingsPanel initialGameId={initialGameId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
