import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import glassTink1SoundUrl from "@/games/water-sort/assets/sounds/glass-tink-1.flac";
import glassTink2SoundUrl from "@/games/water-sort/assets/sounds/glass-tink-2.flac";
import pourTrickleSoundUrl from "@/games/water-sort/assets/sounds/pour-trickle.flac";
import rackChimeSoundUrl from "@/games/water-sort/assets/sounds/rack-chime.flac";
import stopperSqueakSoundUrl from "@/games/water-sort/assets/sounds/stopper-squeak.flac";
import tubeLiftSoundUrl from "@/games/water-sort/assets/sounds/tube-lift.flac";
import tubeRattleSoundUrl from "@/games/water-sort/assets/sounds/tube-rattle.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  CLEAR_FINALE_GLEAM_DELAY_MS,
  CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
} from "@/games/water-sort/ui/board/clear-finale-timing";
import {
  getPourDelayMs,
  POUR_ANIMATION_DURATION_MS,
  POUR_STOPPER_SEATED_OFFSET,
  POUR_TOUCH_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

/** 口と口が触れ合うガラスの高い音。続けて注いでも同じ音が並ばないよう2つを交互に使う。 */
const glassTinkSounds = [
  defineSoundEffect(glassTink1SoundUrl),
  defineSoundEffect(glassTink2SoundUrl),
] as const;
/** 細い口から試験管へ流れ込む音。満ちるほど管の響きが高くなる。 */
const pourTrickleSound = defineSoundEffect(pourTrickleSoundUrl);
/** ゴム栓がきゅっと入る音。 */
const stopperSqueakSound = defineSoundEffect(stopperSqueakSoundUrl);
/** 試験管立ての穴から試験管を抜く、ガラスと木の触れる音。 */
const tubeLiftSound = defineSoundEffect(tubeLiftSoundUrl);
/** 注げない試験管が試験管立ての中でかたかた揺れる音。 */
const tubeRattleSound = defineSoundEffect(tubeRattleSoundUrl);
/** 栓をした試験管どうしが試験管立ての中で鳴り合う音。 */
const rackChimeSound = defineSoundEffect(rackChimeSoundUrl);

const waterSortSounds: readonly SoundEffect[] = [
  ...glassTinkSounds,
  pourTrickleSound,
  stopperSqueakSound,
  tubeLiftSound,
  tubeRattleSound,
  rackChimeSound,
];

/** 動きを減らす設定では注ぐ動きが無いので、触れる・流れる・栓をするを間を詰めて続けて鳴らす。 */
function getPourSoundDelayMs(offset: number, reducedDelayMs: number): number {
  return prefersReducedMotion() ? reducedDelayMs : getPourDelayMs(offset);
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
          delayMs: getPourSoundDelayMs(POUR_TOUCH_OFFSET, 0),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      playSound(pourTrickleSound, {
        delayMs: getPourSoundDelayMs(POUR_TRANSFER_START_OFFSET, 60),
        variation: REPEATED_SOUND_VARIATION,
      });
      const destination =
        operation.stateAfter[operation.destinationBottleIndex];
      if (destination && isCompleteWaterSortBottle(destination)) {
        playSound(stopperSqueakSound, {
          delayMs: getPourSoundDelayMs(POUR_STOPPER_SEATED_OFFSET - 0.06, 420),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      return;
    }
    default:
      return;
  }
}

/** 最後の注ぎを終えてから、空の試験管を1本ずつ抜いて片付ける音と、栓をした列が鳴り合う音を、片付ける演出に合わせて鳴らす。 */
function playClearSound(clearingOperation: WaterSortOperation | null) {
  const emptyCount =
    clearingOperation?.type === "poured"
      ? clearingOperation.stateAfter.filter((contents) => contents.length === 0)
          .length
      : 0;
  for (let index = 0; index < emptyCount; index += 1) {
    playSound(tubeLiftSound, {
      delayMs:
        POUR_ANIMATION_DURATION_MS + index * CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
      volume: 0.55,
      playbackRate: 1 + index * 0.04,
    });
  }
  playSound(rackChimeSound, {
    delayMs: POUR_ANIMATION_DURATION_MS + CLEAR_FINALE_GLEAM_DELAY_MS,
  });
}

/** 動きを減らす設定では、片付いた姿を見せている間に、栓をした列が鳴り合う音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(rackChimeSound, { delayMs: 500 });
}

export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(waterSortSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(
    progress,
    function playClearSoundOfClearingMove() {
      playClearSound(operation);
    },
    { playReducedMotionClearSound },
  );
}
