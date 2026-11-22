import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import cellEngageSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/cell-engage.flac";
import cellLockSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/cell-lock.flac";
import cellReleaseSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/cell-release.flac";
import fieldRefuseSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/field-refuse.flac";
import startupHumSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/startup-hum.flac";
import startupNodeSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/startup-node.flac";
import transferDrawSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/transfer-draw.flac";
import transferLandSoundUrl from "@/games/water-sort/assets/sounds/ideas/future/transfer-land.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble6SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getCellIgnitions } from "@/games/water-sort/ui/ideas/future/future-finale-timing";
import {
  FIELD_POUR_DURATION_MS,
  FIELD_POUR_PHASES,
} from "@/games/water-sort/ui/ideas/future/future-pour-timing";
import type { WaterSortSoundEffectsProps } from "@/games/water-sort/ui/ideas/overrides";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

const cellEngageSound = defineSoundEffect(cellEngageSoundUrl);
const cellReleaseSound = defineSoundEffect(cellReleaseSoundUrl);
const fieldRefuseSound = defineSoundEffect(fieldRefuseSoundUrl);
const transferDrawSound = defineSoundEffect(transferDrawSoundUrl);
const transferLandSound = defineSoundEffect(transferLandSoundUrl);
const cellLockSound = defineSoundEffect(cellLockSoundUrl);
const startupHumSound = defineSoundEffect(startupHumSoundUrl);
const startupNodeSound = defineSoundEffect(startupNodeSoundUrl);
/** 宙を渡ってきても液体であることを、受け止めた所の泡の音で残す。 */
const landingBubbleLayers = [
  { sound: defineSoundEffect(pouredBubble2SoundUrl), offsetMs: 30 },
  { sound: defineSoundEffect(pouredBubble4SoundUrl), offsetMs: 120 },
  { sound: defineSoundEffect(pouredBubble6SoundUrl), offsetMs: 230 },
];

const futureSounds: readonly SoundEffect[] = [
  cellEngageSound,
  cellReleaseSound,
  fieldRefuseSound,
  transferDrawSound,
  transferLandSound,
  cellLockSound,
  startupHumSound,
  startupNodeSound,
  ...landingBubbleLayers.map(({ sound }) => sound),
];

/** 起動の点灯の音の高さ（再生の速さ）。管を走るにつれて上がる五音の並び。 */
const IGNITION_PITCHES = [1, 1.122, 1.26, 1.498, 1.682, 2];

function getPourDelayMs(offset: number): number {
  return prefersReducedMotion() ? 0 : FIELD_POUR_DURATION_MS * offset;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(cellEngageSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "source-deselected":
      playSound(cellReleaseSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(fieldRefuseSound);
      }
      return;
    case "poured": {
      if (!prefersReducedMotion()) {
        playSound(transferDrawSound, {
          delayMs: getPourDelayMs(FIELD_POUR_PHASES.headLeaves) * 0.5,
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      const landingDelayMs = getPourDelayMs(FIELD_POUR_PHASES.headArrives);
      playSound(transferLandSound, {
        delayMs: landingDelayMs,
        variation: REPEATED_SOUND_VARIATION,
      });
      playLayeredSound(landingBubbleLayers, {
        delayMs: landingDelayMs,
        playbackRate: 0.82,
        volume: 0.7,
        variation: REPEATED_SOUND_VARIATION,
      });
      const destination =
        operation.stateAfter[operation.destinationBottleIndex] ?? [];
      if (isCompleteWaterSortBottle(destination)) {
        playSound(cellLockSound, {
          delayMs: prefersReducedMotion() ? 120 : FIELD_POUR_DURATION_MS,
        });
      }
      return;
    }
  }
}

/** 起動のうなりと、管が灯るたびの点灯の音。最後は大きく鳴らさず、結果の報酬の音に譲る。 */
function playStartupSound(operation: WaterSortOperation | null) {
  if (operation?.type !== "poured") {
    return;
  }
  const startMs = FIELD_POUR_DURATION_MS + 40;
  playSound(startupHumSound, { delayMs: startMs });
  const lit = getCellIgnitions(operation.stateAfter).filter(
    (ignition) => ignition.colorIndex !== null,
  );
  lit.forEach((ignition, order) => {
    const step = Math.round(
      (order * (IGNITION_PITCHES.length - 1)) / Math.max(1, lit.length - 1),
    );
    playSound(startupNodeSound, {
      delayMs: startMs + ignition.delayMs,
      playbackRate: IGNITION_PITCHES[step] ?? 1,
      volume: 0.75,
    });
  });
}

export function FutureSoundEffects({
  operation,
  progress,
}: WaterSortSoundEffectsProps) {
  usePrepareSoundEffects(futureSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, () => playStartupSound(operation));
  return null;
}
