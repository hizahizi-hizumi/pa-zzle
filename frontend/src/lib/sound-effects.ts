/**
 * 効果音を Web Audio API でその場で合成して鳴らす。音声ファイルは使わない。
 * AudioContext は初めて要るときに作り、Web Audio API が無い環境と、鳴らさない設定では何もしない。
 *
 * ゲームは音を `SoundTone` の組として題材から作り、`playSound` で鳴らす。
 * 回数の多い操作の音には `variation: REPEATED_SOUND_VARIATION` を渡し、同じ音の機械的な繰り返しにしない。
 * プレイ画面の操作やクリアに合わせて鳴らすときは、`@/games/play-sound-effects` のフックを使う。
 */

import {
  isSoundEffectsEnabled,
  subscribeSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

/** 効果音を組み立てる一つの音。 */
export type SoundTone = {
  waveform: OscillatorType;
  /** 鳴り始めの周波数（Hz）。 */
  frequency: number;
  /** 鳴り終わりの周波数（Hz）。指定すると鳴っている間に滑らかに移る。 */
  endFrequency?: number;
  /** 効果音を鳴らし始めてから、この音が鳴り始めるまでの時間。 */
  offsetMs?: number;
  /** 鳴り始めてから消えるまでの長さ。 */
  durationMs: number;
  /** いちばん大きいときの音量。0〜1。 */
  volume: number;
  /** 鳴り始めてからいちばん大きくなるまでの時間。 */
  attackMs?: number;
};

/** 鳴らすたびに音を揺らす幅。揺らす量は鳴らすたびに幅の中から選び、一つの効果音の中の音すべてに同じだけ掛ける。 */
export type SoundVariation = {
  /** 音程を上下に揺らす幅（セント。100 セントで半音）。 */
  pitchCents: number;
  /** 音量を揺らす割合。0.1 なら 0.9〜1.1 倍。 */
  volumeRatio: number;
};

/** 回数の多い操作の音に使う、聞き分けられないほど小さな揺らぎ。 */
export const REPEATED_SOUND_VARIATION: SoundVariation = {
  pitchCents: 30,
  volumeRatio: 0.12,
};

type PlaySoundOptions = {
  /** 呼んでから鳴らし始めるまでの時間。 */
  delayMs?: number;
  /** 鳴らすたびに音程と音量をわずかに揺らす。省略すると毎回同じ音で鳴らす。 */
  variation?: SoundVariation;
};

type SoundOutput = {
  context: AudioContext;
  /** 全ての音が通る出口。鳴らさない設定に切り替えたら、鳴っている音もここで消す。 */
  master: GainNode;
};

const DEFAULT_ATTACK_MS = 4;
/** 指数的に消すときの行き先。0 には指数的に近づけないため、聞こえない小ささで止める。 */
const SILENT_GAIN = 0.0001;
/** 消し終わってから発振を止めるまでの余り。止める瞬間の音切れを避ける。 */
const STOP_MARGIN_SEC = 0.02;
/** 鳴っていない AudioContext を動かせる操作。 */
const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown"];
/** 鳴らさない設定に切り替えたとき、鳴っている音を消す速さ。急に切って音が割れないよう、わずかに時間を掛ける。 */
const MUTE_TIME_CONSTANT_SEC = 0.02;
/**
 * 速い連打で音が重なったときだけ効く、出口の圧縮。一つの効果音の大きさ（音量の和が 0.2 程度まで）には掛からないようにする。
 * 値は DynamicsCompressorNode の単位（dB・比・秒）。
 */
const OUTPUT_COMPRESSION = {
  threshold: -10,
  knee: 6,
  ratio: 4,
  attack: 0.003,
  release: 0.15,
} as const;

let soundOutput: SoundOutput | null = null;
let unlockListening = false;

function getAudioContextClass(): typeof AudioContext | undefined {
  return typeof window === "undefined" ? undefined : window.AudioContext;
}

function getSoundOutput(): SoundOutput | null {
  if (soundOutput) {
    return soundOutput;
  }
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  preferAmbientAudioSession();
  const context = new AudioContextClass();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = OUTPUT_COMPRESSION.threshold;
  compressor.knee.value = OUTPUT_COMPRESSION.knee;
  compressor.ratio.value = OUTPUT_COMPRESSION.ratio;
  compressor.attack.value = OUTPUT_COMPRESSION.attack;
  compressor.release.value = OUTPUT_COMPRESSION.release;
  master.connect(compressor);
  compressor.connect(context.destination);

  soundOutput = { context, master };
  subscribeSoundEffectsEnabled(applySoundEffectsEnabled);
  return soundOutput;
}

/** 鳴らさない設定に切り替えたら鳴っている音も出口で消し、鳴らす設定に戻したら出口を開ける。 */
function applySoundEffectsEnabled() {
  if (!soundOutput) {
    return;
  }
  const { context, master } = soundOutput;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  if (isSoundEffectsEnabled()) {
    master.gain.setValueAtTime(1, now);
  } else {
    master.gain.setTargetAtTime(0, now, MUTE_TIME_CONSTANT_SEC);
  }
}

/**
 * 対応するブラウザで、効果音を他のアプリの音楽を止めない音として扱わせる。
 * 端末の消音設定にも従う。
 */
function preferAmbientAudioSession() {
  const audioSession = (
    navigator as Navigator & { audioSession?: { type: string } }
  ).audioSession;
  if (audioSession) {
    audioSession.type = "ambient";
  }
}

function resumeAudioContext(context: AudioContext) {
  if (context.state !== "running") {
    context.resume().catch(function ignoreRejectedResume() {});
  }
}

function unlockOnUserGesture() {
  if (!isSoundEffectsEnabled()) {
    return;
  }
  const output = getSoundOutput();
  if (!output) {
    stopListeningForUnlock();
    return;
  }

  resumeAudioContext(output.context);
  if (output.context.state === "running") {
    stopListeningForUnlock();
  }
}

function stopListeningForUnlock() {
  for (const type of UNLOCK_EVENTS) {
    window.removeEventListener(type, unlockOnUserGesture, true);
  }
  unlockListening = false;
}

/**
 * ブラウザは利用者が操作するまで音を出させないため、次の操作で AudioContext を作り動かせるよう待つ。
 * 効果音を鳴らしうる画面を出したときに呼ぶ。何度呼んでもよい。
 */
export function prepareSoundEffects(): void {
  if (unlockListening || !getAudioContextClass()) {
    return;
  }
  if (soundOutput?.context.state === "running") {
    return;
  }

  unlockListening = true;
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlockOnUserGesture, true);
  }
}

