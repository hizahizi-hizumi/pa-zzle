import clearedSoundUrl from "@/games/nanpure/assets/sounds/cleared.wav";
import digitEnteredSoundUrl from "@/games/nanpure/assets/sounds/digit-entered.wav";
import mistakeEnteredSoundUrl from "@/games/nanpure/assets/sounds/mistake-entered.wav";
import noteAddedSoundUrl from "@/games/nanpure/assets/sounds/note-added.wav";
import noteRemovedSoundUrl from "@/games/nanpure/assets/sounds/note-removed.wav";
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

/** 数字を書き込む音。鉛筆の先が紙に当たる高く短い音に、紙の下の机に響く低い音が重なる。 */
const digitEnteredSound = defineSoundEffect(digitEnteredSoundUrl);

/**
 * ミスに数えた数字を書き込む音。書き込む鉛筆の音に、低く丸い音が続く。
 * 通らない操作より重いが、ぶつかる音にせず罰に聞こえないようにしてある。
 */
const mistakeEnteredSound = defineSoundEffect(mistakeEnteredSoundUrl);

/** メモを小さく書き込む、数字の入力より軽い鉛筆の音。 */
const noteAddedSound = defineSoundEffect(noteAddedSoundUrl);

/** メモを消す、消しゴムで一度だけ軽くこする低く柔らかい音。 */
const noteRemovedSound = defineSoundEffect(noteRemovedSoundUrl);

/**
 * クリアの、埋まった盤面が脈打つのに合わせた音。上がる音で膨らみへ向かい、いちばん膨らむ時に和音へ着地する。
 * 続けて鳴る結果の報酬の音と濁らないよう、高い音域で短く鳴る。
 */
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
