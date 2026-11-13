import blockedSoundUrl from "@/games/parking-jam/assets/sounds/blocked.flac";
import clearedSoundUrl from "@/games/parking-jam/assets/sounds/cleared.flac";
import exitedSoundUrl from "@/games/parking-jam/assets/sounds/exited.flac";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  PARKING_JAM_COLLISION_IMPACT_MS,
  PARKING_JAM_FINALE_DELAY_MS,
} from "@/games/parking-jam/ui/board/parking-jam-board-motion";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

const blockedSound = defineSoundEffect(blockedSoundUrl);

const exitedSound = defineSoundEffect(exitedSoundUrl);

const clearedSound = defineSoundEffect(clearedSoundUrl);

/** 最後の車が駐車場を抜けかけ、空いた駐車場の線が光り始めるところでクラクションを鳴らす。 */
const CLEAR_SOUND_DELAY_MS = PARKING_JAM_FINALE_DELAY_MS;

const parkingJamSounds: readonly SoundEffect[] = [
  blockedSound,
  exitedSound,
  clearedSound,
];

/** 動きを減らす設定では車がすぐ止まり・すぐ出ていくので待たない。 */
function getMotionDelayMs(delayMs: number): number {
  return prefersReducedMotion() ? 0 : delayMs;
}

function playOperationSound(operation: ParkingJamOperation) {
  switch (operation.type) {
    case "blocked":
      playSound(blockedSound, {
        delayMs: getMotionDelayMs(PARKING_JAM_COLLISION_IMPACT_MS),
      });
      return;
    case "exited":
      playSound(exitedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

function playClearSound() {
  playSound(clearedSound, {
    delayMs: getMotionDelayMs(CLEAR_SOUND_DELAY_MS),
  });
}

export function useParkingJamSoundEffects(
  operation: ParkingJamOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(parkingJamSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
