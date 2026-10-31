import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedClackSoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-clack.flac";
import clearedWave1SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/tsume-shogi/assets/sounds/cleared-wave-5.flac";
import pieceMovedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-moved.flac";
import pieceRepliedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-replied.flac";
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
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** 攻方が駒を指す・打つ音。 */
const pieceMovedSound = defineSoundEffect(pieceMovedSoundUrl);

/** 玉方の応手の音。盤面で駒が動く同じ知らせなので同じ駒音の系統にし、利用者の操作ではないので一段控えめにする。 */
const pieceRepliedSound = defineSoundEffect(pieceRepliedSoundUrl);

/** 誤王手に玉方が反証で逃れた音。誤王手は誤りとして数えるので、着手させなかった音より一段重くする。 */
const refutedSound = defineSoundEffect(refutedSoundUrl);

const rejectedSound = defineSoundEffect(rejectedSoundUrl);

/** 照りの波が玉の升から盤の端へ広がるのに乗せて、順に鳴らす音。 */
const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

/** 波が盤の端に届いたところで鳴らす、拍子木の柝のような木の響き。 */
const clearedClackSound = defineSoundEffect(clearedClackSoundUrl);

const tsumeShogiSounds: readonly SoundEffect[] = [
  pieceMovedSound,
  pieceRepliedSound,
  refutedSound,
  rejectedSound,
  ...clearedWaveSounds,
  clearedClackSound,
];

/** 玉の升から `reach` 升先の盤の端まで、波が届く升の順に並べた素材。 */
function getClearedSoundLayers(reach: number): SoundLayer[] {
  return [
    ...clearedWaveSounds.map(function createWaveLayer(sound, index) {
      const distance = (reach * index) / clearedWaveSounds.length;
      return { sound, offsetMs: distance * CLEAR_WAVE_STAGGER_MS };
    }),
    { sound: clearedClackSound, offsetMs: reach * CLEAR_WAVE_STAGGER_MS },
  ];
}

function playOperationSound(operation: TsumeShogiOperation) {
  switch (operation.type) {
    case "moved":
      playSound(pieceMovedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "replied":
      playSound(pieceRepliedSound, { variation: REPEATED_SOUND_VARIATION });
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

function playReducedMotionClearSound() {
  playSound(clearedClackSound);
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
  // 照りの波の升がいちばん明るく照るのに合わせて鳴らす。
  useClearSound(
    progress,
    function playClearSound() {
      if (!kingSquare) {
        playSound(clearedClackSound);
        return;
      }
      playLayeredSound(
        getClearedSoundLayers(measureTsumeShogiClearWaveReach(kingSquare)),
        { delayMs: CLEAR_START_DELAY_MS + CLEAR_GLOW_PEAK_MS },
      );
    },
    // 動きを減らす設定でも詰み上がりの盤を保持して見せるので、波が届いたときの音だけを鳴らす。
    { playReducedMotionClearSound },
  );
}
