import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  isSoundEffectsEnabled,
  setSoundEffectsEnabled,
  subscribeSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

/**
 * 効果音を鳴らすかどうかを切り替える小さなアイコンのボタン。押している状態が鳴らす設定を表す。
 * 設定を切り替える操作なので、切り替えても音は鳴らさない。
 */
export function SoundEffectsToggle() {
  const enabled = useSyncExternalStore(
    subscribeSoundEffectsEnabled,
    isSoundEffectsEnabled,
  );
  const Icon = enabled ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      aria-label="効果音"
      aria-pressed={enabled}
      title={enabled ? "効果音: オン" : "効果音: オフ"}
      onClick={() => setSoundEffectsEnabled(!enabled)}
      className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  );
}
