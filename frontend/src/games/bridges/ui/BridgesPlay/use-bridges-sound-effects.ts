import blockedSoundUrl from "@/games/bridges/assets/sounds/blocked.flac";
import bridgeDoubledSoundUrl from "@/games/bridges/assets/sounds/bridge-doubled.flac";
import bridgePlacedSoundUrl from "@/games/bridges/assets/sounds/bridge-placed.flac";
import bridgeRemovedSoundUrl from "@/games/bridges/assets/sounds/bridge-removed.flac";
import bridgeSlideSoundUrl from "@/games/bridges/assets/sounds/bridge-slide.flac";
import clearedLight1SoundUrl from "@/games/bridges/assets/sounds/cleared-light-1.flac";
import clearedLight2SoundUrl from "@/games/bridges/assets/sounds/cleared-light-2.flac";
import clearedLight3SoundUrl from "@/games/bridges/assets/sounds/cleared-light-3.flac";
import clearedLight4SoundUrl from "@/games/bridges/assets/sounds/cleared-light-4.flac";
import clearedLight5SoundUrl from "@/games/bridges/assets/sounds/cleared-light-5.flac";
import clearedLight6SoundUrl from "@/games/bridges/assets/sounds/cleared-light-6.flac";
import clearedLight7SoundUrl from "@/games/bridges/assets/sounds/cleared-light-7.flac";
import clearedSeaSoundUrl from "@/games/bridges/assets/sounds/cleared-sea.flac";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";
import { getClearWaveTiming } from "@/games/bridges/ui/board/clear-wave";
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

/** 板を島から渡し始める、柔らかい木の擦れ。板が渡っている間に細って消える。 */
const bridgeSlideSound = defineSoundEffect(bridgeSlideSoundUrl);
/** 1本目の板が相手の島に着く、乾いた木の音。 */
const bridgePlacedSound = defineSoundEffect(bridgePlacedSoundUrl);
/** 2本目の板が着く、1本目より少し高く2枚続けて置く木の音。明るさ（音の重心）は1本目の 1.2 倍ほどに抑える。 */
const bridgeDoubledSound = defineSoundEffect(bridgeDoubledSoundUrl);
/** 橋を外す、架ける音より小さく下がる木の音。 */
const bridgeRemovedSound = defineSoundEffect(bridgeRemovedSoundUrl);
/** 交わる橋に阻まれた、板が突き当たる柔らかく低い音。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/** 島が灯る段ごとに、五音音階を1つずつ上がって鳴らす木琴の音。段の多い盤面でも、この数を上限に間引いて鳴らす。 */
const clearedLightSounds = [
  clearedLight1SoundUrl,
  clearedLight2SoundUrl,
  clearedLight3SoundUrl,
  clearedLight4SoundUrl,
  clearedLight5SoundUrl,
  clearedLight6SoundUrl,
  clearedLight7SoundUrl,
].map(defineSoundEffect);

/** 全島が灯り切って海が明るくなるときの、水のきらめきと寄せる波を重ねた和音。続けて鳴る結果の報酬の音と同じ調で鳴らす。 */
const clearedSeaSound = defineSoundEffect(clearedSeaSoundUrl);

const bridgesSounds: readonly SoundEffect[] = [
  bridgeSlideSound,
  bridgePlacedSound,
  bridgeDoubledSound,
  bridgeRemovedSound,
  blockedSound,
  ...clearedLightSounds,
  clearedSeaSound,
];

const bridgeLandingSounds = {
  1: bridgePlacedSound,
  2: bridgeDoubledSound,
} as const satisfies Record<Exclude<BridgeCount, 0>, SoundEffect>;

/**
 * 島が灯る段の時間に、上がっていく音を並べる。段が音の数より多ければ、最初と最後の段を含めて等間隔に選んだ段で鳴らす。
 * 最後の島が灯り切り、海が明るくなる時に海の音を鳴らす。
 */
export function createClearedSoundLayers(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
): SoundLayer[] {
  const { depthStartMs, seaLitMs } = getClearWaveTiming(board, bridges);
  const noteCount = Math.min(depthStartMs.length, clearedLightSounds.length);
  const lastDepth = depthStartMs.length - 1;
  return [
    ...clearedLightSounds
      .slice(0, noteCount)
      .map(function createLightLayer(sound, note): SoundLayer {
        const depth =
          noteCount === 1
            ? 0
            : Math.round((note * lastDepth) / (noteCount - 1));
        return { sound, offsetMs: depthStartMs[depth]! };
      }),
    { sound: clearedSeaSound, offsetMs: seaLitMs },
  ];
}

/**
 * 橋を回した音。架けたときは、板が渡り始める擦れをすぐ鳴らし、板が相手の島に着く時に木の音を鳴らす。
 * 板の渡る時間は辺の長さで変わるので、盤面の板の動きと同じ時間（`getBridgeExtendMs`）で着かせる。
 * 動きを減らす設定では板が渡らずすぐ置かれるので、着く音だけをすぐ鳴らす。
 */
export function createBridgeSoundLayers(
  board: BridgesBoard,
  edge: number,
  count: BridgeCount,
): SoundLayer[] {
  if (count === 0) {
    return [{ sound: bridgeRemovedSound, offsetMs: 0 }];
  }
  const landing = bridgeLandingSounds[count];
  if (prefersReducedMotion()) {
    return [{ sound: landing, offsetMs: 0 }];
  }
  return [
    { sound: bridgeSlideSound, offsetMs: 0 },
    {
      sound: landing,
      offsetMs: getBridgeExtendMs(board, edge),
    },
  ];
}

/** 動きを減らす設定では、灯りを渡さず灯った盤面をそのまま見せるので、海の音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedSeaSound);
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
  useOperationSound(edgeNotice, function playEdgeNoticeSound(notice) {
    switch (notice.change) {
      case "changed":
        playLayeredSound(
          createBridgeSoundLayers(board, notice.edge, notice.count),
          { variation: REPEATED_SOUND_VARIATION },
        );
        return;
      case "blocked":
        playSound(blockedSound);
        return;
      case "undone":
        return;
    }
  });
  useClearSound(
    progress,
    function playClearSound() {
      playLayeredSound(createClearedSoundLayers(board, bridges));
    },
    { playReducedMotionClearSound },
  );
}
