import { useEffect, useLayoutEffect, useRef } from "react";
import type { GameProgress } from "@/games/play";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playSound,
  prepareSoundEffects,
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

/** クリアの、上がっていく短い和音の分散。 */
const clearedSound: readonly SoundTone[] = [523.25, 659.25, 783.99, 1046.5].map(
  function createArpeggioNote(frequency, index, frequencies) {
    const isLast = index === frequencies.length - 1;
    return {
      waveform: "triangle",
      frequency,
      offsetMs: index * 90,
      durationMs: isLast ? 360 : 140,
      volume: 0.1,
      attackMs: 6,
    };
  },
);

function playOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "source-selected":
      playSound(sourceSelectedSound);
      return;
    case "source-deselected":
      playSound(sourceDeselectedSound);
      return;
    case "invalid":
      playSound(invalidSound);
      return;
    case "poured":
      playSound(pouredSound, {
        delayMs: prefersReducedMotion()
          ? 0
          : POUR_ANIMATION_DURATION_MS * POUR_TRANSFER_START_OFFSET,
      });
      return;
  }
}

/** プレイ中の操作と、クリアして結果を見せる瞬間に効果音を鳴らす。 */
export function useWaterSortSoundEffects(
  operation: WaterSortOperation | null,
  progress: GameProgress,
) {
  // 画面を出した時点の操作と進行は、鳴らし済みとして扱う。
  const playedOperationIdRef = useRef(operation?.id ?? null);
  const previousProgressRef = useRef(progress);

  useEffect(() => {
    prepareSoundEffects();
  }, []);

  useLayoutEffect(() => {
    if (!operation || playedOperationIdRef.current === operation.id) {
      return;
    }
    playedOperationIdRef.current = operation.id;
    playOperationSound(operation);
  }, [operation]);

  useEffect(() => {
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = progress;
    if (previousProgress === "clearing" && progress === "result") {
      playSound(clearedSound);
    }
  }, [progress]);
}
