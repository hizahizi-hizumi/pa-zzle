import clearedSoundUrl from "@/games/minesweeper/assets/sounds/cleared.flac";
import flagPlacedSoundUrl from "@/games/minesweeper/assets/sounds/flag-placed.flac";
import flagRemovedSoundUrl from "@/games/minesweeper/assets/sounds/flag-removed.flac";
import mineSteppedSoundUrl from "@/games/minesweeper/assets/sounds/mine-stepped.flac";
import openingTick1SoundUrl from "@/games/minesweeper/assets/sounds/opening-tick-1.flac";
import openingTick2SoundUrl from "@/games/minesweeper/assets/sounds/opening-tick-2.flac";
import openingTick3SoundUrl from "@/games/minesweeper/assets/sounds/opening-tick-3.flac";
import openingTick4SoundUrl from "@/games/minesweeper/assets/sounds/opening-tick-4.flac";
import type { MinesweeperOperation } from "@/games/minesweeper/play/use-minesweeper-play";
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

/**
 * マスをめくる、軽く乾いた音の粒。1粒目が押したマスで、一度に多く開くほど続く粒を足す。
 * 続く粒ほど小さく、全部鳴らしても1つの効果音の大きさに収まる。
 */
const openingTickSounds = [
  openingTick1SoundUrl,
  openingTick2SoundUrl,
  openingTick3SoundUrl,
  openingTick4SoundUrl,
].map(defineSoundEffect);
/** 続く粒を鳴らし始める間隔。 */
const OPENING_TICK_STEP_MS = 28;

/** 粒を1つずつ足す、一度に開いたマスの数の下限。同じ瞬間に盤面で多く開いて見える分だけ音を豊かにする。 */
const OPENING_TICK_THRESHOLDS = [1, 2, 6, 16] as const;

function getOpeningSoundLayers(openedCellCount: number): SoundLayer[] {
  const tickCount = OPENING_TICK_THRESHOLDS.filter(
    (threshold) => openedCellCount >= threshold,
  ).length;
  return openingTickSounds
    .slice(0, Math.max(1, tickCount))
    .map(function createTickLayer(sound, index) {
      return { sound, offsetMs: index * OPENING_TICK_STEP_MS };
    });
}

/** 旗を立てる、上がる短い音。 */
const flagPlacedSound = defineSoundEffect(flagPlacedSoundUrl);

/** 旗を外す、下がる控えめな音。 */
const flagRemovedSound = defineSoundEffect(flagRemovedSoundUrl);

/**
 * 地雷を踏んだ、こもった低い音。ミスとして数えるので不成立より重いが、プレイは続くので爆発のようにはしていない。
 * 一度に踏んだ数によらず同じ音で鳴らす。
 */
const mineSteppedSound = defineSoundEffect(mineSteppedSoundUrl);

/**
 * クリアの、盤面が脈打つのに合わせて下から開いていく和音。脈打ち終わるときに消える。
 * 続けて鳴る結果の報酬の音と濁らないよう、短く、同じ調の音で鳴る。
 */
const clearedSound = defineSoundEffect(clearedSoundUrl);

const minesweeperSounds: readonly SoundEffect[] = [
  ...openingTickSounds,
  flagPlacedSound,
  flagRemovedSound,
  mineSteppedSound,
  clearedSound,
];

function playOperationSound(operation: MinesweeperOperation) {
  switch (operation.type) {
    case "cells-opened":
      playLayeredSound(getOpeningSoundLayers(operation.openedCellCount), {
        variation: REPEATED_SOUND_VARIATION,
      });
      return;
    case "mine-stepped":
      playSound(mineSteppedSound);
      return;
    case "flag-placed":
      playSound(flagPlacedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "flag-removed":
      playSound(flagRemovedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

function playClearSound() {
  playSound(clearedSound);
}

/** プレイ中の操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。 */
export function useMinesweeperSoundEffects(
  operation: MinesweeperOperation | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(minesweeperSounds);
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
