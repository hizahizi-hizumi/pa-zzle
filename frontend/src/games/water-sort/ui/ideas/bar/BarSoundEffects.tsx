import {
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import {
  barSounds,
  playBarOperationSound,
} from "@/games/water-sort/ui/ideas/bar/bar-sounds";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";

/** 完成の音は、最後のグラスに氷が落ちる音と、店の灯りがともる演出（`BarClearFinale`）が鳴らす。 */
export function BarSoundEffects({ operation }: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(barSounds);
  useOperationSound(operation, playBarOperationSound);
  return null;
}
