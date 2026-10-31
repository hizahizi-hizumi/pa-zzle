/**
 * 効果音を Web Audio API でその場で合成して鳴らす。音声ファイルは使わない。
 * AudioContext は初めて要るときに作り、Web Audio API が無い環境では何もしない。
 */

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

type PlaySoundOptions = {
  /** 呼んでから鳴らし始めるまでの時間。 */
  delayMs?: number;
};

const DEFAULT_ATTACK_MS = 4;
/** 指数的に消すときの行き先。0 には指数的に近づけないため、聞こえない小ささで止める。 */
const SILENT_GAIN = 0.0001;
/** 消し終わってから発振を止めるまでの余り。止める瞬間の音切れを避ける。 */
const STOP_MARGIN_SEC = 0.02;
/** 鳴っていない AudioContext を動かせる操作。 */
const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown"];

let enabled = true;
let audioContext: AudioContext | null = null;
let unlockListening = false;

function getAudioContextClass(): typeof AudioContext | undefined {
  return typeof window === "undefined" ? undefined : window.AudioContext;
}

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  preferAmbientAudioSession();
  audioContext = new AudioContextClass();
  return audioContext;
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
  if (!enabled) {
    return;
  }
  const context = getAudioContext();
  if (!context) {
    stopListeningForUnlock();
    return;
  }

  resumeAudioContext(context);
  if (context.state === "running") {
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
  if (audioContext?.state === "running") {
    return;
  }

  unlockListening = true;
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlockOnUserGesture, true);
  }
}

/** 効果音を鳴らすかどうかを切り替える。鳴らさない間は AudioContext も作らない。 */
export function setSoundEffectsEnabled(next: boolean): void {
  enabled = next;
}

/** `tones` を重ねて一つの効果音として鳴らす。鳴らせない環境と、鳴らさない設定では何もしない。 */
export function playSound(
  tones: readonly SoundTone[],
  { delayMs = 0 }: PlaySoundOptions = {},
): void {
  if (!enabled || tones.length === 0) {
    return;
  }
  const context = getAudioContext();
  if (!context) {
    return;
  }

  resumeAudioContext(context);
  const startTime = context.currentTime + delayMs / 1000;
  for (const tone of tones) {
    scheduleTone(context, tone, startTime);
  }
}

function scheduleTone(
  context: AudioContext,
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
  envelope.connect(context.destination);
  oscillator.addEventListener("ended", function disconnect() {
    oscillator.disconnect();
    envelope.disconnect();
  });
  oscillator.start(startTime);
  oscillator.stop(endTime + STOP_MARGIN_SEC);
}
