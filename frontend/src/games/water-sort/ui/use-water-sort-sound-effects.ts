import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import glassTink1SoundUrl from "@/games/water-sort/assets/sounds/glass-tink-1.flac";
import glassTink2SoundUrl from "@/games/water-sort/assets/sounds/glass-tink-2.flac";
import pourTrickle1SoundUrl from "@/games/water-sort/assets/sounds/pour-trickle-1.flac";
import pourTrickle2SoundUrl from "@/games/water-sort/assets/sounds/pour-trickle-2.flac";
import pourTrickle3SoundUrl from "@/games/water-sort/assets/sounds/pour-trickle-3.flac";
import pourTrickle4SoundUrl from "@/games/water-sort/assets/sounds/pour-trickle-4.flac";
import rackChimeSoundUrl from "@/games/water-sort/assets/sounds/rack-chime.flac";
import stopperSqueakSoundUrl from "@/games/water-sort/assets/sounds/stopper-squeak.flac";
import tubeLiftSoundUrl from "@/games/water-sort/assets/sounds/tube-lift.flac";
import tubeRattleSoundUrl from "@/games/water-sort/assets/sounds/tube-rattle.flac";
import tubeRingSoundUrl from "@/games/water-sort/assets/sounds/tube-ring.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
  getClearFinaleGleamStartMs,
} from "@/games/water-sort/ui/board/clear-finale-timing";
import { getPouredSlotCount } from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  getPourTiming,
  POUR_FLOW_PER_SLOT_MS,
} from "@/games/water-sort/ui/board/pour/pour-timing";
import {
  defineSoundEffect,
  playLayeredSound,
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
/**
 * 細い口から試験管へ流れ込む音を、液面が1段上がる間ごとに分けたもの（下の段から順）。満ちるほど管の響きが高くなる。
 * 注ぎ先の液面の段から注ぐ段の数だけ、1段を注ぐ間ずつずらして重ねると、ひと続きの流れの音になる。
 */
const pourTrickleSounds = [
  defineSoundEffect(pourTrickle1SoundUrl),
  defineSoundEffect(pourTrickle2SoundUrl),
  defineSoundEffect(pourTrickle3SoundUrl),
  defineSoundEffect(pourTrickle4SoundUrl),
] as const;
/** ゴム栓がきゅっと入る音。 */
const stopperSqueakSound = defineSoundEffect(stopperSqueakSoundUrl);
/** 試験管立ての穴から試験管を抜く、ガラスと木の触れる音。 */
const tubeLiftSound = defineSoundEffect(tubeLiftSoundUrl);
/** 注げない試験管が試験管立ての中でかたかた揺れる音。 */
const tubeRattleSound = defineSoundEffect(tubeRattleSoundUrl);
/** 栓をした試験管どうしが試験管立ての中で鳴り合う音。 */
const rackChimeSound = defineSoundEffect(rackChimeSoundUrl);
/** 栓をした試験管が澄んで鳴る音。そろうたびに音階を上がる。 */
const tubeRingSound = defineSoundEffect(tubeRingSoundUrl);

const waterSortSounds: readonly SoundEffect[] = [
  ...glassTinkSounds,
  ...pourTrickleSounds,
  stopperSqueakSound,
  tubeRingSound,
  tubeLiftSound,
  tubeRattleSound,
  rackChimeSound,
];

/** 動きを減らす設定では注ぐ動きが無いので、触れる・流れる・栓をするを間を詰めて続けて鳴らす。 */
function getPourSoundDelayMs(pourMs: number, reducedDelayMs: number): number {
  return prefersReducedMotion() ? reducedDelayMs : pourMs;
}

/** 注ぎ先の液面が `fromSlot` 段から `slotCount` 段上がる間の、流れ込む音。 */
function getPourTrickleLayers(fromSlot: number, slotCount: number) {
  return pourTrickleSounds
    .slice(fromSlot, fromSlot + slotCount)
    .map((sound, index) => ({
      sound,
      offsetMs: index * POUR_FLOW_PER_SLOT_MS,
    }));
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
      // 動きを減らす設定でも、注げなかった試験管は一度暗くなって画面が変わるので、同じ音を鳴らす。
      playSound(tubeRattleSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "poured": {
      const slotCount = getPouredSlotCount(operation);
      const timing = getPourTiming(slotCount);
      const tink = glassTinkSounds[operation.id % glassTinkSounds.length];
      if (tink) {
        playSound(tink, {
          delayMs: getPourSoundDelayMs(timing.touchMs, 0),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      const destinationBefore =
        operation.stateBefore[operation.destinationBottleIndex] ?? [];
      playLayeredSound(
        getPourTrickleLayers(destinationBefore.length, slotCount),
        {
          delayMs: getPourSoundDelayMs(timing.landStartMs, 60),
          variation: REPEATED_SOUND_VARIATION,
        },
      );
      const destination =
        operation.stateAfter[operation.destinationBottleIndex];
      if (destination && isCompleteWaterSortBottle(destination)) {
        playSealSound(
          operation.stateAfter,
          // 栓が口に入って押し込まれ始める所で、きゅっと鳴らす。
          getPourSoundDelayMs(timing.stopperSeatedMs - 90, 420),
        );
      }
      return;
    }
    default:
      return;
  }
}

/** そろった試験管の澄んだ音の高さ。長調の五音音階の段（半音の数）。 */
const sealRingSemitones = [0, 2, 4, 7, 9, 12, 14, 16] as const;

/**
 * そろった試験管の数が増えるほど、澄んだ音を高い段へ上げる。
 * 色が音階の段より多い盤面は、最後の1本が最も高い段になるよう、そろった割合で段を選ぶ。
 */
function getSealRingPlaybackRate(state: WaterSortState): number {
  const colorCount = new Set(state.flat()).size;
  const sealedCount = state.filter(isCompleteWaterSortBottle).length;
  const lastStep = sealRingSemitones.length - 1;
  const step =
    colorCount - 1 <= lastStep
      ? sealedCount - 1
      : Math.round(((sealedCount - 1) * lastStep) / (colorCount - 1));
  const semitones =
    sealRingSemitones[Math.min(lastStep, Math.max(0, step))] ?? 0;
  return 2 ** (semitones / 12);
}

/** ゴム栓がきゅっと入り、栓をした試験管が澄んで鳴る。 */
function playSealSound(stateAfter: WaterSortState, delayMs: number) {
  playSound(stopperSqueakSound, {
    delayMs,
    variation: REPEATED_SOUND_VARIATION,
  });
  playSound(tubeRingSound, {
    delayMs: delayMs + 70,
    playbackRate: getSealRingPlaybackRate(stateAfter),
  });
}

/** 最後の注ぎを終えてから、空の試験管を1本ずつ抜いて片付ける音と、栓をした列が鳴り合う音を、片付ける演出に合わせて鳴らす。 */
function playClearSound(clearingOperation: WaterSortOperation | null) {
  const isPoured = clearingOperation?.type === "poured";
  const emptyCount = isPoured
    ? clearingOperation.stateAfter.filter((contents) => contents.length === 0)
        .length
    : 0;
  const pourDurationMs = isPoured
    ? getPourTiming(getPouredSlotCount(clearingOperation)).durationMs
    : 0;
  for (let index = 0; index < emptyCount; index += 1) {
    playSound(tubeLiftSound, {
      delayMs: pourDurationMs + index * CLEAR_FINALE_PUT_AWAY_STAGGER_MS,
      volume: 0.55,
      playbackRate: 1 + index * 0.04,
    });
  }
  playSound(rackChimeSound, {
    delayMs: pourDurationMs + getClearFinaleGleamStartMs(emptyCount),
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

export const _private = { getSealRingPlaybackRate };
