import type { GameResultLevel } from "@/games/result";
import type { SoundTone } from "@/lib/sound-effects";

/**
 * 結果の報酬の音の組み立て。全ゲームで同じ鐘のような音色で、上がる分散和音から和音へ着地させる。
 * 評価段階が高いほど音を重ね、長く響かせる。紙吹雪を出す段階（great 以上）では、高い煌めきを足す。
 */
type GameResultSoundDesign = {
  /** 先に順に鳴らす音の周波数（Hz）。 */
  arpeggio: readonly number[];
  arpeggioStepMs: number;
  /** 分散和音の後に着地する和音の周波数（Hz）。 */
  chord: readonly number[];
  chordDurationMs: number;
  /** 和音の1音の音量。重ねる音が多い段階ほど小さくし、合計の大きさを揃える。 */
  chordVolume: number;
  /** 和音に重ねる高い煌めきの周波数（Hz）。 */
  sparkles: readonly number[];
};

const NOTE = {
  G4: 392,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
  C7: 2093,
  E7: 2637.02,
  G7: 3135.96,
  C8: 4186.01,
} as const;

const ARPEGGIO_NOTE_DURATION_MS = 220;
const ARPEGGIO_NOTE_VOLUME = 0.075;
/** 鐘らしさを出す、1オクターブ上の倍音の音量比と長さの比。 */
const OVERTONE_VOLUME_RATIO = 0.3;
const OVERTONE_DURATION_RATIO = 0.5;
const SPARKLE_STEP_MS = 85;
const SPARKLE_DURATION_MS = 140;
const SPARKLE_VOLUME = 0.025;

const gameResultSoundDesigns: Record<GameResultLevel, GameResultSoundDesign> = {
  clear: {
    arpeggio: [NOTE.G4, NOTE.C5],
    arpeggioStepMs: 110,
    chord: [NOTE.C5, NOTE.E5],
    chordDurationMs: 600,
    chordVolume: 0.07,
    sparkles: [],
  },
  good: {
    arpeggio: [NOTE.G4, NOTE.C5, NOTE.E5],
    arpeggioStepMs: 100,
    chord: [NOTE.C5, NOTE.E5, NOTE.G5],
    chordDurationMs: 800,
    chordVolume: 0.06,
    sparkles: [],
  },
  great: {
    arpeggio: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6],
    arpeggioStepMs: 90,
    chord: [NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6],
    chordDurationMs: 1000,
    chordVolume: 0.055,
    sparkles: [NOTE.C7, NOTE.E7],
  },
  perfect: {
    arpeggio: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6],
    arpeggioStepMs: 80,
    chord: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G6],
    chordDurationMs: 1300,
    chordVolume: 0.05,
    sparkles: [NOTE.C7, NOTE.E7, NOTE.G7, NOTE.C8],
  },
};

function createBellNote(
  frequency: number,
  offsetMs: number,
  durationMs: number,
  volume: number,
): SoundTone[] {
  return [
    {
      waveform: "triangle",
      frequency,
      offsetMs,
      durationMs,
      volume,
      attackMs: 5,
    },
    {
      waveform: "sine",
      frequency: frequency * 2,
      offsetMs,
      durationMs: durationMs * OVERTONE_DURATION_RATIO,
      volume: volume * OVERTONE_VOLUME_RATIO,
      attackMs: 3,
    },
  ];
}

function createGameResultSound({
  arpeggio,
  arpeggioStepMs,
  chord,
  chordDurationMs,
  chordVolume,
  sparkles,
}: GameResultSoundDesign): readonly SoundTone[] {
  const chordOffsetMs = arpeggio.length * arpeggioStepMs;
  return [
    ...arpeggio.flatMap(function createArpeggioNote(frequency, index) {
      return createBellNote(
        frequency,
        index * arpeggioStepMs,
        ARPEGGIO_NOTE_DURATION_MS,
        ARPEGGIO_NOTE_VOLUME,
      );
    }),
    ...chord.flatMap(function createChordNote(frequency) {
      return createBellNote(
        frequency,
        chordOffsetMs,
        chordDurationMs,
        chordVolume,
      );
    }),
    ...sparkles.map(function createSparkle(frequency, index): SoundTone {
      return {
        waveform: "sine",
        frequency,
        offsetMs: chordOffsetMs + (index + 1) * SPARKLE_STEP_MS,
        durationMs: SPARKLE_DURATION_MS,
        volume: SPARKLE_VOLUME,
        attackMs: 2,
      };
    }),
  ];
}

const gameResultSounds: Record<GameResultLevel, readonly SoundTone[]> = {
  clear: createGameResultSound(gameResultSoundDesigns.clear),
  good: createGameResultSound(gameResultSoundDesigns.good),
  great: createGameResultSound(gameResultSoundDesigns.great),
  perfect: createGameResultSound(gameResultSoundDesigns.perfect),
};

/** 評価段階に応じた、結果の報酬の音。 */
export function getGameResultSound(
  level: GameResultLevel,
): readonly SoundTone[] {
  return gameResultSounds[level];
}
