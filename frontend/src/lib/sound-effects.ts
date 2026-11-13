import {
  canPlayAudio,
  decodeAudioFile,
  getAudioContext,
  getAudioOutput,
  requestAudioContextUnlock,
  resumeAudioContext,
} from "@/lib/audio-context";
import {
  isSoundEffectsEnabled,
  soundEffectsVolumeSetting,
} from "@/lib/sound-effects-setting";
import { getVolumeGain } from "@/lib/stored-volume-setting";

export type SoundEffect = {
  readonly url: string;
};

export type SoundLayer = {
  sound: SoundEffect;
  offsetMs: number;
};

export type SoundVariation = {
  /** 再生の速さで揺らすので、長さもわずかに変わる。 */
  pitchCents: number;
  volumeRatio: number;
};

/** 聞き分けられないほど小さな揺らぎ。 */
export const REPEATED_SOUND_VARIATION: SoundVariation = {
  pitchCents: 30,
  volumeRatio: 0.12,
};

type PlaySoundOptions = {
  delayMs?: number;
  variation?: SoundVariation;
  playbackRate?: number;
  volume?: number;
};

type SoundOutput = {
  context: AudioContext;
  master: GainNode;
};

/**
 * 音量が最大のときに出口で掛ける大きさ。初期の音量では約 0.54 倍（-5.4 dB）になり、
 * 最後の出口の持ち上げ（`@/lib/audio-context`）と合わせて音声ファイルとほぼ同じ大きさで鳴らす。
 * BGM（`@/lib/background-music`）とは初期の音量どうしで約 20 dB 差になり、遊ぶゲームを選ぶ・プレイを始める音は、
 * ホームの曲が大きい箇所でも、その音が鳴る帯域で曲より 10 dB 以上大きく聞こえる。
 * 音量が最大のときは大きい効果音に最後の出口の圧縮が掛かり、音が割れないようにする。
 */
const SOUND_EFFECTS_MAX_GAIN = 2.16;
/** 急に変えて音にノイズが乗らないよう、音量を変えたときにわずかに時間を掛ける。 */
const VOLUME_CHANGE_TIME_CONSTANT_SEC = 0.02;

let soundOutput: SoundOutput | null = null;
/**
 * 読み込みを頼まれた音声ファイルの URL と、その読み込みが済む（読み込めたか失敗した）まで待つ Promise。
 * 音量が 0 の間に頼まれたものは、Promise を持たない。読み込みに失敗したら外して読み直せるようにする。
 */
const requestedSoundLoads = new Map<string, Promise<void> | null>();
const soundBuffers = new Map<string, AudioBuffer>();
const soundUrlsWaitingForEnabled = new Set<string>();
let waitingForEnabled = false;

function getSoundEffectsGain(): number {
  return getVolumeGain(
    soundEffectsVolumeSetting.getVolume(),
    SOUND_EFFECTS_MAX_GAIN,
  );
}

/** 読み込みは `prepareSoundEffects` で始める。 */
export function defineSoundEffect(url: string): SoundEffect {
  return { url };
}

/** 効果音を鳴らしうる画面を出したときに、その画面で鳴らす効果音を渡して呼ぶ。何度呼んでもよい。 */
export function prepareSoundEffects(sounds: readonly SoundEffect[]): void {
  if (!canPlayAudio()) {
    return;
  }
  // 渡した効果音の読み込みを始め、鳴らすときに待たせないようにする。
  requestSoundEffects(sounds);
  // ブラウザは利用者が操作するまで音を出させないため、次の操作で AudioContext を作り動かせるよう待つ。
  requestAudioContextUnlock(isSoundEffectsEnabled);
}

/** 読み込みが済んだ（読み込めたか失敗した）数が増えるたびに `onProgress` へ、済んだ割合（0〜1）を渡す。 */
export async function loadSoundEffects(
  sounds: readonly SoundEffect[],
  onProgress?: (progress: number) => void,
): Promise<void> {
  prepareSoundEffects(sounds);
  const loads = sounds.flatMap(({ url }) => requestedSoundLoads.get(url) ?? []);
  let settledCount = 0;
  await Promise.all(
    loads.map(async function reportSettled(load) {
      await load;
      settledCount += 1;
      onProgress?.(settledCount / loads.length);
    }),
  );
}

function requestSoundEffects(sounds: readonly SoundEffect[]) {
  for (const { url } of sounds) {
    if (requestedSoundLoads.get(url)) {
      continue;
    }
    if (isSoundEffectsEnabled()) {
      soundUrlsWaitingForEnabled.delete(url);
      requestedSoundLoads.set(url, loadSoundEffect(url));
    } else if (!requestedSoundLoads.has(url)) {
      requestedSoundLoads.set(url, null);
      waitForEnabledToLoad(url);
    }
  }
}

