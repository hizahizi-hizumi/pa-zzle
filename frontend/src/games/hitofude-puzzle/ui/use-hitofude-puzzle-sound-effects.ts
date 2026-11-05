import blockedSoundUrl from "@/games/hitofude-puzzle/assets/sounds/blocked.flac";
import clearedEndSoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-end.flac";
import clearedTrace1SoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-trace-1.flac";
import clearedTrace2SoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-trace-2.flac";
import clearedTrace3SoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-trace-3.flac";
import clearedTrace4SoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-trace-4.flac";
import clearedTrace5SoundUrl from "@/games/hitofude-puzzle/assets/sounds/cleared-trace-5.flac";
import pathExtendedSoundUrl from "@/games/hitofude-puzzle/assets/sounds/path-extended.flac";
import pathShortenedSoundUrl from "@/games/hitofude-puzzle/assets/sounds/path-shortened.flac";
import type { HitofudePuzzlePathNotice } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import { getClearTraceDurationMs } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/play-clear-trace";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** 道を1マス延ばす、ペン先が次の点に触れる小さく上がる音。 */
const pathExtendedSound = defineSoundEffect(pathExtendedSoundUrl);
/** 道を巻き戻す、延ばす音より小さく下がる音。 */
const pathShortenedSound = defineSoundEffect(pathShortenedSoundUrl);
/** 道を延ばせなかった、先端が突き当たる柔らかく低い音。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/** 完成した道を始点から光でなぞるのに合わせて、順に鳴らす上がっていく音。 */
const clearedTraceSounds = [
  clearedTrace1SoundUrl,
  clearedTrace2SoundUrl,
  clearedTrace3SoundUrl,
  clearedTrace4SoundUrl,
  clearedTrace5SoundUrl,
].map(defineSoundEffect);

/** 終点の印を置いたときの和音。続けて鳴る結果の報酬の音と同じ調の音で鳴らす。 */
const clearedEndSound = defineSoundEffect(clearedEndSoundUrl);

const hitofudePuzzleSounds: readonly SoundEffect[] = [
  pathExtendedSound,
  pathShortenedSound,
  blockedSound,
  ...clearedTraceSounds,
  clearedEndSound,
];

/** なぞる長さは道のマスの数で変わるので、なぞる時間を等分して音を並べ、なぞり終えて終点の印を置く時に和音を鳴らす。 */
function createClearedSoundLayers(cellCount: number): SoundLayer[] {
  const traceDurationMs = getClearTraceDurationMs(cellCount);
  const stepMs = traceDurationMs / clearedTraceSounds.length;
  return [
    ...clearedTraceSounds.map(
      function createTraceLayer(sound, index): SoundLayer {
        return { sound, offsetMs: index * stepMs };
      },
    ),
    { sound: clearedEndSound, offsetMs: traceDurationMs },
  ];
}

/** 動きを減らす設定では先端を揺らさないので、×を点けるマスの無い阻まれた操作は画面が変わらない。 */
function isBlockedWithoutVisibleChange(
  notice: Extract<HitofudePuzzlePathNotice, { change: "blocked" }>,
): boolean {
  return notice.cell === null && prefersReducedMotion();
}

function playPathNoticeSound(notice: HitofudePuzzlePathNotice) {
  switch (notice.change) {
    case "extended":
      playSound(pathExtendedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "shortened":
      playSound(pathShortenedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "blocked":
      if (!isBlockedWithoutVisibleChange(notice)) {
        playSound(blockedSound);
      }
      return;
  }
}

/** 動きを減らす設定では、光でなぞらず完成した道と終点の印を出したまま見せるので、終点の和音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedEndSound);
}

/**
 * 道を延ばす・巻き戻す・延ばせなかった操作と、道を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 待った・盤面を戻す・リセットでは鳴らさない。行き止まりや引き直しは、その時の道を延ばす音とは別の音にしない。
 */
export function useHitofudePuzzleSoundEffects(
  pathNotice: HitofudePuzzlePathNotice | null,
  progress: GameProgress,
  pathLength: number,
) {
  usePrepareSoundEffects(hitofudePuzzleSounds);
  useOperationSound(pathNotice, playPathNoticeSound);
  useClearSound(
    progress,
    function playClearSound() {
      playLayeredSound(createClearedSoundLayers(pathLength));
    },
    { playReducedMotionClearSound },
  );
}
