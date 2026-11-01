import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getClearWaveTileDelayMs } from "@/games/slide-puzzle/ui/board/clear-wave";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/**
 * タイルが滑る、小さく乾いた「コト」という音。
 * 1プレイで百回を超えて続けて鳴るので、短く小さくし、何枚まとめて滑っても同じ音にする。
 */
const slidSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 1400,
    endFrequency: 900,
    durationMs: 22,
    volume: 0.05,
    attackMs: 1,
  },
  {
    waveform: "sine",
    frequency: 520,
    endFrequency: 420,
    durationMs: 50,
    volume: 0.05,
    attackMs: 2,
  },
];

/** 滑らせられないタイルが枠の中でがたつく、低く短い2回の音。端末のスピーカーでも聞こえるよう倍音の多い波形を小さく鳴らす。 */
const invalidSound: readonly SoundTone[] = [
  {
    waveform: "square",
    frequency: 233,
    endFrequency: 208,
    durationMs: 40,
    volume: 0.03,
    attackMs: 2,
  },
  {
    waveform: "square",
    frequency: 208,
    endFrequency: 185,
    offsetMs: 60,
    durationMs: 40,
    volume: 0.022,
    attackMs: 2,
  },
];

/**
 * 完成演出の波でタイルが持ち上がるたびに鳴らす、木琴のような音の高さ。
 * 盤面の大きさによらず C から1オクターブ上の C まで駆け上がり、続けて鳴る結果の報酬の音（C の調）へ濁らずにつなぐ。
 */
const CLEAR_SCALE_FREQUENCIES = [
  523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5,
] as const;

function createClearWaveNote(frequency: number, offsetMs: number): SoundTone[] {
  return [
    {
      waveform: "sine",
      frequency,
      offsetMs,
      durationMs: 90,
      volume: 0.06,
      attackMs: 2,
    },
    {
      waveform: "sine",
      frequency: frequency * 4,
      offsetMs,
      durationMs: 30,
      volume: 0.012,
      attackMs: 1,
    },
  ];
}

/** 1番から順にタイルが持ち上がるのに合わせて、音を1枚ずつ上げていくクリア音。 */
function createClearedSound(tileCount: number): readonly SoundTone[] {
  const lastScaleIndex = CLEAR_SCALE_FREQUENCIES.length - 1;
  const firstTileDelayMs = getClearWaveTileDelayMs(0);
  return Array.from({ length: tileCount }, function createTileNote(_, order) {
    const scaleIndex = Math.round(
      (order * lastScaleIndex) / Math.max(tileCount - 1, 1),
    );
    return createClearWaveNote(
      CLEAR_SCALE_FREQUENCIES[scaleIndex] ?? CLEAR_SCALE_FREQUENCIES[0],
      getClearWaveTileDelayMs(order) - firstTileDelayMs,
    );
  }).flat();
}

function playOperationSound(operation: SlidePuzzleOperation) {
  switch (operation.type) {
    case "slid":
      playSound(slidSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      // 動きを減らす設定ではタイルを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

/** プレイ中の操作と、完成演出の波に合わせて効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useSlidePuzzleSoundEffects(
  operation: SlidePuzzleOperation | null,
  progress: GameProgress,
  tileCount: number,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, function playClearSound() {
    // 波は最後のタイルが滑り終えてから始まる。
    playSound(createClearedSound(tileCount), {
      delayMs: getClearWaveTileDelayMs(0),
    });
  });
}
