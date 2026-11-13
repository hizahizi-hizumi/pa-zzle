import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import bubble1Url from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import bubble2Url from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import bubble3Url from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import bubble4Url from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import bubble5Url from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import bubble6Url from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  prepareSoundEffects,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

const invalidSound = defineSoundEffect(invalidSoundUrl);
const clearedSound = defineSoundEffect(clearedSoundUrl);
const bubbleSounds = [
  bubble1Url,
  bubble2Url,
  bubble3Url,
  bubble4Url,
  bubble5Url,
  bubble6Url,
].map(defineSoundEffect);

// 試作のあいだだけ: 空の管が穴に収まる「からん」を、その場で合成した短い音にする。
let clinkSound: SoundEffect | null = null;
function getClinkSound(): SoundEffect | null {
  if (clinkSound) return clinkSound;
  if (typeof window === "undefined" || typeof Blob === "undefined") return null;
  clinkSound = defineSoundEffect(URL.createObjectURL(synthesizeClink()));
  return clinkSound;
}

function synthesizeClink(): Blob {
  const rate = 44100;
  const length = Math.floor(rate * 0.75);
  const samples = new Float32Array(length);
  const hit = (start: number, gain: number, pitch: number) => {
    const partials = [
      [2380, 1, 7.5],
      [3710, 0.62, 10],
      [5230, 0.38, 15],
      [6920, 0.22, 22],
    ] as const;
    const s0 = Math.floor(start * rate);
    for (let i = s0; i < length; i++) {
      const t = (i - s0) / rate;
      let v = 0;
      for (const [f, a, d] of partials) {
        v += a * Math.sin(2 * Math.PI * f * pitch * t) * Math.exp(-d * t);
      }
      // 木に当たる鈍い音
      v += 0.9 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-38 * t);
      v *= Math.min(1, t * 2000);
      samples[i] = (samples[i] ?? 0) + v * gain;
    }
  };
  hit(0, 0.32, 1);
  hit(0.085, 0.14, 1.012);
  hit(0.142, 0.05, 0.996);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, v * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function preparePourSounds() {
  const clink = getClinkSound();
  prepareSoundEffects([
    invalidSound,
    clearedSound,
    ...bubbleSounds,
    ...(clink ? [clink] : []),
  ]);
}

/** 流れている間 durationMs を、量に応じた数の泡の音で埋める。 */
export function playPourSound(units: number, durationMs: number) {
  const count = Math.min(bubbleSounds.length, 1 + units);
  const layers = bubbleSounds.slice(0, count).map((sound, k) => ({
    sound,
    offsetMs: (durationMs * k) / count + (k % 2) * 30,
  }));
  playLayeredSound(layers, {
    variation: REPEATED_SOUND_VARIATION,
    playbackRate: 1.06 - units * 0.04,
  });
}

export function playInvalidSound() {
  playSound(invalidSound);
}

export function playClinkSound() {
  const clink = getClinkSound();
  if (clink) playSound(clink, { variation: REPEATED_SOUND_VARIATION });
}

export function playClearedSound() {
  playSound(clearedSound);
}
