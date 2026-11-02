import blockedSoundUrl from "@/games/bridges/assets/sounds/blocked.flac";
import bridgeDoubledSoundUrl from "@/games/bridges/assets/sounds/bridge-doubled.flac";
import bridgePlacedSoundUrl from "@/games/bridges/assets/sounds/bridge-placed.flac";
import bridgeRemovedSoundUrl from "@/games/bridges/assets/sounds/bridge-removed.flac";
import clearedEndSoundUrl from "@/games/bridges/assets/sounds/cleared-end.flac";
import clearedWave1SoundUrl from "@/games/bridges/assets/sounds/cleared-wave-1.flac";
import clearedWave2SoundUrl from "@/games/bridges/assets/sounds/cleared-wave-2.flac";
import clearedWave3SoundUrl from "@/games/bridges/assets/sounds/cleared-wave-3.flac";
import clearedWave4SoundUrl from "@/games/bridges/assets/sounds/cleared-wave-4.flac";
import clearedWave5SoundUrl from "@/games/bridges/assets/sounds/cleared-wave-5.flac";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { getClearWaveTiming } from "@/games/bridges/ui/board/BridgesBoard/play-clear-wave";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

/** 1本目の橋を架ける、板を渡して置く乾いた木の音。 */
const bridgePlacedSound = defineSoundEffect(bridgePlacedSoundUrl);
/** 2本目の橋を重ねる、1本目より少し高く、板を2枚続けて置く木の音。 */
const bridgeDoubledSound = defineSoundEffect(bridgeDoubledSoundUrl);
/** 橋を外す、架ける音より小さく下がる木の音。 */
const bridgeRemovedSound = defineSoundEffect(bridgeRemovedSoundUrl);
/** 交わる橋に阻まれた、板が突き当たる柔らかく低い音。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/** 島から島へ渡る波に合わせて、順に鳴らす上がっていく木琴の音。 */
const clearedWaveSounds = [
  clearedWave1SoundUrl,
  clearedWave2SoundUrl,
  clearedWave3SoundUrl,
  clearedWave4SoundUrl,
  clearedWave5SoundUrl,
].map(defineSoundEffect);

/** 波が最後の島に届いたときの和音。続けて鳴る結果の報酬の音と同じ調の音で鳴らす。 */
const clearedEndSound = defineSoundEffect(clearedEndSoundUrl);

const bridgesSounds: readonly SoundEffect[] = [
  bridgePlacedSound,
  bridgeDoubledSound,
  bridgeRemovedSound,
  blockedSound,
  ...clearedWaveSounds,
  clearedEndSound,
];

const bridgeCountSounds = {
  0: bridgeRemovedSound,
  1: bridgePlacedSound,
  2: bridgeDoubledSound,
} as const satisfies Record<BridgeCount, SoundEffect>;

/** 波が渡る時間は盤面の橋のつながりで変わるので、最後の島が膨らみ始めるまでを等分して音を並べ、最も膨らむ時に和音を鳴らす。 */
function createClearedSoundLayers(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
): SoundLayer[] {
  const { lastPopStartMs, lastPopPeakMs } = getClearWaveTiming(board, bridges);
  const stepMs = lastPopStartMs / clearedWaveSounds.length;
  return [
    ...clearedWaveSounds.map(
      function createWaveLayer(sound, index): SoundLayer {
        return { sound, offsetMs: index * stepMs };
      },
    ),
    { sound: clearedEndSound, offsetMs: lastPopPeakMs },
  ];
}

function playEdgeNoticeSound(notice: BridgesEdgeNotice) {
  switch (notice.change) {
    case "changed":
      playSound(bridgeCountSounds[notice.count], {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "blocked":
      playSound(blockedSound);
      return;
    case "undone":
      return;
  }
}

/** 動きを減らす設定では、波を渡さず完成した盤面をそのまま見せるので、和音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedEndSound);
}

/**
 * 橋を架ける・重ねる・外す・交わる橋に阻まれた操作と、全島がつながった瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 待った・盤面を戻す・リセットでは鳴らさない。阻まれた操作は動きを減らす設定でも阻んだ橋を点けて見せるので鳴らす。
 */
export function useBridgesSoundEffects(
  edgeNotice: BridgesEdgeNotice | null,
  progress: GameProgress,
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
) {
  usePrepareSoundEffects(bridgesSounds);
  useOperationSound(edgeNotice, playEdgeNoticeSound);
  useClearSound(
    progress,
    function playClearSound() {
      playLayeredSound(createClearedSoundLayers(board, bridges));
    },
    { playReducedMotionClearSound },
  );
}
