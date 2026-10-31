import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/** `parking-jam-board.css` のこつんと当たる動き（`pj-block-*`）で、車が前へ出きって止まるまでの時間。 */
const BLOCKED_IMPACT_MS = 80;
/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。 */
const EXIT_DURATION_MS = 520;

/**
 * ミスとして数える、塞がれた車がこつんと当たる音。
 * 鈍い車体の音に小さな当たりの音を重ね、不成立より重く、罰に聞こえない柔らかさにする。
 */
const blockedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 165,
    endFrequency: 98,
    durationMs: 150,
    volume: 0.14,
    attackMs: 3,
  },
  {
    waveform: "square",
    frequency: 392,
    endFrequency: 294,
    durationMs: 45,
    volume: 0.03,
    attackMs: 2,
  },
];

/** 車が走り出して遠ざかる、上がっていくエンジンの音。走り去る間に消える。 */
const exitedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 140,
    endFrequency: 330,
    durationMs: 380,
    volume: 0.08,
    attackMs: 30,
  },
  {
    waveform: "square",
    frequency: 70,
    endFrequency: 165,
    durationMs: 300,
    volume: 0.025,
    attackMs: 30,
  },
];

/** クラクションの1音。柔らかい三角波に倍音の多い矩形波を少し混ぜる。 */
function createHornTones(
  offsetMs: number,
  durationMs: number,
): readonly SoundTone[] {
  // 結果の報酬の音（C の調）へ濁らずにつながるよう、C と E の長三度で鳴らす。
  return [523.25, 659.25].flatMap(function createHornNote(frequency) {
    return [
      {
        waveform: "triangle",
        frequency,
        offsetMs,
        durationMs,
        volume: 0.045,
        attackMs: 6,
      },
      {
        waveform: "square",
        frequency,
        offsetMs,
        durationMs,
        volume: 0.015,
        attackMs: 6,
      },
    ] satisfies SoundTone[];
  });
}

/** クリアの、最後の車が走り去りながら鳴らす軽い2回のクラクション。 */
const clearedSound: readonly SoundTone[] = [
  ...createHornTones(0, 80),
  ...createHornTones(140, 130),
];

/** 最後の車が駐車場を半分ほど走り抜けたところでクラクションを鳴らし、出ていき終える前に鳴り終える。 */
const CLEAR_SOUND_DELAY_MS = EXIT_DURATION_MS * 0.4;

/** 演出に合わせて遅らせる時間。動きを減らす設定では車がすぐ止まり・すぐ出ていくので待たない。 */
function getMotionDelayMs(delayMs: number): number {
  return prefersReducedMotion() ? 0 : delayMs;
}

function playOperationSound(operation: ParkingJamOperation) {
  switch (operation.type) {
    case "blocked":
      playSound(blockedSound, {
        delayMs: getMotionDelayMs(BLOCKED_IMPACT_MS),
      });
      return;
    case "exited":
      playSound(exitedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

function playClearSound() {
  playSound(clearedSound, {
    delayMs: getMotionDelayMs(CLEAR_SOUND_DELAY_MS),
  });
}

/**
 * 車を動かす操作と、最後の車が出ていく瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 車の選択とその解除では鳴らさない。
 */
export function useParkingJamSoundEffects(
  operation: ParkingJamOperation | null,
  progress: GameProgress,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
