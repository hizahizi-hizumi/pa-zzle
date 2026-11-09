import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedResonanceSoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-resonance.flac";
import clearedStrikeSoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-strike.flac";
import clearedWave1SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-5.flac";
import pieceMovedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-moved.flac";
import pieceMoved2SoundUrl from "@/games/tsume-shogi/assets/sounds/piece-moved-2.flac";
import pieceMoved3SoundUrl from "@/games/tsume-shogi/assets/sounds/piece-moved-3.flac";
import pieceRepliedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-replied.flac";
import pieceReplied2SoundUrl from "@/games/tsume-shogi/assets/sounds/piece-replied-2.flac";
import refutedSoundUrl from "@/games/tsume-shogi/assets/sounds/refuted.flac";
import rejectedSoundUrl from "@/games/tsume-shogi/assets/sounds/rejected.flac";
import type { TsumeShogiOperation } from "@/games/tsume-shogi/play/tsume-shogi-operation";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import {
  CLEAR_START_DELAY_MS,
  CLEAR_WAVE_STAGGER_MS,
  measureTsumeShogiClearWaveReach,
} from "@/games/tsume-shogi/ui/board/clear/clear-wave";
import { CLEAR_GLOW_PEAK_MS } from "@/games/tsume-shogi/ui/board/clear/TsumeShogiClearAnimation";
import { defineSoundTakes } from "@/games/tsume-shogi/ui/sound-takes";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** 攻方が駒を指す・打つ音。打音の違う3本から選ぶ。 */
const pieceMovedSounds = defineSoundTakes([
  defineSoundEffect(pieceMovedSoundUrl),
  defineSoundEffect(pieceMoved2SoundUrl),
  defineSoundEffect(pieceMoved3SoundUrl),
]);

/**
 * 玉方の応手の音。打音の違う2本から選ぶ。
 * 盤面で駒が動く同じ知らせなので同じ駒音の系統にし、利用者の操作ではないので一段控えめにする。
 */
const pieceRepliedSounds = defineSoundTakes([
  defineSoundEffect(pieceRepliedSoundUrl),
  defineSoundEffect(pieceReplied2SoundUrl),
]);

/** 誤王手に玉方が反証で逃れた音。誤王手は誤りとして数えるので、着手させなかった音より一段重くする。 */
const refutedSound = defineSoundEffect(refutedSoundUrl);

const rejectedSound = defineSoundEffect(rejectedSoundUrl);

/** 詰めた手の駒音に重ねて、最後の一手を強く重い駒音にする音。 */
const clearedStrikeSound = defineSoundEffect(clearedStrikeSoundUrl);

/** 照りの波が玉の升から盤の端へ広がるのに乗せて、順に鳴らす盤の響き。 */
const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

/** 波が盤の端に届いたところで鳴らす、盤が響く余韻。 */
const clearedResonanceSound = defineSoundEffect(clearedResonanceSoundUrl);

const tsumeShogiSounds: readonly SoundEffect[] = [
  ...pieceMovedSounds.takes,
  ...pieceRepliedSounds.takes,
  refutedSound,
  rejectedSound,
  clearedStrikeSound,
  ...clearedWaveSounds,
  clearedResonanceSound,
];

/**
 * 詰めた瞬間の強い駒音と、玉の升から `reach` 升先の盤の端まで、波が届く升の順に並べた盤の響き。
 * 盤の響きは、照りの波の升がいちばん明るく照るのに合わせる。
 */
function getClearedSoundLayers(reach: number): SoundLayer[] {
  const waveStartMs = CLEAR_START_DELAY_MS + CLEAR_GLOW_PEAK_MS;
  return [
    { sound: clearedStrikeSound, offsetMs: 0 },
    ...clearedWaveSounds.map(function createWaveLayer(sound, index) {
      const distance = (reach * index) / clearedWaveSounds.length;
      return {
        sound,
        offsetMs: waveStartMs + distance * CLEAR_WAVE_STAGGER_MS,
      };
    }),
    {
      sound: clearedResonanceSound,
      offsetMs: waveStartMs + reach * CLEAR_WAVE_STAGGER_MS,
    },
  ];
}

/** 波を立てずに詰み上がりを見せるときの、詰めた瞬間の強い駒音と盤が響く余韻。 */
const heldClearedSoundLayers: readonly SoundLayer[] = [
  { sound: clearedStrikeSound, offsetMs: 0 },
  { sound: clearedResonanceSound, offsetMs: 0 },
];

function playOperationSound(operation: TsumeShogiOperation) {
  switch (operation.type) {
    case "moved":
      playSound(pieceMovedSounds.pick(), {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "replied":
      playSound(pieceRepliedSounds.pick(), {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "refuted":
      playSound(refutedSound);
      return;
    case "rejected":
      // 動きを減らす設定でも、駒を揺らす代わりに駒の地を変えて返すので鳴らす。
      playSound(rejectedSound);
      return;
  }
}

function playHeldClearSound() {
  playLayeredSound(heldClearedSoundLayers);
}

/**
 * 攻方の着手、玉方の応手と反証、着手させなかった入力と、玉を詰ませた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 駒の選択とその解除、成 / 不成を選ぶ途中、待った・盤面を戻すでは鳴らさない。
 * `kingSquare` は玉方の玉の升。照りの波が盤の端へ届くまでの長さを決める。
 */
export function useTsumeShogiSoundEffects(
  operation: TsumeShogiOperation | null,
  progress: GameProgress,
  kingSquare: TsumeShogiSquare | null,
) {
  usePrepareSoundEffects(tsumeShogiSounds);
  useOperationSound(operation, playOperationSound);
  // 詰めた手の駒音と同じ瞬間に鳴らし始め、盤の響きは照りの波に合わせる。
  useClearSound(
    progress,
    function playClearSound() {
      if (!kingSquare) {
        playHeldClearSound();
        return;
      }
      playLayeredSound(
        getClearedSoundLayers(measureTsumeShogiClearWaveReach(kingSquare)),
      );
    },
    // 動きを減らす設定でも詰み上がりの盤を保持して見せるので、波を待たずに強い駒音と余韻を鳴らす。
    { playReducedMotionClearSound: playHeldClearSound },
  );
}
