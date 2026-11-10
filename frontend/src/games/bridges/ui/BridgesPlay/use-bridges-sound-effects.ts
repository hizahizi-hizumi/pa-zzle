import blockedSoundUrl from "@/games/bridges/assets/sounds/blocked.flac";
import bridgeDoubledSoundUrl from "@/games/bridges/assets/sounds/bridge-doubled.flac";
import bridgePlacedSoundUrl from "@/games/bridges/assets/sounds/bridge-placed.flac";
import bridgeRemovedSoundUrl from "@/games/bridges/assets/sounds/bridge-removed.flac";
import clearedChordSoundUrl from "@/games/bridges/assets/sounds/cleared-chord.flac";
import clearedLight1SoundUrl from "@/games/bridges/assets/sounds/cleared-light-1.flac";
import clearedLight2SoundUrl from "@/games/bridges/assets/sounds/cleared-light-2.flac";
import clearedLight3SoundUrl from "@/games/bridges/assets/sounds/cleared-light-3.flac";
import clearedLight4SoundUrl from "@/games/bridges/assets/sounds/cleared-light-4.flac";
import clearedLight5SoundUrl from "@/games/bridges/assets/sounds/cleared-light-5.flac";
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

/**
 * 架ける・外す音は、盤面で最も回数の多い操作の音なので、ほかのゲームの最も回数の多い操作の音（一筆の道を伸ばす、ナンプレの数字を入れる、
 * マインスイーパーの旗を立てる）と同じ小ささと短さ（50ms 窓の最大 RMS −37dB 前後、−40dB までの長さ 0.03〜0.04 秒）にそろえる。
 */
/** 1本目の板が相手の島に着く、乾いた木の音。 */
const bridgePlacedSound = defineSoundEffect(bridgePlacedSoundUrl);
/** 2本目の板が着く、1本目より少し高く2枚続けて置く木の音。明るさ（音の重心）は1本目の 1.2 倍ほどに抑える。 */
const bridgeDoubledSound = defineSoundEffect(bridgeDoubledSoundUrl);
/** 橋を外す、架ける音より小さく下がる木の音。 */
const bridgeRemovedSound = defineSoundEffect(bridgeRemovedSoundUrl);
/** 交わる橋に阻まれた、板が突き当たる鈍い木の音。ほかのゲームの阻まれた音と同じ小ささにする。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/**
 * 島が灯る段ごとに、五音音階を1つずつ上がって鳴らす短いブイの鐘に、水面に落ちる水滴を重ねた音。段の多い盤面でも、この数を上限に間引いて鳴らす。
 * 続く鐘と重なって濁らないよう、次の鐘が鳴る頃には減り切る短さにする。
 */
const clearedLightSounds = [
  clearedLight1SoundUrl,
  clearedLight2SoundUrl,
  clearedLight3SoundUrl,
  clearedLight4SoundUrl,
  clearedLight5SoundUrl,
].map(defineSoundEffect);

/**
 * 全島が灯り切ったときの、ド・ミ・ソの鐘の和音に水面のきらめきを重ねた音。続けて鳴る結果の報酬の音と同じ調で鳴らす。
 * 灯りの音と合わせた長さと大きさを、ほかのゲームの完成の音（重ねた全体で 1.3〜1.8 秒、ピーク −18.5〜−19.5dBFS）にそろえる。
 */
const clearedChordSound = defineSoundEffect(clearedChordSoundUrl);

const bridgesSounds: readonly SoundEffect[] = [
  bridgePlacedSound,
  bridgeDoubledSound,
  bridgeRemovedSound,
  blockedSound,
  ...clearedLightSounds,
  clearedChordSound,
];

const bridgeLandingSounds = {
  1: bridgePlacedSound,
  2: bridgeDoubledSound,
} as const satisfies Record<Exclude<BridgeCount, 0>, SoundEffect>;

/**
 * 島が灯る段の時間に、上がっていく音を並べる。段が音の数より多ければ、最初と最後の段を含めて等間隔に選んだ段で鳴らす。
 * 最後の島が灯り切る時に和音を鳴らす。
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
    { sound: clearedChordSound, offsetMs: seaLitMs },
  ];
}

/**
 * 橋を回した音。架けたときは、板が相手の島に着く時に木の音を1つだけ鳴らす。
 * 板の渡る時間は辺の長さで変わるので、盤面の板の動きと同じ時間（`getBridgeExtendMs`）で着かせる。
 * 動きを減らす設定では板が渡らずすぐ置かれるので、着く音をすぐ鳴らす。
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
  return [{ sound: landing, offsetMs: getBridgeExtendMs(board, edge) }];
}

/** 動きを減らす設定では、灯りを渡さず灯った盤面をそのまま見せるので、和音だけを鳴らす。 */
function playReducedMotionClearSound() {
  playSound(clearedChordSound);
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
