import clearedChordSoundUrl from "@/games/nanpure/assets/sounds/cleared-chord.flac";
import clearedRising1SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-1.flac";
import clearedRising2SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-2.flac";
import clearedRising3SoundUrl from "@/games/nanpure/assets/sounds/cleared-rising-3.flac";
import digitEnteredSoundUrl from "@/games/nanpure/assets/sounds/digit-entered.flac";
import mistakeEnteredSoundUrl from "@/games/nanpure/assets/sounds/mistake-entered.flac";
import noteAddedSoundUrl from "@/games/nanpure/assets/sounds/note-added.flac";
import noteRemovedSoundUrl from "@/games/nanpure/assets/sounds/note-removed.flac";
import type { NanpureOperation } from "@/games/nanpure/play/use-nanpure-play";
import { CLEAR_PULSE_MS } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
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

/** 盤面が脈打っていちばん膨らむ時。 */
const CLEAR_PULSE_PEAK_MS = CLEAR_PULSE_MS / 2;

/** 盤面が膨らむまでに、順に鳴らす音。 */
const clearedRisingSounds = [
  clearedRising1SoundUrl,
  clearedRising2SoundUrl,
  clearedRising3SoundUrl,
].map(defineSoundEffect);
const CLEAR_RISING_STEP_MS = CLEAR_PULSE_PEAK_MS / clearedRisingSounds.length;

/** 盤面が膨らみきったところで着地する音。 */
const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedRisingSounds.map(
    function createRisingLayer(sound, index): SoundLayer {
      return { sound, offsetMs: index * CLEAR_RISING_STEP_MS };
    },
  ),
  { sound: clearedChordSound, offsetMs: CLEAR_PULSE_PEAK_MS },
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

/** 盤面は数字を入れた瞬間から脈打ち始めるので、遅らせずに鳴らす。 */
function playClearSound() {
  playLayeredSound(clearedSoundLayers);
}

/**
 * 数字の入力、メモの書き込み・削除と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * マスの選択と、数字やメモを消すボタンでは鳴らさない。
 */
export function useNanpureSoundEffects(
  operation: NanpureOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(nanpureSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
