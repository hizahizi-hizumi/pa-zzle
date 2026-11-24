/**
 * 覆面算の効果音を合成して書き出す。題材は、方眼の紙に厚紙の札を置き、鉛筆で × を付け、消しゴムで消す筆算。
 *
 * 書き出し先は frontend/src/games/fukumenzan/assets/sounds/ の次の8つ。
 *
 * - placed.flac: 札を文字に置く、厚紙が紙に当たる軽い音。
 * - crossed.flac: 札に × を付ける、鉛筆の短い2画。
 * - uncrossed.flac: × を外す、消しゴムの柔らかい擦れ。
 * - returned.flac: 札を列へ戻す、厚紙が紙の上を滑って止まる音。
 * - cleared-step-1〜3.flac: 答えの桁が一の位から跳ねていく段ごとの、鉛筆の小さな印と澄んだ音。段ごとに音を上げる。
 * - cleared-chord.flac: 最後の桁が跳ねたときの和音に、花丸を描く鉛筆の擦れを重ねた音。
 *
 * 録音は使わず、Chromium の OfflineAudioContext で、種を決めた乱数の雑音と減衰する正弦波から作る。
 * 同じ版の Chromium と ffmpeg なら同じ音になる。playwright（Chromium を入れたもの）と ffmpeg が要る。
 * playwright はリポジトリの依存に無いので、NODE_PATH か /opt/node* の全体インストールから読む。
 *
 *     bun scripts/assets/fukumenzan_sounds.ts
 *
 * 大きさは、50ms 窓の最大 RMS を、ほかのゲームの同じ役割・同じ頻度の音にそろえる。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const REPOSITORY = path.resolve(import.meta.dir, "../..");
const SOUND_DIRECTORY = path.join(
  REPOSITORY,
  "frontend/src/games/fukumenzan/assets/sounds",
);
const SAMPLE_RATE = 48000;

type Playwright = typeof import("playwright");

function loadPlaywright(): Playwright {
  const globalModuleDirectories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const directory of globalModuleDirectories) {
    try {
      return createRequire(path.join(directory, "_"))("playwright");
    } catch {}
  }
  throw new Error(
    "playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する",
  );
}

/** 50ms 窓の最大 RMS（dBFS）の目標。同じ役割の今の音の値（コメントの値）にそろえる。 */
const finishes = {
  // ナンプレの数字・タクズのタイル・マインスイーパーの旗が -37 前後。
  placed: { seconds: 0.065, rms50Db: -37.0 },
  // いちばん回数の多い操作。ナンプレのメモ（-44.6）と数字（-37.0）の間。
  crossed: { seconds: 0.06, rms50Db: -42.0 },
  // 外す向き。ナンプレのメモを消す音（-43.9）にそろえる。
  uncrossed: { seconds: 0.055, rms50Db: -43.5 },
  // 外す向き。タクズの空に戻す音（-38.6）・マインスイーパーの旗を外す音（-39.3）にそろえる。
  returned: { seconds: 0.07, rms50Db: -39.5 },
  // ナンプレ・タクズのクリアの段の音が -35 前後。
  "cleared-step-1": { seconds: 0.11, rms50Db: -35.2 },
  "cleared-step-2": { seconds: 0.11, rms50Db: -35.2 },
  "cleared-step-3": { seconds: 0.11, rms50Db: -35.2 },
  // ナンプレ・タクズ・マインスイーパーのクリアの和音が -29〜-30。
  "cleared-chord": { seconds: 0.4, rms50Db: -29.5 },
} as const;

type SoundName = keyof typeof finishes;

