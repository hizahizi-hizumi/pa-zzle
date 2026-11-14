import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedChordSoundUrl from "@/games/takuzu/assets/sounds/cleared-chord.flac";
import clearedWave1SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/takuzu/assets/sounds/cleared-wave-5.flac";
import emptiedSoundUrl from "@/games/takuzu/assets/sounds/emptied.flac";
import invalidSoundUrl from "@/games/takuzu/assets/sounds/invalid.flac";
import tileAPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-a-placed.flac";
import tileBPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-b-placed.flac";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import {
  CLEAR_WAVE_PEAK_MS,
  CLEAR_WAVE_STAGGER_MS,
} from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

/** A と B で見た目が違うので音も分ける。 */
const tilePlacedSounds: Record<TakuzuTile, SoundEffect> = {
  a: defineSoundEffect(tileAPlacedSoundUrl),
  b: defineSoundEffect(tileBPlacedSoundUrl),
};

const emptiedSound = defineSoundEffect(emptiedSoundUrl);

const invalidSound = defineSoundEffect(invalidSoundUrl);

function getWaveStepOffsetMs(step: number): number {
  return step * CLEAR_WAVE_STAGGER_MS;
}

const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

function getClearedSoundLayers(boardSize: number): readonly SoundLayer[] {
  // 波の順番はマスの「行 + 列」。
  const lastWaveStep = (boardSize - 1) * 2;
  return [
    ...clearedWaveSounds.map(
      function createWaveLayer(sound, index): SoundLayer {
        const step = (lastWaveStep * index) / clearedWaveSounds.length;
        return { sound, offsetMs: getWaveStepOffsetMs(step) };
      },
    ),
    {
      sound: clearedChordSound,
      offsetMs: getWaveStepOffsetMs(lastWaveStep),
    },
  ];
}

const takuzuSounds: readonly SoundEffect[] = [
  ...Object.values(tilePlacedSounds),
  emptiedSound,
  invalidSound,
  ...clearedWaveSounds,
  clearedChordSound,
];

function playOperationSound(operation: TakuzuOperation) {
  switch (operation.type) {
    case "placed":
      playSound(tilePlacedSounds[operation.tile], {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "emptied":
      playSound(emptiedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

export function useTakuzuSoundEffects(
  operation: TakuzuOperation | null,
  progress: GameProgress,
  boardSize: number,
) {
  usePrepareSoundEffects(takuzuSounds);
  useOperationSound(operation, playOperationSound);
  // 左上のタイルがいちばん膨らむのに合わせて鳴らし始める。
  useClearSound(progress, function playClearSound() {
    playLayeredSound(getClearedSoundLayers(boardSize), {
      delayMs: CLEAR_WAVE_PEAK_MS,
    });
  });
}
