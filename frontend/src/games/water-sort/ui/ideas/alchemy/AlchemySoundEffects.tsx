import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import illuminatedSoundUrl from "@/games/water-sort/assets/sounds/ideas/alchemy/illuminated.flac";
import liftedSoundUrl from "@/games/water-sort/assets/sounds/ideas/alchemy/lifted.flac";
import pouredSoundUrl from "@/games/water-sort/assets/sounds/ideas/alchemy/poured.flac";
import refusedSoundUrl from "@/games/water-sort/assets/sounds/ideas/alchemy/refused.flac";
import sealedSoundUrl from "@/games/water-sort/assets/sounds/ideas/alchemy/sealed.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { FINALE_TIMELINE } from "@/games/water-sort/ui/ideas/alchemy/finale-timeline";
import { isSealedBottle } from "@/games/water-sort/ui/ideas/alchemy/sealed-bottle";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

const liftedSound = defineSoundEffect(liftedSoundUrl);
const pouredSound = defineSoundEffect(pouredSoundUrl);
const refusedSound = defineSoundEffect(refusedSoundUrl);
const sealedSound = defineSoundEffect(sealedSoundUrl);
const illuminatedSound = defineSoundEffect(illuminatedSoundUrl);

const alchemySounds: readonly SoundEffect[] = [
  liftedSound,
  pouredSound,
  refusedSound,
  sealedSound,
  illuminatedSound,
];

/** 動きを減らす設定では注ぐ動きが無く、すぐ盤面が変わるので待たない。 */
function afterPourMs(delayMs: number): number {
  return prefersReducedMotion() ? 0 : delayMs;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(liftedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "source-deselected":
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(refusedSound);
      }
      return;
    case "poured": {
      playSound(pouredSound, {
        delayMs: afterPourMs(
          POUR_ANIMATION_DURATION_MS * POUR_TRANSFER_START_OFFSET,
        ),
        variation: REPEATED_SOUND_VARIATION,
      });
      const destination =
        operation.stateAfter[operation.destinationBottleIndex] ?? [];
      if (isSealedBottle(destination)) {
        // 注ぎ終えたフラスコが姿を現し、灯って封をし始めるのに合わせる。
        playSound(sealedSound, {
          delayMs: afterPourMs(POUR_ANIMATION_DURATION_MS),
        });
      }
      return;
    }
  }
}

/** 仕上げで、フラスコが順に灯り始めるのに合わせる。 */
function playIlluminatedSound() {
  playSound(illuminatedSound, {
    delayMs: POUR_ANIMATION_DURATION_MS + FINALE_TIMELINE.flareStartMs,
  });
}

export function AlchemySoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(alchemySounds);
  useOperationSound(operation, playOperationSound);
  // 動きを減らす設定でも、灯った工房を少しの間見せてから結果へ移るので、その姿に合わせて鳴らす。
  useClearSound(progress, playIlluminatedSound, {
    playReducedMotionClearSound() {
      playSound(illuminatedSound);
    },
  });
  return null;
}