/**
 * `tones` を重ねて一つの効果音として鳴らす。鳴らせない環境と、鳴らさない設定では何もしない。
 * 鳴らさない設定の間は AudioContext も作らない。
 */
export function playSound(
  tones: readonly SoundTone[],
  { delayMs = 0, variation }: PlaySoundOptions = {},
): void {
  if (!isSoundEffectsEnabled() || tones.length === 0) {
    return;
  }
  const output = getSoundOutput();
  if (!output) {
    return;
  }

  resumeAudioContext(output.context);
  const startTime = output.context.currentTime + delayMs / 1000;
  const scale = variation ? pickVariationScale(variation) : NO_VARIATION_SCALE;
  for (const tone of tones) {
    scheduleTone(output, scaleTone(tone, scale), startTime);
  }
}

type VariationScale = {
  frequency: number;
  volume: number;
};

const NO_VARIATION_SCALE: VariationScale = { frequency: 1, volume: 1 };

function pickVariationScale({
  pitchCents,
  volumeRatio,
}: SoundVariation): VariationScale {
  const cents = pitchCents * pickSignedUnit();
  return {
    frequency: 2 ** (cents / 1200),
    volume: 1 + volumeRatio * pickSignedUnit(),
  };
}

/** -1 以上 1 未満の一様な乱数。 */
function pickSignedUnit(): number {
  return Math.random() * 2 - 1;
}

function scaleTone(tone: SoundTone, scale: VariationScale): SoundTone {
  return scale === NO_VARIATION_SCALE
    ? tone
    : {
        ...tone,
        frequency: tone.frequency * scale.frequency,
        endFrequency:
          tone.endFrequency === undefined
            ? undefined
            : tone.endFrequency * scale.frequency,
        volume: tone.volume * scale.volume,
      };
}

function scheduleTone(
  { context, master }: SoundOutput,
  {
    waveform,
    frequency,
    endFrequency,
    offsetMs = 0,
    durationMs,
    volume,
    attackMs = DEFAULT_ATTACK_MS,
  }: SoundTone,
  soundStartTime: number,
) {
  const startTime = soundStartTime + offsetMs / 1000;
  const peakTime = startTime + Math.min(attackMs, durationMs) / 1000;
  const endTime = startTime + durationMs / 1000;

  const oscillator = context.createOscillator();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
  }

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, startTime);
  envelope.gain.linearRampToValueAtTime(volume, peakTime);
  envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, endTime);

  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.addEventListener("ended", function disconnect() {
    oscillator.disconnect();
    envelope.disconnect();
  });
  oscillator.start(startTime);
  oscillator.stop(endTime + STOP_MARGIN_SEC);
}
