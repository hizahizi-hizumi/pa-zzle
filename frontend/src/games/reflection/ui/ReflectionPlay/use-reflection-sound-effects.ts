import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import type { ReflectionOperation } from "@/games/reflection/play/use-reflection-play";
import {
  CLEAR_LIGHT_DRAW_MS,
  CLEAR_LIGHT_HOLD_MS,
  CLEAR_LIGHT_SPREAD_MS,
} from "@/games/reflection/ui/board/clear/ReflectionClearLight";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/** ストックの種類や盤面のピースを選ぶ、ガラスに触れるような高く小さな音。 */
const selectedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 1568,
    endFrequency: 2093,
    durationMs: 45,
    volume: 0.06,
  },
];

/** 選択を解く、下がる控えめな音。 */
const deselectedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 2093,
    endFrequency: 1568,
    durationMs: 40,
    volume: 0.045,
  },
];

/**
 * ピースを盤面に置く、ガラスの鏡を置いたような澄んだ音。移す・入れ替える・置き換えるときも、ピースが現れるので同じ音にする。
 * 整数倍から外した高い音を重ねて、鐘ではなくガラスの響きにする。
 */
const pieceSetSound: readonly SoundTone[] = [
  {
    waveform: "sine",
    frequency: 1318.51,
    durationMs: 140,
    volume: 0.08,
    attackMs: 2,
  },
  {
    waveform: "sine",
    frequency: 3296.28,
    durationMs: 70,
    volume: 0.025,
    attackMs: 2,
  },
];

/** ピースを手持ちへ戻す、下がって消える音。 */
const pieceReturnedSound: readonly SoundTone[] = [
  {
    waveform: "sine",
    frequency: 1318.51,
    endFrequency: 987.77,
    durationMs: 100,
    volume: 0.06,
    attackMs: 2,
  },
];

/** 光路を表示する、光が走るように駆け上がる控えめな音。光の結果によらず同じ音にする。 */
const laserShownSound: readonly SoundTone[] = [
  {
    waveform: "sine",
    frequency: 880,
    endFrequency: 1760,
    durationMs: 90,
    volume: 0.05,
  },
  {
    waveform: "sine",
    frequency: 1760,
    endFrequency: 3520,
    durationMs: 60,
    volume: 0.015,
  },
];

/** 光路が入口から順に伸びていくのに合わせて鳴らす、上がっていく音。 */
const CLEAR_SPREAD_FREQUENCIES = [1046.5, 1174.66, 1318.51, 1567.98, 1760];
const CLEAR_SPREAD_STEP_MS =
  CLEAR_LIGHT_SPREAD_MS / (CLEAR_SPREAD_FREQUENCIES.length - 1);

const clearSpreadSound: readonly SoundTone[] = CLEAR_SPREAD_FREQUENCIES.map(
  function createSpreadTone(frequency, index): SoundTone {
    return {
      waveform: "sine",
      frequency,
      offsetMs: index * CLEAR_SPREAD_STEP_MS,
      durationMs: 260,
      volume: 0.05,
      attackMs: 6,
    };
  },
);

/** 全光路が点いた盤面を見せている間に鳴り終える。続く結果の報酬の音と重ならないよう、見せておく時間より短くする。 */
const CLEAR_RING_DURATION_MS = CLEAR_LIGHT_HOLD_MS - 100;

/**
 * 全光路が点ききった、ガラスが澄んで鳴る和音。
 * 続けて鳴る結果の報酬の音と濁らないよう、同じ調の音で鳴らす。
 */
function createClearRingSound(offsetMs: number): readonly SoundTone[] {
  return [
    {
      waveform: "sine",
      frequency: 1046.5,
      offsetMs,
      durationMs: CLEAR_RING_DURATION_MS,
      volume: 0.06,
      attackMs: 8,
    },
    {
      waveform: "sine",
      frequency: 1567.98,
      offsetMs,
      durationMs: CLEAR_RING_DURATION_MS,
      volume: 0.04,
      attackMs: 8,
    },
    {
      waveform: "sine",
      frequency: 2637.02,
      offsetMs,
      durationMs: CLEAR_RING_DURATION_MS / 2,
      volume: 0.015,
      attackMs: 4,
    },
  ];
}

const clearedSound: readonly SoundTone[] = [
  ...clearSpreadSound,
  ...createClearRingSound(CLEAR_LIGHT_SPREAD_MS + CLEAR_LIGHT_DRAW_MS),
];

/** 動きを減らす設定では、光路を伸ばさず全光路を一度に出して見せておくので、点ききった和音だけを鳴らす。 */
const reducedMotionClearedSound = createClearRingSound(0);

function playOperationSound(operation: ReflectionOperation) {
  switch (operation.type) {
    case "selected":
      playSound(selectedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "deselected":
      playSound(deselectedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "piece-placed":
    case "piece-moved":
      playSound(pieceSetSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "piece-returned":
      playSound(pieceReturnedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "laser-shown":
      playSound(laserShownSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

function playClearSound() {
  playSound(clearedSound);
}

function playReducedMotionClearSound() {
  playSound(reducedMotionClearedSound);
}

/** プレイ中の操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useReflectionSoundEffects(
  operation: ReflectionOperation | null,
  progress: GameProgress,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
}
