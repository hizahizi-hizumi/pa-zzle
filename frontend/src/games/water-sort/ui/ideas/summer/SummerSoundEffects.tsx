import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import chime1SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/chime-1.flac";
import chime2SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/chime-2.flac";
import glug1SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/glug-1.flac";
import glug2SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/glug-2.flac";
import glug3SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/glug-3.flac";
import glug4SoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/glug-4.flac";
import knockSoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/knock.flac";
import liftSoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/lift.flac";
import splashSoundUrl from "@/games/water-sort/assets/sounds/ideas/summer/splash.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import {
  HOLD_TO_SUN_DURATION_MS,
  SUMMER_POUR_DURATION_MS,
  SUMMER_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/summer/summer-motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

const liftSound = defineSoundEffect(liftSoundUrl);
const knockSound = defineSoundEffect(knockSoundUrl);
const splashSound = defineSoundEffect(splashSoundUrl);
const completedSound = defineSoundEffect(chime1SoundUrl);
const clearedSound = defineSoundEffect(chime2SoundUrl);

/**
 * 注ぐ音。ぽちゃっと落ちた後、注ぐ動きの揺すりと流れの太り細りに合わせて、とぽとぽと鳴らす。
 * `at` は注ぐ動き全体の中での鳴り始め（長さに対する割合）。
 */
const pouredLayers: readonly SoundLayer[] = [
  { sound: splashSound, at: SUMMER_POUR_TRANSFER_START },
  { sound: defineSoundEffect(glug1SoundUrl), at: 0.33 },
  { sound: defineSoundEffect(glug3SoundUrl), at: 0.42 },
  { sound: defineSoundEffect(glug2SoundUrl), at: 0.5 },
  { sound: defineSoundEffect(glug4SoundUrl), at: 0.57 },
  { sound: defineSoundEffect(glug1SoundUrl), at: 0.645 },
].map(function createPouredLayer({ sound, at }): SoundLayer {
  return {
    sound,
    offsetMs: SUMMER_POUR_DURATION_MS * (at - SUMMER_POUR_TRANSFER_START),
  };
});

const summerSounds: readonly SoundEffect[] = [
  liftSound,
  knockSound,
  ...pouredLayers.map(({ sound }) => sound),
  completedSound,
  clearedSound,
];

/** 1本そろった瓶を陽にかざし、いちばん高く上がった所。 */
const HOLD_TO_SUN_PEAK_MS = HOLD_TO_SUN_DURATION_MS * 0.3;

function isCompletedBottle(bottle: readonly number[] | undefined): boolean {
  return (
    bottle?.length === 4 &&
    bottle.every((colorIndex) => colorIndex === bottle[0])
  );
}

function playOperationSound(operation: WaterSortOperation) {
  const reduced = prefersReducedMotion();
  switch (operation.type) {
    case "source-selected":
      playSound(liftSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      if (!reduced) {
        playSound(knockSound, { variation: REPEATED_SOUND_VARIATION });
      }
      return;
    case "poured": {
      playLayeredSound(pouredLayers, {
        delayMs: reduced
          ? 0
          : SUMMER_POUR_DURATION_MS * SUMMER_POUR_TRANSFER_START,
        variation: REPEATED_SOUND_VARIATION,
      });
      const completed = isCompletedBottle(
        operation.stateAfter[operation.destinationBottleIndex],
      );
      if (completed && !operation.isClearingMove) {
        playSound(completedSound, {
          delayMs: reduced ? 0 : SUMMER_POUR_DURATION_MS + HOLD_TO_SUN_PEAK_MS,
          volume: 0.8,
        });
      }
      return;
    }
    case "source-deselected":
      return;
  }
}

function playClearSound() {
  playSound(clearedSound, { delayMs: SUMMER_POUR_DURATION_MS });
}

function playReducedMotionClearSound() {
  playSound(clearedSound);
}

export function SummerSoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(summerSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
  return null;
}
