import clearedSoundUrl from "@/games/nanpure/assets/sounds/cleared.flac";
import digitEnteredSoundUrl from "@/games/nanpure/assets/sounds/digit-entered.flac";
import mistakeEnteredSoundUrl from "@/games/nanpure/assets/sounds/mistake-entered.flac";
import noteAddedSoundUrl from "@/games/nanpure/assets/sounds/note-added.flac";
import noteRemovedSoundUrl from "@/games/nanpure/assets/sounds/note-removed.flac";
import type { NanpureOperation } from "@/games/nanpure/play/use-nanpure-play";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

const digitEnteredSound = defineSoundEffect(digitEnteredSoundUrl);

const mistakeEnteredSound = defineSoundEffect(mistakeEnteredSoundUrl);

const noteAddedSound = defineSoundEffect(noteAddedSoundUrl);

const noteRemovedSound = defineSoundEffect(noteRemovedSoundUrl);

const clearedSound = defineSoundEffect(clearedSoundUrl);

const nanpureSounds: readonly SoundEffect[] = [
  digitEnteredSound,
  mistakeEnteredSound,
  noteAddedSound,
  noteRemovedSound,
  clearedSound,
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
  playSound(clearedSound);
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
