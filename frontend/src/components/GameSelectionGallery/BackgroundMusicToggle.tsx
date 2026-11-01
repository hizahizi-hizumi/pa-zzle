import { createLucideIcon, Music } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  isBackgroundMusicEnabled,
  setBackgroundMusicEnabled,
  subscribeBackgroundMusicEnabled,
} from "@/lib/background-music-setting";

/** 音符に斜線を引いた、BGM を流さない設定の印。lucide に無いので、音符のアイコンに斜線を足して作る。 */
const MusicOff = createLucideIcon("music-off", [
  ["path", { d: "M9 18V5l12-2v13", key: "music-stem" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "music-left-head" }],
  ["circle", { cx: "18", cy: "16", r: "3", key: "music-right-head" }],
  ["path", { d: "m2 2 20 20", key: "off-slash" }],
]);

/**
 * BGM を流すかどうかを切り替える小さなアイコンのボタン。押している状態が流す設定を表す。
 * 設定を切り替える操作なので、切り替えても効果音は鳴らさない。
 */
export function BackgroundMusicToggle() {
  const enabled = useSyncExternalStore(
    subscribeBackgroundMusicEnabled,
    isBackgroundMusicEnabled,
  );
  const Icon = enabled ? Music : MusicOff;

  return (
    <button
      type="button"
      aria-label="BGM"
      aria-pressed={enabled}
      title={enabled ? "BGM: オン" : "BGM: オフ"}
      onClick={() => setBackgroundMusicEnabled(!enabled)}
      className="flex h-9 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-9"
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  );
}
