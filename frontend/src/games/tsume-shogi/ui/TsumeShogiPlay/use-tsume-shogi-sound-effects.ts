import {
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import pieceMovedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-moved.flac";
import pieceRepliedSoundUrl from "@/games/tsume-shogi/assets/sounds/piece-replied.flac";
import refutedSoundUrl from "@/games/tsume-shogi/assets/sounds/refuted.flac";
import rejectedSoundUrl from "@/games/tsume-shogi/assets/sounds/rejected.flac";
import type { TsumeShogiOperation } from "@/games/tsume-shogi/play/tsume-shogi-operation";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** 攻方が駒を指す・打つ音。 */
const pieceMovedSound = defineSoundEffect(pieceMovedSoundUrl);

/** 玉方の応手の音。盤面で駒が動く同じ知らせなので同じ駒音の系統にし、利用者の操作ではないので一段控えめにする。 */
const pieceRepliedSound = defineSoundEffect(pieceRepliedSoundUrl);

/** 誤王手に玉方が反証で逃れた音。誤王手は誤りとして数えるので、着手させなかった音より一段重くする。 */
const refutedSound = defineSoundEffect(refutedSoundUrl);

const rejectedSound = defineSoundEffect(rejectedSoundUrl);

const tsumeShogiSounds: readonly SoundEffect[] = [
  pieceMovedSound,
  pieceRepliedSound,
  refutedSound,
  rejectedSound,
];

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

/**
 * 攻方の着手、玉方の応手と反証、着手させなかった入力に効果音を鳴らす。
 * 駒の選択とその解除、成 / 不成を選ぶ途中、待った・盤面を戻すでは鳴らさない。
 */
export function useTsumeShogiSoundEffects(
  operation: TsumeShogiOperation | null,
) {
  usePrepareSoundEffects(tsumeShogiSounds);
  useOperationSound(operation, playOperationSound);
}
