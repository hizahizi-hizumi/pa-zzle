import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedChordSoundUrl from "@/games/reflection/assets/sounds/cleared-chord.flac";
import clearedSpread1SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-1.flac";
import clearedSpread2SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-2.flac";
import clearedSpread3SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-3.flac";
import clearedSpread4SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-4.flac";
import clearedSpread5SoundUrl from "@/games/reflection/assets/sounds/cleared-spread-5.flac";
import piecePlacedSoundUrl from "@/games/reflection/assets/sounds/piece-placed.flac";
import type { ReflectionOperation } from "@/games/reflection/play/use-reflection-play";
import {
  CLEAR_LIGHT_DRAW_MS,
  CLEAR_LIGHT_SPREAD_MS,
} from "@/games/reflection/ui/board/clear/ReflectionClearLight";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** ピースを盤面に置く音。移す・入れ替える・置き換えるときも、ピースが現れるので同じ音で鳴らす。 */
const piecePlacedSound = defineSoundEffect(piecePlacedSoundUrl);

const clearedSpreadSounds = [
  clearedSpread1SoundUrl,
  clearedSpread2SoundUrl,
  clearedSpread3SoundUrl,
  clearedSpread4SoundUrl,
  clearedSpread5SoundUrl,
].map(defineSoundEffect);
const CLEAR_SPREAD_STEP_MS =
  CLEAR_LIGHT_SPREAD_MS / (clearedSpreadSounds.length - 1);

const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const clearedSoundLayers: readonly SoundLayer[] = [
  ...clearedSpreadSounds.map(
    function createSpreadLayer(sound, index): SoundLayer {
      return { sound, offsetMs: index * CLEAR_SPREAD_STEP_MS };
    },
  ),
  {
    sound: clearedChordSound,
    offsetMs: CLEAR_LIGHT_SPREAD_MS + CLEAR_LIGHT_DRAW_MS,
  },
];

/**
 * 置いた結果として外周ヒントが新しく一致したときに、置いた音に続けて鳴らす短い上がる音（SPEC-013）。
 * クリアで光が広がる音と同じ素材から選び、置いた音の立ち上がりと重ならないよう少し遅らせる。
 */
const CLUE_MATCH_DELAY_MS = 60;
const CLUE_MATCH_STEP_MS = 55;
const CLUE_MATCH_VOLUME = 0.8;

function listClueMatchedLayers(newlyMatchedClueCount: number): SoundLayer[] {
  const [low, middle, high] = [
    clearedSpreadSounds[1],
    clearedSpreadSounds[3],
    clearedSpreadSounds[4],
  ];
  if (!low || !middle || !high) return [];
  const layers: SoundLayer[] = [
    { sound: low, offsetMs: 0 },
    { sound: middle, offsetMs: CLUE_MATCH_STEP_MS },
  ];
  if (newlyMatchedClueCount >= 2) {
    layers.push({ sound: high, offsetMs: CLUE_MATCH_STEP_MS * 2 });
  }
  return layers;
}

const reflectionSounds: readonly SoundEffect[] = [
  piecePlacedSound,
  ...clearedSpreadSounds,
  clearedChordSound,
];

function playPiecePlacedSound({ newlyMatchedClueCount }: ReflectionOperation) {
  playSound(piecePlacedSound, { variation: REPEATED_SOUND_VARIATION });
  if (newlyMatchedClueCount > 0) {
    playLayeredSound(listClueMatchedLayers(newlyMatchedClueCount), {
      delayMs: CLUE_MATCH_DELAY_MS,
      volume: CLUE_MATCH_VOLUME,
    });
  }
}

function playClearSound() {
  playLayeredSound(clearedSoundLayers);
}

/** 動きを減らす設定では、光路を伸ばさず全光路を一度に出して見せておくので、点ききったときの音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedChordSound);
}

export function useReflectionSoundEffects(
  operation: ReflectionOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(reflectionSounds);
  useOperationSound(operation, playPiecePlacedSound);
  useClearSound(progress, playClearSound, { playReducedMotionClearSound });
}
