import type { MinesweeperOperation } from "@/games/minesweeper/play/use-minesweeper-play";
import { CLEAR_PULSE_MS } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/**
 * マスをめくる、軽く乾いた音の粒。1粒目が押したマスで、一度に多く開くほど続く粒を足す。
 * 続く粒ほど小さくし、全部鳴らしても1つの効果音の大きさに収める。
 */
const OPENING_TICKS: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 620,
    endFrequency: 420,
    durationMs: 45,
    volume: 0.09,
    attackMs: 2,
  },
  {
    waveform: "triangle",
    frequency: 740,
    endFrequency: 500,
    offsetMs: 28,
    durationMs: 40,
    volume: 0.05,
    attackMs: 2,
  },
  {
    waveform: "triangle",
    frequency: 680,
    endFrequency: 460,
    offsetMs: 56,
    durationMs: 40,
    volume: 0.035,
    attackMs: 2,
  },
  {
    waveform: "triangle",
    frequency: 800,
    endFrequency: 540,
    offsetMs: 84,
    durationMs: 40,
    volume: 0.025,
    attackMs: 2,
  },
];

/** 粒を1つずつ足す、一度に開いたマスの数の下限。同じ瞬間に盤面で多く開いて見える分だけ音を豊かにする。 */
const OPENING_TICK_THRESHOLDS = [1, 2, 6, 16] as const;

function getOpeningSound(openedCellCount: number): readonly SoundTone[] {
  const tickCount = OPENING_TICK_THRESHOLDS.filter(
    (threshold) => openedCellCount >= threshold,
  ).length;
  return OPENING_TICKS.slice(0, Math.max(1, tickCount));
}

/** 旗を立てる、上がる短い音。 */
const flagPlacedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 980,
    endFrequency: 1470,
    durationMs: 55,
    volume: 0.08,
  },
];

/** 旗を外す、下がる控えめな音。 */
const flagRemovedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 1470,
    endFrequency: 980,
    durationMs: 50,
    volume: 0.06,
  },
];

/**
 * 地雷を踏んだ、こもった低い音。ミスとして数えるので不成立より重くするが、プレイは続くので爆発のようにはしない。
 * 一度に踏んだ数によらず同じ音にする。
 */
const mineSteppedSound: readonly SoundTone[] = [
  {
    waveform: "sine",
    frequency: 150,
    endFrequency: 55,
    durationMs: 260,
    volume: 0.13,
    attackMs: 4,
  },
  {
    waveform: "triangle",
    frequency: 320,
    endFrequency: 110,
    durationMs: 90,
    volume: 0.045,
    attackMs: 3,
  },
];

const CLEAR_CHORD_STEP_MS = 70;
const CLEAR_CHORD_NOTES = [
  { frequency: 523.25, volume: 0.06 },
  { frequency: 659.25, volume: 0.05 },
  { frequency: 783.99, volume: 0.05 },
  { frequency: 1046.5, volume: 0.03 },
] as const;

/**
 * クリアの、盤面が脈打つのに合わせて下から開いていく和音。脈打ち終わるときに消える。
 * 続けて鳴る結果の報酬の音と濁らないよう、短くし、同じ調の音で鳴らす。
 */
const clearedSound: readonly SoundTone[] = CLEAR_CHORD_NOTES.map(
  function createChordTone({ frequency, volume }, index): SoundTone {
    const offsetMs = index * CLEAR_CHORD_STEP_MS;
    return {
      waveform: "sine",
      frequency,
      offsetMs,
      durationMs: CLEAR_PULSE_MS - offsetMs,
      volume,
      attackMs: 30,
    };
  },
);

function playOperationSound(operation: MinesweeperOperation) {
  switch (operation.type) {
    case "cells-opened":
      playSound(getOpeningSound(operation.openedCellCount), {
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
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
