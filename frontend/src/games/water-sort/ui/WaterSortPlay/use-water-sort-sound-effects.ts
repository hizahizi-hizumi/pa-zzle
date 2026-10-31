import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/** ボトルを持ち上げる、上がる短い音。 */
const sourceSelectedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 740,
    endFrequency: 1110,
    durationMs: 70,
    volume: 0.12,
  },
];

/** ボトルを置き直す、下がる控えめな音。 */
const sourceDeselectedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 1110,
    endFrequency: 740,
    durationMs: 60,
    volume: 0.07,
  },
];

/** 通らない操作の、低く短い音。端末のスピーカーでも聞こえるよう倍音の多い波形を小さく鳴らす。 */
const invalidSound: readonly SoundTone[] = [
  {
    waveform: "square",
    frequency: 220,
    endFrequency: 185,
    durationMs: 130,
    volume: 0.035,
  },
];

const POUR_TRANSFER_DURATION_MS =
  POUR_ANIMATION_DURATION_MS *
  (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET);

/** 泡の鳴り始め。水が流れている間を均等にせず、こぽこぽと揺らぐ間隔で埋める。 */
const POUR_BUBBLE_TIMINGS = [0, 0.16, 0.3, 0.48, 0.64, 0.82];
const POUR_BUBBLE_START_FREQUENCY = 420;
const POUR_BUBBLE_END_FREQUENCY = 700;

/** 注ぐ水の、泡が弾けるような音の連なり。注ぎ先が満ちていくように少しずつ高くする。 */
const pouredSound: readonly SoundTone[] = POUR_BUBBLE_TIMINGS.map(
  function createBubble(timing, index) {
    const progress = index / (POUR_BUBBLE_TIMINGS.length - 1);
    const frequency =
      POUR_BUBBLE_START_FREQUENCY +
      (POUR_BUBBLE_END_FREQUENCY - POUR_BUBBLE_START_FREQUENCY) * progress;
    return {
      waveform: "sine",
      frequency,
      endFrequency: frequency * 1.9,
      offsetMs: POUR_TRANSFER_DURATION_MS * timing,
      durationMs: 60,
      volume: 0.13,
      attackMs: 3,
    };
  },
);

/** 満ちていく水の、泡が駆け上がる短い連なり。 */
const FILLED_BUBBLE_FREQUENCIES = [700, 900, 1150, 1450];
const FILLED_BUBBLE_STEP_MS = 40;
/** 泡が上がりきった後に、満ちたボトルが澄んで鳴る音の鳴り始め。 */
const FILLED_RING_OFFSET_MS =
  FILLED_BUBBLE_FREQUENCIES.length * FILLED_BUBBLE_STEP_MS;

/**
 * クリアの、最後のボトルが満ちる音。泡が駆け上がり、満ちたグラスのように澄んで鳴って終わる。
 * 続けて鳴る結果の報酬の音と濁らないよう、短くし、同じ調の音で鳴らす。
 */
const clearedSound: readonly SoundTone[] = [
  ...FILLED_BUBBLE_FREQUENCIES.map(
    function createFilledBubble(frequency, index): SoundTone {
      return {
        waveform: "sine",
        frequency,
        endFrequency: frequency * 1.6,
        offsetMs: index * FILLED_BUBBLE_STEP_MS,
        durationMs: 55,
        volume: 0.1,
        attackMs: 3,
      };
    },
  ),
  {
    waveform: "sine",
    frequency: 1318.51,
    offsetMs: FILLED_RING_OFFSET_MS,
    durationMs: 380,
    volume: 0.07,
    attackMs: 4,
  },
  {
    waveform: "sine",
    frequency: 2637.02,
    offsetMs: FILLED_RING_OFFSET_MS,
    durationMs: 220,
    volume: 0.025,
    attackMs: 3,
  },
];

/** 注いだ水が注ぎ先へ流れ込み終わるまでの時間。動きを減らす設定では注ぐ動きが無いので待たない。 */
function getPourTransferDelayMs(transferOffset: number): number {
  return prefersReducedMotion()
    ? 0
    : POUR_ANIMATION_DURATION_MS * transferOffset;
}

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(sourceSelectedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "source-deselected":
      playSound(sourceDeselectedSound, {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "invalid":
      playSound(invalidSound);
      return;
    case "poured":
      playSound(pouredSound, {
        delayMs: getPourTransferDelayMs(POUR_TRANSFER_START_OFFSET),
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
  }
}

/** 最後の注水で水が流れ込み終わるのに合わせて、クリア音を鳴らす。 */
function playClearSound() {
  playSound(clearedSound, {
    delayMs: getPourTransferDelayMs(POUR_TRANSFER_END_OFFSET),
  });
}

/** プレイ中の操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
