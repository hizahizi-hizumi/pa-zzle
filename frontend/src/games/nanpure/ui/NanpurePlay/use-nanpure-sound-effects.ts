import type { NanpureOperation } from "@/games/nanpure/play/use-nanpure-play";
import { CLEAR_PULSE_MS } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";
import {
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundTone,
} from "@/lib/sound-effects";

/** 鉛筆の先が紙に当たる、高く短い音。 */
const pencilTapTone: SoundTone = {
  waveform: "triangle",
  frequency: 1500,
  endFrequency: 1100,
  durationMs: 40,
  volume: 0.08,
  attackMs: 2,
};

/** 数字を書き込む音。鉛筆の音に、紙の下の机に響く低い音を重ねる。 */
const digitEnteredSound: readonly SoundTone[] = [
  pencilTapTone,
  {
    waveform: "sine",
    frequency: 260,
    endFrequency: 200,
    durationMs: 45,
    volume: 0.035,
    attackMs: 2,
  },
];

/**
 * ミスに数えた数字を書き込む音。書き込む鉛筆の音に、低く丸い音を続ける。
 * 通らない操作より重くするが、ぶつかる音にせず罰に聞こえないようにする。
 */
const mistakeEnteredSound: readonly SoundTone[] = [
  pencilTapTone,
  {
    waveform: "triangle",
    frequency: 330,
    endFrequency: 247,
    offsetMs: 40,
    durationMs: 170,
    volume: 0.07,
    attackMs: 6,
  },
  {
    waveform: "sine",
    frequency: 165,
    endFrequency: 124,
    offsetMs: 40,
    durationMs: 170,
    volume: 0.04,
    attackMs: 6,
  },
];

/** メモを小さく書き込む、数字の入力より軽い鉛筆の音。 */
const noteAddedSound: readonly SoundTone[] = [
  {
    waveform: "triangle",
    frequency: 2200,
    endFrequency: 1700,
    durationMs: 25,
    volume: 0.045,
    attackMs: 2,
  },
];

/** 消しゴムでこする一往復の、低く柔らかい音。 */
const eraserStrokeTone: SoundTone = {
  waveform: "triangle",
  frequency: 700,
  endFrequency: 520,
  durationMs: 45,
  volume: 0.05,
  attackMs: 8,
};

/** メモを消す、消しゴムで一度だけ軽くこする音。 */
const noteRemovedSound: readonly SoundTone[] = [
  { ...eraserStrokeTone, durationMs: 35, volume: 0.035 },
];

/** マスを消す、消しゴムで二度こする音。 */
const erasedSound: readonly SoundTone[] = [
  eraserStrokeTone,
  {
    ...eraserStrokeTone,
    frequency: 600,
    endFrequency: 450,
    offsetMs: 50,
    volume: 0.04,
  },
];

/** 盤面が脈打っていちばん膨らむ時。クリア音の和音をここに着地させる。 */
const CLEAR_PULSE_PEAK_MS = CLEAR_PULSE_MS / 2;
/** 盤面が膨らむまでに上がっていく音。続けて鳴る結果の報酬の音と同じ調にする。 */
const CLEAR_RISING_FREQUENCIES = [783.99, 1046.5, 1318.51];
const CLEAR_RISING_STEP_MS =
  CLEAR_PULSE_PEAK_MS / CLEAR_RISING_FREQUENCIES.length;

/**
 * クリアの、埋まった盤面が脈打つのに合わせた音。上がる音で膨らみへ向かい、膨らみきったところで和音に着地する。
 * 続けて鳴る結果の報酬の音と濁らないよう、高い音域で短く鳴らす。
 */
const clearedSound: readonly SoundTone[] = [
  ...CLEAR_RISING_FREQUENCIES.map(
    function createRisingNote(frequency, index): SoundTone {
      return {
        waveform: "triangle",
        frequency,
        offsetMs: index * CLEAR_RISING_STEP_MS,
        durationMs: 110,
        volume: 0.07,
        attackMs: 4,
      };
    },
  ),
  {
    waveform: "sine",
    frequency: 1046.5,
    offsetMs: CLEAR_PULSE_PEAK_MS,
    durationMs: 420,
    volume: 0.06,
    attackMs: 6,
  },
  {
    waveform: "sine",
    frequency: 1567.98,
    offsetMs: CLEAR_PULSE_PEAK_MS,
    durationMs: 320,
    volume: 0.035,
    attackMs: 6,
  },
];

function playOperationSound(operation: NanpureOperation) {
  switch (operation.type) {
    case "digit-entered":
      playSound(digitEnteredSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "mistake-entered":
      playSound(mistakeEnteredSound);
      return;
    case "note-added":
      playSound(noteAddedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "note-removed":
      playSound(noteRemovedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
    case "erased":
      playSound(erasedSound, { variation: REPEATED_SOUND_VARIATION });
      return;
  }
}

/** 盤面は数字を入れた瞬間から脈打ち始めるので、遅らせずに鳴らす。 */
function playClearSound() {
  playSound(clearedSound);
}

/**
 * 盤面を変えた操作と、盤面を完成させた瞬間に効果音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * マスの選択は、考えながら盤面を見渡すための操作なので鳴らさない。
 */
export function useNanpureSoundEffects(
  operation: NanpureOperation | null,
  progress: GameProgress,
) {
  useOperationSound(operation, playOperationSound);
  useClearSound(progress, playClearSound);
}