/** ブラウザの中で、音ごとに OfflineAudioContext で描いた波形を返す。playwright がこの関数を文字列にしてページで呼ぶので、外の名前を使わない。 */
async function renderInBrowser({
  specs,
  sampleRate,
}: {
  specs: readonly { name: string; seconds: number }[];
  sampleRate: number;
}): Promise<Record<string, number[]>> {
  function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noise(
    context: OfflineAudioContext,
    seconds: number,
    seed: number,
  ): AudioBufferSourceNode {
    const random = createRandom(seed);
    const buffer = context.createBuffer(
      1,
      Math.ceil(seconds * sampleRate),
      sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  function filter(
    context: OfflineAudioContext,
    type: BiquadFilterType,
    frequency: number,
    q = 0.7,
  ): BiquadFilterNode {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  /** 立ち上がって指数で減る音量。 */
  function envelope(
    context: OfflineAudioContext,
    start: number,
    attack: number,
    decay: number,
    peak = 1,
  ): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(
      peak * 0.001,
      start + attack + decay,
    );
    gain.gain.setValueAtTime(0, start + attack + decay);
    return gain;
  }

  function connect(...nodes: AudioNode[]): void {
    for (let index = 0; index + 1 < nodes.length; index += 1) {
      nodes[index]!.connect(nodes[index + 1]!);
    }
  }

  /** 雑音を通した擦れ。`frequencies` を通る帯にし、`start` から鳴らす。 */
  function scratch(
    context: OfflineAudioContext,
    {
      start,
      attack,
      decay,
      peak,
      highpass,
      band,
      q,
      seed,
    }: {
      start: number;
      attack: number;
      decay: number;
      peak: number;
      highpass: number;
      band: number;
      q: number;
      seed: number;
    },
  ): void {
    const source = noise(context, attack + decay + 0.01, seed);
    connect(
      source,
      filter(context, "highpass", highpass),
      filter(context, "bandpass", band, q),
      envelope(context, start, attack, decay, peak),
      context.destination,
    );
    source.start(start);
  }

  /** 減衰する正弦波。`overtones` は倍音の大きさ（2倍・3倍…）。 */
  function tone(
    context: OfflineAudioContext,
    {
      start,
      frequency,
      endFrequency = frequency,
      attack,
      decay,
      peak,
      overtones = [],
    }: {
      start: number;
      frequency: number;
      endFrequency?: number;
      attack: number;
      decay: number;
      peak: number;
      overtones?: readonly number[];
    },
  ): void {
    for (const [index, level] of [1, ...overtones].entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      const multiple = index + 1;
      oscillator.frequency.setValueAtTime(frequency * multiple, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency * multiple,
        start + attack + decay,
      );
      connect(
        oscillator,
        envelope(context, start, attack, decay / multiple, peak * level),
        context.destination,
      );
      oscillator.start(start);
      oscillator.stop(start + attack + decay + 0.005);
    }
  }

  const recipes: Record<string, (context: OfflineAudioContext) => void> = {
    placed(context) {
      scratch(context, {
        start: 0,
        attack: 0.001,
        decay: 0.025,
        peak: 0.8,
        highpass: 600,
        band: 2600,
        q: 0.8,
        seed: 11,
      });
      tone(context, {
        start: 0,
        frequency: 230,
        endFrequency: 160,
        attack: 0.002,
        decay: 0.05,
        peak: 0.55,
        overtones: [0.25],
      });
    },
    crossed(context) {
      for (const [index, start] of [0, 0.026].entries()) {
        scratch(context, {
          start,
          attack: 0.004,
          decay: 0.02,
          peak: index === 0 ? 0.8 : 0.65,
          highpass: 2500,
          band: index === 0 ? 5200 : 4600,
          q: 1.1,
          seed: 21 + index,
        });
      }
    },
    uncrossed(context) {
      scratch(context, {
        start: 0,
        attack: 0.012,
        decay: 0.04,
        peak: 0.8,
        highpass: 250,
        band: 1100,
        q: 0.6,
        seed: 31,
      });
    },
    returned(context) {
      const source = noise(context, 0.07, 41);
      const band = filter(context, "bandpass", 1600, 0.9);
      band.frequency.setValueAtTime(1600, 0);
      band.frequency.exponentialRampToValueAtTime(800, 0.05);
      connect(
        source,
        filter(context, "highpass", 300),
        band,
        envelope(context, 0, 0.008, 0.045, 0.7),
        context.destination,
      );
      source.start(0);
      tone(context, {
        start: 0.04,
        frequency: 190,
        endFrequency: 150,
        attack: 0.002,
        decay: 0.025,
        peak: 0.35,
      });
    },
    ...Object.fromEntries(
      [587.33, 659.26, 783.99].map((frequency, index) => [
        `cleared-step-${index + 1}`,
        (context: OfflineAudioContext) => {
          scratch(context, {
            start: 0,
            attack: 0.001,
            decay: 0.008,
            peak: 0.5,
            highpass: 3500,
            band: 5000,
            q: 0.9,
            seed: 51 + index,
          });
          tone(context, {
            start: 0.004,
            frequency,
            attack: 0.004,
            decay: 0.1,
            peak: 0.5,
            overtones: [0.18, 0.05],
          });
        },
      ]),
    ),
    "cleared-chord"(context) {
      for (const [index, frequency] of [
        523.25, 659.26, 783.99, 1046.5,
      ].entries()) {
        tone(context, {
          start: index * 0.012,
          frequency,
          attack: 0.006,
          decay: 0.37,
          peak: 0.28,
          overtones: [0.15, 0.04],
        });
      }
      const source = noise(context, 0.2, 61);
      const band = filter(context, "bandpass", 3200, 1.4);
      band.frequency.setValueAtTime(3200, 0);
      band.frequency.linearRampToValueAtTime(5000, 0.18);
      const swirl = context.createGain();
      swirl.gain.setValueAtTime(0, 0);
      for (let step = 0; step < 3; step += 1) {
        swirl.gain.linearRampToValueAtTime(0.035, step * 0.06 + 0.02);
        swirl.gain.linearRampToValueAtTime(0.012, step * 0.06 + 0.05);
      }
      swirl.gain.linearRampToValueAtTime(0, 0.19);
      connect(
        source,
        filter(context, "highpass", 1500),
        band,
        swirl,
        context.destination,
      );
      source.start(0);
    },
  };

  const rendered: Record<string, number[]> = {};
  for (const { name, seconds } of specs) {
    const context = new OfflineAudioContext(
      1,
      Math.round(seconds * sampleRate),
      sampleRate,
    );
    recipes[name]!(context);
    const buffer = await context.startRendering();
    rendered[name] = Array.from(buffer.getChannelData(0));
  }
  return rendered;
}

function maxRms50(signal: Float32Array): number {
  const window = Math.round(SAMPLE_RATE * 0.05);
  const step = Math.round(SAMPLE_RATE * 0.005);
  let max = 0;
  for (
    let start = 0;
    start === 0 || start + window <= signal.length;
    start += step
  ) {
    let sum = 0;
    const end = Math.min(signal.length, start + window);
    for (let index = start; index < end; index += 1) {
      sum += signal[index]! ** 2;
    }
    max = Math.max(max, Math.sqrt(sum / window));
    if (end === signal.length) {
      break;
    }
  }
  return max;
}

/** 終わりを 8ms で消し、50ms 窓の最大 RMS を目標にそろえる。 */
function finish(samples: readonly number[], rms50Db: number): Float32Array {
  const signal = Float32Array.from(samples);
  const fade = Math.round(SAMPLE_RATE * 0.008);
  for (let index = 0; index < fade; index += 1) {
    signal[signal.length - fade + index]! *= ((fade - index) / fade) ** 2;
  }
  const scale = 10 ** (rms50Db / 20) / maxRms50(signal);
  return signal.map((value) => value * scale);
}

/** FLAC のメタデータから PADDING のブロックを外す。ffmpeg の FLAC は 8KB の PADDING を書くため。 */
function withoutPadding(flac: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let position = 4;
  for (;;) {
    const header = flac[position]!;
    const length =
      (flac[position + 1]! << 16) |
      (flac[position + 2]! << 8) |
      flac[position + 3]!;
    if ((header & 0x7f) !== 1) {
      kept.push(flac.slice(position, position + 4 + length));
    }
    position += 4 + length;
    if (header & 0x80) {
      break;
    }
  }
  for (const block of kept) {
    block[0]! &= 0x7f;
  }
  kept.at(-1)![0]! |= 0x80;
  return Uint8Array.from([
    ...flac.slice(0, 4),
    ...kept.flatMap((block) => [...block]),
    ...flac.slice(position),
  ]);
}

function writeFlac(name: SoundName, signal: Float32Array): void {
  let peak = 0;
  for (const value of signal) {
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak >= 0.95) {
    throw new Error(`ピークが大きすぎる: ${name}`);
  }
  const file = path.join(SOUND_DIRECTORY, `${name}.flac`);
  // STREAMINFO に長さと MD5 を書き戻せるよう、ffmpeg にはパイプではなくファイルへ書かせる。
  const result = Bun.spawnSync(
    [
      "ffmpeg",
      "-nostdin",
      "-v",
      "error",
      "-y",
      "-f",
      "f32le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-i",
      "-",
      "-c:a",
      "flac",
      "-sample_fmt",
      "s16",
      "-compression_level",
      "12",
      file,
    ],
    { stdin: new Uint8Array(signal.buffer) },
  );
  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg が失敗した: ${result.stderr.toString()}`);
  }
  writeFileSync(file, withoutPadding(readFileSync(file)));
}

async function main(): Promise<void> {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const specs = Object.entries(finishes).map(([name, { seconds }]) => ({
      name,
      seconds,
    }));
    const rendered = await page.evaluate(renderInBrowser, {
      specs,
      sampleRate: SAMPLE_RATE,
    });
    for (const [name, { rms50Db }] of Object.entries(finishes)) {
      writeFlac(name as SoundName, finish(rendered[name]!, rms50Db));
    }
  } finally {
    await browser.close();
  }
}

await main();
