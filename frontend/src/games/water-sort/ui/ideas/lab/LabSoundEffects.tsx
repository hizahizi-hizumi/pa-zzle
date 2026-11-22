import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { LAB_FINALE_CHIME_DELAY_MS } from "@/games/water-sort/ui/ideas/lab/lab-finale-timing";
import {
  getLabPourDelayMs,
  LAB_POUR_TOUCH_OFFSET,
  LAB_STOPPER_SEATED_OFFSET,
} from "@/games/water-sort/ui/ideas/lab/lab-pour-timing";
import {
  glassTinkSounds,
  labSounds,
  pourTrickleSound,
  rackChimeSound,
  stopperSqueakSound,
  tubeLiftSound,
  tubeRattleSound,
} from "@/games/water-sort/ui/ideas/lab/lab-sounds";
import { isSealedTube } from "@/games/water-sort/ui/ideas/lab/lab-tube-state";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import { playSound, REPEATED_SOUND_VARIATION } from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

/** 動きを減らす設定では注ぐ動きが無いので、触れる・流れる・栓をするを間を詰めて続けて鳴らす。 */
function getDelayMs(offset: number, reducedDelayMs: number): number {
  return prefersReducedMotion() ? reducedDelayMs : getLabPourDelayMs(offset);
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(tubeLiftSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "source-deselected":
      playSound(tubeLiftSound, {
        variation: REPEATED_SOUND_VARIATION,
        playbackRate: 0.85,
        volume: 0.7,
      });
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(tubeRattleSound, { variation: REPEATED_SOUND_VARIATION });
      }
      return;
    case "poured": {
      const tink = glassTinkSounds[operation.id % glassTinkSounds.length];
      if (tink) {
        playSound(tink, {
          delayMs: getDelayMs(LAB_POUR_TOUCH_OFFSET, 0),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      playSound(pourTrickleSound, {
        delayMs: getDelayMs(POUR_TRANSFER_START_OFFSET, 60),
        variation: REPEATED_SOUND_VARIATION,
      });
      const destination =
        operation.stateAfter[operation.destinationBottleIndex];
      if (destination && isSealedTube(destination)) {
        playSound(stopperSqueakSound, {
          delayMs: getDelayMs(LAB_STOPPER_SEATED_OFFSET - 0.06, 420),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      return;
    }
    default:
      return;
  }
}

function playClearSound() {
  playSound(rackChimeSound, {
    delayMs: POUR_ANIMATION_DURATION_MS + LAB_FINALE_CHIME_DELAY_MS,
  });
}

function playReducedMotionClearSound() {
  playSound(rackChimeSound, { delayMs: 500 });
}

export function LabSoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(labSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
  return null;
}
