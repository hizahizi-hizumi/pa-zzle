import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/use-water-sort-sound-effects";

export function CurrentSoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  useWaterSortSoundEffects(operation, progress);
  return null;
}
