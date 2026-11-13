import clearedChordSoundUrl from "@/games/nanpure/assets/sounds/cleared-chord.flac";
import clearedRising1SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-1.flac";
import clearedRising2SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-2.flac";
import clearedRising3SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-3.flac";
import digitEnteredSoundUrl from "@/games/nanpure/assets/sounds/digit-entered.flac";
import mistakeEnteredSoundUrl from "@/games/nanpure/assets/sounds/mistake-entered.flac";
import noteAddedSoundUrl from "@/games/nanpure/assets/sounds/note-added.flac";
import noteRemovedSoundUrl from "@/games/nanpure/assets/sounds/note-removed.flac";
import type { NanpureOperation } from "@/games/nanpure/play/use-nanpure-play";
import {
  CLEAR_JUMP_PEAK_MS,
  CLEAR_WAVE_SPREAD_MS,
} from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

const digitEnteredSound = defineSoundEffect(digitEnteredSoundUrl);

const mistakeEnteredSound = defineSoundEffect(mistakeEnteredSoundUrl);

const noteAddedSound = defineSoundEffect(noteAddedSoundUrl);

const noteRemovedSound = defineSoundEffect(noteRemovedSoundUrl);

const clearedRisingSounds = [
  clearedRising1SoundUrl,
  clearedRising2SoundUrl,
  clearedRising3SoundUrl,
].map(defineSoundEffect);
/** 上る音を波が盤面へ広がる間に並べ、和音を波が届ききって最後の数字が跳ね上がった瞬間に鳴らす。 */
const CLEAR_CHORD_OFFSET_MS = CLEAR_WAVE_SPREAD_MS + CLEAR_JUMP_PEAK_MS;
const CLEAR_RISING_STEP_MS = CLEAR_WAVE_SPREAD_MS / clearedRisingSounds.length;

/**
 * 行・列・ブロックが完成した音。クリアの上る音の最後の粒を小さく鳴らし、クリアの前触れに聞かせる。
 * 2つ以上のまとまりが同時に完成しても、音は1つにする。
 */
const unitCompletedSound = clearedRisingSounds[2]!;
const UNIT_COMPLETED_VOLUME = 0.6;

const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedRisingSounds.map(
    function createRisingLayer(sound, index): SoundLayer {
      return { sound, offsetMs: index * CLEAR_RISING_STEP_MS };
    },
  ),
  { sound: clearedChordSound, offsetMs: CLEAR_CHORD_OFFSET_MS },
];

const nanpureSounds: readonly SoundEffect[] = [
  digitEnteredSound,
  mistakeEnteredSound,
  noteAddedSound,
  noteRemovedSound,
  ...clearedRisingSounds,
  clearedChordSound,
];

function playOperationSound(operation: NanpureOperation) {
  switch (operation.type) {
    case "digit-entered":
      playSound(digitEnteredSound, { variation: REPEATED_SOUND_VARIATION });
      // 動きを減らす設定では、まとまりを光らせないので鳴らさない。
      if (operation.completedUnits.length > 0 && !prefersReducedMotion()) {
        playSound(unitCompletedSound, { volume: UNIT_COMPLETED_VOLUME });
      }
      return;
    case "mistake-entered":
      playSound(mistakeEnteredSound);
      return;
    case "note-added":
      playSound(noteAddedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "note-removed":
      playSound(noteRemovedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

/** 盤面は数字を入れた瞬間から波打ち始めるので、遅らせずに鳴らす。 */
function playClearSound() {
  playLayeredSound(clearedSoundLayers);
}

export function useNanpureSoundEffects(
  operation: NanpureOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(nanpureSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
