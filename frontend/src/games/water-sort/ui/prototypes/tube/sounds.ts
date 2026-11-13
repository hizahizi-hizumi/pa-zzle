// 試作 tube の音。今の画面の音の素材を、この試作の動きの時刻に合わせて鳴らす。
import cleared from "@/games/water-sort/assets/sounds/cleared.flac";
import invalid from "@/games/water-sort/assets/sounds/invalid.flac";
import bubble1 from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import bubble2 from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import bubble3 from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import bubble4 from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import bubble5 from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import bubble6 from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  prepareSoundEffects,
  REPEATED_SOUND_VARIATION,
} from "@/lib/sound-effects";

const bubbles = [bubble1, bubble2, bubble3, bubble4, bubble5, bubble6].map(
  defineSoundEffect,
);
const invalidSound = defineSoundEffect(invalid);
const clearedSound = defineSoundEffect(cleared);
const all = [...bubbles, invalidSound, clearedSound];

export function prepareTubeSounds() {
  prepareSoundEffects(all);
}

const bubbleTimings = [0, 0.16, 0.3, 0.48, 0.64, 0.82];

/** 流れが注ぎ先に落ちている間の泡の音。 */
export function playPourSound(durationMs: number) {
  playLayeredSound(
    bubbles.map((sound, index) => ({
      sound,
      offsetMs: durationMs * (bubbleTimings[index] ?? 0),
    })),
    { variation: REPEATED_SOUND_VARIATION },
  );
}

/** 境の液面の線が消える瞬間の、澄んだ小さな泡。 */
export function playMergeSound() {
  const sound = bubbles[2];
  if (sound) playSound(sound, { playbackRate: 1.7, volume: 0.55 });
}

/** コルク栓がはまる「ぽん」。泡の音を低く短く重ねる。 */
export function playCorkSound() {
  const low = bubbles[0];
  const body = bubbles[4];
  if (!low || !body) return;
  playLayeredSound(
    [
      { sound: low, offsetMs: 0 },
      { sound: body, offsetMs: 18 },
    ],
    { playbackRate: 0.5, volume: 1.4 },
  );
}

export function playInvalidSound(delayMs = 0) {
  playSound(invalidSound, { delayMs });
}

export function playClearedSound() {
  playSound(clearedSound);
}