function waitForEnabledToLoad(url: string) {
  soundUrlsWaitingForEnabled.add(url);
  if (waitingForEnabled) {
    return;
  }
  waitingForEnabled = true;
  const unsubscribe = soundEffectsVolumeSetting.subscribe(
    function loadWaitingSoundsWhenEnabled() {
      if (!isSoundEffectsEnabled()) {
        return;
      }
      unsubscribe();
      waitingForEnabled = false;
      for (const waitingUrl of soundUrlsWaitingForEnabled) {
        requestedSoundLoads.set(waitingUrl, loadSoundEffect(waitingUrl));
      }
      soundUrlsWaitingForEnabled.clear();
    },
  );
}

function loadSoundEffect(url: string): Promise<void> | null {
  const decoding = decodeAudioFile(url);
  if (!decoding) {
    return null;
  }
  return decoding.then(
    function keepDecodedSound(buffer) {
      soundBuffers.set(url, buffer);
    },
    function forgetFailedRequest(error: unknown) {
      requestedSoundLoads.delete(url);
      // 効果音は操作に添えるものなので、失敗を利用者に知らせず、遊ぶのを妨げない。
      if (import.meta.env.DEV) {
        console.warn(`効果音を読み込めない: ${url}`, error);
      }
    },
  );
}

function getSoundOutput(): SoundOutput | null {
  if (soundOutput) {
    return soundOutput;
  }
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  const master = context.createGain();
  master.gain.value = getSoundEffectsGain();
  master.connect(getAudioOutput(context));

  soundOutput = { context, master };
  soundEffectsVolumeSetting.subscribe(applySoundEffectsVolume);
  return soundOutput;
}

function applySoundEffectsVolume() {
  if (!soundOutput) {
    return;
  }
  const { context, master } = soundOutput;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(
    getSoundEffectsGain(),
    now,
    VOLUME_CHANGE_TIME_CONSTANT_SEC,
  );
}

export function playSound(
  sound: SoundEffect,
  options?: PlaySoundOptions,
): number | null {
  return playLayeredSound([{ sound, offsetMs: 0 }], options);
}

export function playLayeredSound(
  layers: readonly SoundLayer[],
  {
    delayMs = 0,
    variation,
    playbackRate = 1,
    volume = 1,
  }: PlaySoundOptions = {},
): number | null {
  if (!isSoundEffectsEnabled() || layers.length === 0) {
    return null;
  }
  const output = getSoundOutput();
  if (!output) {
    return null;
  }
  resumeAudioContext(output.context);
  requestSoundEffects(layers.map(({ sound }) => sound));

  const loadedLayers = getLoadedLayers(layers);
  // まだ読み込めていない効果音は鳴らさない。読み込みを待ってから鳴らすと、操作や演出とずれた時に鳴るため待たない。
  if (!loadedLayers) {
    return null;
  }
  const startTime = output.context.currentTime + delayMs / 1000;
  const varied = variation ? pickVariationScale(variation) : NO_VARIATION_SCALE;
  const scale = {
    playbackRate: varied.playbackRate * playbackRate,
    volume: varied.volume * volume,
  };
  scheduleLayers(output, loadedLayers, startTime, scale);
  return delayMs + getLayersDurationMs(loadedLayers, scale);
}

type LoadedLayer = {
  buffer: AudioBuffer;
  offsetMs: number;
};

function getLoadedLayers(layers: readonly SoundLayer[]): LoadedLayer[] | null {
  const loadedLayers: LoadedLayer[] = [];
  for (const { sound, offsetMs } of layers) {
    const buffer = soundBuffers.get(sound.url);
    if (!buffer) {
      return null;
    }
    loadedLayers.push({ buffer, offsetMs });
  }
  return loadedLayers;
}

function getLayersDurationMs(
  layers: readonly LoadedLayer[],
  { playbackRate }: VariationScale,
): number {
  return Math.max(
    ...layers.map(
      ({ buffer, offsetMs }) =>
        offsetMs + (buffer.duration * 1000) / playbackRate,
    ),
  );
}

type VariationScale = {
  playbackRate: number;
  volume: number;
};

const NO_VARIATION_SCALE: VariationScale = { playbackRate: 1, volume: 1 };

function pickVariationScale({
  pitchCents,
  volumeRatio,
}: SoundVariation): VariationScale {
  const cents = pitchCents * pickSignedUnit();
  return {
    playbackRate: 2 ** (cents / 1200),
    volume: 1 + volumeRatio * pickSignedUnit(),
  };
}

function pickSignedUnit(): number {
  return Math.random() * 2 - 1;
}

function scheduleLayers(
  { context, master }: SoundOutput,
  layers: readonly LoadedLayer[],
  soundStartTime: number,
  scale: VariationScale,
) {
  const volume = context.createGain();
  volume.gain.value = scale.volume;
  volume.connect(master);

  let playingLayerCount = layers.length;
  for (const { buffer, offsetMs } of layers) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = scale.playbackRate;
    source.connect(volume);
    source.addEventListener("ended", function disconnect() {
      source.disconnect();
      playingLayerCount -= 1;
      if (playingLayerCount === 0) {
        volume.disconnect();
      }
    });
    source.start(soundStartTime + offsetMs / 1000);
  }
}
