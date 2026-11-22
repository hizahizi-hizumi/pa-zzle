import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import jarBumpSoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/jar-bump.flac";
import jarCoveredSoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/jar-covered.flac";
import jarLiftSoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/jar-lift.flac";
import morningShimmerSoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/morning-shimmer.flac";
import syrupGlop1SoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/syrup-glop-1.flac";
import syrupGlop2SoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/syrup-glop-2.flac";
import syrupGlop3SoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/syrup-glop-3.flac";
import syrupStreamSoundUrl from "@/games/water-sort/assets/sounds/ideas/kitchen/syrup-stream.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { KITCHEN_SUNRISE_DELAY_MS } from "@/games/water-sort/ui/ideas/kitchen/kitchen-finale-timing";
import { isFilledJar } from "@/games/water-sort/ui/ideas/kitchen/kitchen-jar-state";
import {
  KITCHEN_POUR_DURATION_MS,
  KITCHEN_POUR_TRANSFER_END,
  KITCHEN_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/kitchen/kitchen-pour-timing";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

const jarLiftSound = defineSoundEffect(jarLiftSoundUrl);
const jarBumpSound = defineSoundEffect(jarBumpSoundUrl);
const jarCoveredSound = defineSoundEffect(jarCoveredSoundUrl);
const morningShimmerSound = defineSoundEffect(morningShimmerSoundUrl);
const syrupStreamSound = defineSoundEffect(syrupStreamSoundUrl);
const syrupGlopSounds = [
  defineSoundEffect(syrupGlop1SoundUrl),
  defineSoundEffect(syrupGlop2SoundUrl),
  defineSoundEffect(syrupGlop3SoundUrl),
] as const;

const TRANSFER_DURATION_MS =
  KITCHEN_POUR_DURATION_MS *
  (KITCHEN_POUR_TRANSFER_END - KITCHEN_POUR_TRANSFER_START);

/** 太い筋が落ちる低い流れの上に、液がたまるたびの鈍い「とぷん」を、間を空けて重ねる。 */
const pouredSoundLayers: readonly SoundLayer[] = [
  { sound: syrupStreamSound, offsetMs: 0 },
  { sound: syrupGlopSounds[1], offsetMs: TRANSFER_DURATION_MS * 0.08 },
  { sound: syrupGlopSounds[0], offsetMs: TRANSFER_DURATION_MS * 0.36 },
  { sound: syrupGlopSounds[2], offsetMs: TRANSFER_DURATION_MS * 0.62 },
  { sound: syrupGlopSounds[1], offsetMs: TRANSFER_DURATION_MS * 0.9 },
];

const kitchenSounds: readonly SoundEffect[] = [
  jarLiftSound,
  jarBumpSound,
  jarCoveredSound,
  morningShimmerSound,
  syrupStreamSound,
  ...syrupGlopSounds,
];

/** 動きを減らす設定では注ぐ動きが無いので待たない。 */
function getPourDelayMs(offset: number): number {
  return prefersReducedMotion() ? 0 : KITCHEN_POUR_DURATION_MS * offset;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(jarLiftSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "source-deselected":
      playSound(jarLiftSound, {
        playbackRate: 0.82,
        volume: 0.7,
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(jarBumpSound);
      }
      return;
    case "poured": {
      playLayeredSound(pouredSoundLayers, {
        delayMs: getPourDelayMs(KITCHEN_POUR_TRANSFER_START),
        variation: REPEATED_SOUND_VARIATION,
      });
      const destination =
        operation.stateAfter[operation.destinationBottleIndex] ?? [];
      if (isFilledJar(destination)) {
        // 注ぎ終えて盤面の瓶に布をかぶせるときに、蓋と布と紐の音を鳴らす。
        playSound(jarCoveredSound, { delayMs: getPourDelayMs(1) });
      }
      return;
    }
  }
}

function playClearSound() {
  playSound(morningShimmerSound, {
    delayMs: KITCHEN_POUR_DURATION_MS + KITCHEN_SUNRISE_DELAY_MS,
  });
}

export function KitchenSoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(kitchenSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, {
    playReducedMotionClearSound() {
      playSound(morningShimmerSound);
    },
  });
  return null;
}
