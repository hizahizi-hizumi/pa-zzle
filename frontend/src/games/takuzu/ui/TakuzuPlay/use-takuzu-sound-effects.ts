import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import { TAKUZU_BOARD_SIZE } from "@/games/takuzu/problem/problem";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import {
  CLEAR_WAVE_PEAK_MS,
  CLEAR_WAVE_STAGGER_MS,
} from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/** タイルを置く音。A の塗りの四角は詰まった低めの音、B の輪郭の丸は丸く弾む音にして、形の違いに合わせる。 */
const tilePlacedSounds: Record<TakuzuTile, readonly SoundTone[]> = {
  a: [
    {
      waveform: "triangle",
      frequency: 620,
      endFrequency: 480,
      durationMs: 45,
      volume: 0.09,
      attackMs: 2,
    },
    {
      waveform: "sine",
      frequency: 1240,
      endFrequency: 960,
      durationMs: 20,
      volume: 0.025,
      attackMs: 2,
    },
  ],
  b: [
    {
      waveform: "sine",
      frequency: 780,
      endFrequency: 1040,
      durationMs: 55,
      volume: 0.1,
      attackMs: 3,
    },
  ],
};

/** タイルを取り除いてマスを空きに戻す、置く音より小さく下がる音。 */
const emptiedSound: readonly SoundTone[] = [
  {
    waveform: "sine",
    frequency: 520,
    endFrequency: 380,
    durationMs: 40,
    volume: 0.06,
    attackMs: 3,
  },
];

/** 固定マスを押したときの、低く短い音。端末のスピーカーでも聞こえるよう倍音の多い波形を小さく鳴らす。 */
const invalidSound: readonly SoundTone[] = [
  {
    waveform: "square",
    frequency: 196,
    endFrequency: 165,
    durationMs: 120,
    volume: 0.035,
  },
];

/** 完成の波が左上から右下へ渡るまでの順番の数。波の順番はマスの「行 + 列」。 */
const CLEAR_WAVE_LAST_STEP = (TAKUZU_BOARD_SIZE - 1) * 2;
/** 波に乗せて弾ませる音。続けて鳴る結果の報酬の音と同じ調の音で上がる。 */
const CLEAR_WAVE_FREQUENCIES = [1046.5, 1174.66, 1318.51, 1567.98, 1760];
const CLEAR_WAVE_FINAL_FREQUENCIES = [2093, 1567.98];

function getWaveStepOffsetMs(step: number): number {
  return step * CLEAR_WAVE_STAGGER_MS;
}

/**
 * クリアの、タイルが斜めの波で膨らむのに合わせた音。膨らむタイルに合わせて小さく弾む音が上がっていき、
 * 波が右下の角に届いたところで澄んだ和音で終わる。
 */
const clearedSound: readonly SoundTone[] = [
  ...CLEAR_WAVE_FREQUENCIES.map(
    function createWaveNote(frequency, index): SoundTone {
      const step =
        (CLEAR_WAVE_LAST_STEP * index) / CLEAR_WAVE_FREQUENCIES.length;
      return {
        waveform: "sine",
        frequency,
        endFrequency: frequency * 1.25,
        offsetMs: getWaveStepOffsetMs(step),
        durationMs: 70,
        volume: 0.07,
        attackMs: 3,
      };
    },
  ),
  ...CLEAR_WAVE_FINAL_FREQUENCIES.map(
    function createFinalNote(frequency, index): SoundTone {
      return {
        waveform: "sine",
        frequency,
        offsetMs: getWaveStepOffsetMs(CLEAR_WAVE_LAST_STEP),
        durationMs: 320,
        volume: index === 0 ? 0.055 : 0.04,
        attackMs: 4,
      };
    },
  ),
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
      playSound(invalidSound);
      return;
  }
}

/** 左上のタイルがいちばん膨らむのに合わせて鳴らし始める。動きを減らす設定では波が無いので待たない。 */
function playClearSound() {
  playSound(clearedSound, {
    delayMs: prefersReducedMotion() ? 0 : CLEAR_WAVE_PEAK_MS,
  });
}

/** マスへの操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useTakuzuSoundEffects(
  operation: TakuzuOperation | null,
  progress: GameProgress,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
