import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearNoteA5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-a5.flac";
import clearNoteB5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-b5.flac";
import clearNoteC5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-c5.flac";
import clearNoteC6SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-c6.flac";
import clearNoteD5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-d5.flac";
import clearNoteE5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-e5.flac";
import clearNoteF5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-f5.flac";
import clearNoteG5SoundUrl from "@/games/slide-puzzle/assets/sounds/clear-note-g5.flac";
import invalidSoundUrl from "@/games/slide-puzzle/assets/sounds/invalid.flac";
import slidSoundUrl from "@/games/slide-puzzle/assets/sounds/slid.flac";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getClearWaveTileDelayMs } from "@/games/slide-puzzle/ui/board/clear-wave";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

/** タイルが滑る音。何枚まとめて滑っても同じ音で鳴らす。 */
const slidSound = defineSoundEffect(slidSoundUrl);

const invalidSound = defineSoundEffect(invalidSoundUrl);

/** 完成演出の波でタイルが持ち上がるたびに鳴らす1音。低い順に並べ、盤面の大きさによらず最初から最後まで駆け上がる。 */
const clearScaleSounds = [
  clearNoteC5SoundUrl,
  clearNoteD5SoundUrl,
  clearNoteE5SoundUrl,
  clearNoteF5SoundUrl,
  clearNoteG5SoundUrl,
  clearNoteA5SoundUrl,
  clearNoteB5SoundUrl,
  clearNoteC6SoundUrl,
].map(defineSoundEffect);

const slidePuzzleSounds: readonly SoundEffect[] = [
  slidSound,
  invalidSound,
  ...clearScaleSounds,
];

function createClearedSoundLayers(tileCount: number): SoundLayer[] {
  const lastScaleIndex = clearScaleSounds.length - 1;
  const firstTileDelayMs = getClearWaveTileDelayMs(0);
  return Array.from({ length: tileCount }, function createTileNote(_, order) {
    const scaleIndex = Math.round(
      (order * lastScaleIndex) / Math.max(tileCount - 1, 1),
    );
    const sound = clearScaleSounds[scaleIndex];
    return (
      sound && {
        sound,
        offsetMs: getClearWaveTileDelayMs(order) - firstTileDelayMs,
      }
    );
  }).filter((layer) => layer !== undefined);
}

function playOperationSound(operation: SlidePuzzleOperation) {
  switch (operation.type) {
    case "slid":
      playSound(slidSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

export function useSlidePuzzleSoundEffects(
  operation: SlidePuzzleOperation | null,
  progress: GameProgress,
  tileCount: number,
) {
  usePrepareSoundEffects(slidePuzzleSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, function playClearSound() {
    // 波は最後のタイルが滑り終えてから始まる。
    playLayeredSound(createClearedSoundLayers(tileCount), {
      delayMs: getClearWaveTileDelayMs(0),
    });
  });
}
