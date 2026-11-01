import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/takuzu/assets/sounds/cleared.flac";
import emptiedSoundUrl from "@/games/takuzu/assets/sounds/emptied.flac";
import invalidSoundUrl from "@/games/takuzu/assets/sounds/invalid.flac";
import tileAPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-a-placed.flac";
import tileBPlacedSoundUrl from "@/games/takuzu/assets/sounds/tile-b-placed.flac";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import { CLEAR_WAVE_PEAK_MS } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** タイルを置く音。A の塗りの四角は詰まった低めの音、B の輪郭の丸は丸く弾む音で、形の違いに合わせてある。 */
const tilePlacedSounds: Record<TakuzuTile, SoundEffect> = {
  a: defineSoundEffect(tileAPlacedSoundUrl),
  b: defineSoundEffect(tileBPlacedSoundUrl),
};

/** タイルを取り除いてマスを空きに戻す、置く音より小さく下がる音。 */
const emptiedSound = defineSoundEffect(emptiedSoundUrl);

/** 固定マスを押したときの、低く短い音。 */
const invalidSound = defineSoundEffect(invalidSoundUrl);

/**
 * クリアの、タイルが斜めの波で膨らむのに合わせた音。膨らむタイルに合わせて小さく弾む音が上がっていき、
 * 波が右下の角に届いたところで澄んだ和音で終わる。続けて鳴る結果の報酬の音と同じ調の音で鳴る。
 */
const clearedSound = defineSoundEffect(clearedSoundUrl);

const takuzuSounds: readonly SoundEffect[] = [
  ...Object.values(tilePlacedSounds),
  emptiedSound,
  invalidSound,
  clearedSound,
];

function playOperationSound(operation: TakuzuOperation) {
  switch (operation.type) {
    case "placed":
      playSound(tilePlacedSounds[operation.tile], {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "emptied":
      playSound(emptiedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "invalid":
      // 動きを減らす設定では固定マスを揺らさず、画面が何も変わらないので鳴らさない。
      if (!prefersReducedMotion()) {
        playSound(invalidSound);
      }
      return;
  }
}

/** 左上のタイルがいちばん膨らむのに合わせて鳴らし始める。 */
function playClearSound() {
  playSound(clearedSound, { delayMs: CLEAR_WAVE_PEAK_MS });
}

/** マスへの操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useTakuzuSoundEffects(
  operation: TakuzuOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(takuzuSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
