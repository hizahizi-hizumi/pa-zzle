// 魔方陣の効果音（frontend/src/games/magic-square/assets/sounds/*.flac）を書き出す。
//
// 素材は石。数を置く音は、数を刻んだ石の札が石の盤のくぼみに収まる乾いた接触に、札の短い鳴りを添える。
// クリアは石の打楽器（磬）の響きで、行・縦の列・斜めの3段と仕上げの和音にする。録音は使わず、音の定義を
// Chromium の OfflineAudioContext で描き、50ms 窓の最大 RMS をそろえてから ffmpeg で FLAC にする。
//
//   bun scripts/assets/magic_square_sounds.ts [--output <書き出し先>]
//
// playwright（NODE_PATH か /opt/node*/lib/node_modules にあるもの）と ffmpeg（6.1）が要る。
// 雑音は種を決めた乱数で作る。同じ版の Chromium と ffmpeg でも、OfflineAudioContext の描画の浮動小数点の
// わずかな違いで、16bit にした標本の最下位ビットが実行ごとに変わることがある（試した範囲では cleared-diagonal の1標本）。
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 48_000;
const REPOSITORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_OUTPUT = path.join(
  REPOSITORY,
  "frontend/src/games/magic-square/assets/sounds",
);
/** 書き出す音のピークの上限。16bit にしたときに割れないよう、tsume_shogi_sounds.py と同じ値にする。 */
const PEAK_LIMIT = 0.95;

/** 石の板を叩いたときの部分音の比。両端が自由な棒の振動の比で、磬や石琴の鳴りに近い。 */
const STONE_BAR_RATIOS = [1, 2.756, 5.404];

type FilterKind = "lowpass" | "highpass" | "bandpass";

/** 減衰する正弦波を重ねた鳴り。`ratios`・`gainsDb`・`decaysMs` は部分音ごと。 */
type PartialsLayer = {
  kind: "partials";
  frequency: number;
  ratios: readonly number[];
  gainsDb: readonly number[];
  decaysMs: readonly number[];
  startMs: number;
};

/** フィルタを通した雑音の打撃。`attackMs` で立ち上がり、`decayMs` の時定数で消える。 */
type NoiseLayer = {
  kind: "noise";
  filter: FilterKind;
  frequency: number;
  q: number;
  gainDb: number;
  attackMs: number;
  decayMs: number;
  startMs: number;
  seed: number;
};

type SoundLayer = PartialsLayer | NoiseLayer;

/**
 * 1本の音の定義と仕上げ。`rms50Db` は 50ms 窓の最大 RMS（bridges_sounds.py の `rms50` と同じ定義）で、
 * 音の調査で決めた役割ごとの目安にそろえる。`floorDb` はピークからここまで下がったところで切る深さ。
 */
type SoundDefinition = {
  name: string;
  lengthMs: number;
  layers: readonly SoundLayer[];
  rms50Db: number;
  floorDb: number;
  fadeMs: number;
};

/** 鳴り始めをずらした石の打撃（部分音と、ばちの当たりの雑音）。 */
function stoneStrike(
  frequency: number,
  startMs: number,
  { gainDb, decayMs, seed }: { gainDb: number; decayMs: number; seed: number },
): SoundLayer[] {
  return [
    {
      kind: "partials",
      frequency,
      ratios: STONE_BAR_RATIOS,
      gainsDb: [gainDb, gainDb - 12, gainDb - 24],
      decaysMs: [decayMs, decayMs * 0.32, decayMs * 0.12],
      startMs,
    },
    {
      kind: "noise",
      filter: "bandpass",
      frequency: 3_800,
      q: 1.2,
      gainDb: gainDb - 16,
      attackMs: 0.3,
      decayMs: 1.2,
      startMs,
      seed,
    },
  ];
}

const C5 = 523.25;
const E5 = 659.26;
const G5 = 783.99;
const C6 = 1046.5;
const C4 = 261.63;

/**
 * - `placed`: 札がくぼみに当たる乾いた接触（高い帯域の雑音）、くぼみの底に収まる低い鳴り、札そのものの短い鳴り。
 * - `rejected`: 札が入らずに当たって止まる、低く鈍い打撃。札の鳴りを抑え、責めない短さにする。
 * - `memo-written`・`memo-erased`: 石に細く書く・こすって消す音。置く音より小さく短い。
 * - クリアの3段は、どの向きも同じ高さ（G5）を上に保ち、下に E5・C5 を重ねて厚くする。仕上げは C の長三和音で開く。
 */
const soundDefinitions: readonly SoundDefinition[] = [
  {
    name: "placed",
    lengthMs: 90,
    layers: [
      {
        kind: "noise",
        filter: "bandpass",
        frequency: 3_200,
        q: 0.9,
        gainDb: 0,
        attackMs: 0.2,
        decayMs: 1.6,
        startMs: 0,
        seed: 11,
      },
      {
        kind: "noise",
        filter: "lowpass",
        frequency: 520,
        q: 0.7,
        gainDb: -6,
        attackMs: 1,
        decayMs: 6,
        startMs: 0.5,
        seed: 12,
      },
      {
        kind: "partials",
        frequency: 240,
        ratios: [1],
        gainsDb: [-9],
        decaysMs: [12],
        startMs: 0.5,
      },
      {
        kind: "partials",
        frequency: 1_480,
        ratios: [1, 2.31, 3.86],
        gainsDb: [-10, -17, -24],
        decaysMs: [16, 8, 5],
        startMs: 0.3,
      },
    ],
    rms50Db: -36.8,
    floorDb: -40,
    fadeMs: 12,
  },
  {
    name: "rejected",
    lengthMs: 120,
    layers: [
      {
        kind: "noise",
        filter: "lowpass",
        frequency: 1_100,
        q: 0.7,
        gainDb: 0,
        attackMs: 0.8,
        decayMs: 8,
        startMs: 0,
        seed: 21,
      },
      {
        kind: "partials",
        frequency: 410,
        ratios: [1, 2.42],
        gainsDb: [-6, -16],
        decaysMs: [24, 8],
        startMs: 0.5,
      },
    ],
    rms50Db: -37,
    floorDb: -40,
    fadeMs: 15,
  },
  {
    name: "memo-written",
    lengthMs: 50,
    layers: [
      {
        kind: "noise",
        filter: "bandpass",
        frequency: 5_600,
        q: 1.6,
        gainDb: -4,
        attackMs: 2,
        decayMs: 4,
        startMs: 0,
        seed: 31,
      },
      {
        kind: "partials",
        frequency: 3_100,
        ratios: [1],
        gainsDb: [0],
        decaysMs: [8],
        startMs: 0.5,
      },
    ],
    rms50Db: -44,
    floorDb: -36,
    fadeMs: 8,
  },
  {
    name: "memo-erased",
    lengthMs: 45,
    layers: [
      {
        kind: "noise",
        filter: "bandpass",
        frequency: 2_600,
        q: 1.1,
        gainDb: 0,
        attackMs: 4,
        decayMs: 6,
        startMs: 0,
        seed: 41,
      },
    ],
    rms50Db: -45,
    floorDb: -36,
    fadeMs: 10,
  },
  {
    name: "cleared-row",
    lengthMs: 240,
    layers: stoneStrike(G5, 0, { gainDb: 0, decayMs: 68, seed: 51 }),
    rms50Db: -35.6,
    floorDb: -38,
    fadeMs: 45,
  },
  {
    name: "cleared-column",
    lengthMs: 240,
    layers: [
      ...stoneStrike(G5, 0, { gainDb: 0, decayMs: 70, seed: 61 }),
      ...stoneStrike(E5, 6, { gainDb: -4, decayMs: 70, seed: 62 }),
    ],
    rms50Db: -35.2,
    floorDb: -38,
    fadeMs: 45,
  },
  {
    name: "cleared-diagonal",
    lengthMs: 240,
    layers: [
      ...stoneStrike(G5, 0, { gainDb: 0, decayMs: 72, seed: 71 }),
      ...stoneStrike(E5, 6, { gainDb: -4, decayMs: 72, seed: 72 }),
      ...stoneStrike(C5, 12, { gainDb: -5, decayMs: 72, seed: 73 }),
    ],
    rms50Db: -34.8,
    floorDb: -38,
    fadeMs: 45,
  },
  {
    name: "cleared-finish",
    lengthMs: 540,
    layers: [
      ...stoneStrike(C5, 0, { gainDb: -2, decayMs: 150, seed: 81 }),
      ...stoneStrike(E5, 8, { gainDb: -3, decayMs: 142, seed: 82 }),
      ...stoneStrike(G5, 16, { gainDb: -2, decayMs: 136, seed: 83 }),
      ...stoneStrike(C6, 24, { gainDb: 0, decayMs: 122, seed: 84 }),
      {
        kind: "partials",
        frequency: C4,
        ratios: [1, 2],
        gainsDb: [-6, -15],
        decaysMs: [140, 50],
        startMs: 0,
      },
    ],
    rms50Db: -29,
    floorDb: -38,
    fadeMs: 100,
  },
];

function loadPlaywright(): {
  chromium: { launch: () => Promise<PlaywrightBrowser> };
} {
  const moduleDirectories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [
    import.meta.url,
    ...moduleDirectories.map((directory) => path.join(directory, "_")),
  ]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  throw new Error(
    "playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する",
  );
}

type PlaywrightPage = {
  evaluate: <Result, Argument>(
    pageFunction: (argument: Argument) => Promise<Result>,
    argument: Argument,
  ) => Promise<Result>;
};

type PlaywrightBrowser = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

/**
 * ページの中で実行する。外の変数を参照できないので、使う値はすべて引数で受け取る。
 * 雑音は mulberry32 の乱数で作り、層ごとの種で同じ雑音を作り直せるようにする。
 */
async function renderInPage({
  definition,
  sampleRate,
}: {
  definition: SoundDefinition;
  sampleRate: number;
}): Promise<number[]> {
  const length = Math.ceil((definition.lengthMs / 1000) * sampleRate);
  const context = new OfflineAudioContext(1, length, sampleRate);
  const toGain = (db: number) => 10 ** (db / 20);
  const random = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };
  for (const layer of definition.layers) {
    const start = layer.startMs / 1000;
    if (layer.kind === "partials") {
      layer.ratios.forEach((ratio, index) => {
        const oscillator = new OscillatorNode(context, {
          frequency: layer.frequency * ratio,
        });
        const envelope = new GainNode(context, { gain: 0 });
        const peak = toGain(layer.gainsDb[index] ?? -60);
        const decay = (layer.decaysMs[index] ?? 10) / 1000;
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(peak, start + 0.0005);
        envelope.gain.setTargetAtTime(0, start + 0.0005, decay);
        oscillator.connect(envelope).connect(context.destination);
        oscillator.start(start);
      });
      continue;
    }
    const next = random(layer.seed);
    const buffer = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = next() * 2 - 1;
    }
    const source = new AudioBufferSourceNode(context, { buffer });
    const filter = new BiquadFilterNode(context, {
      type: layer.filter,
      frequency: layer.frequency,
      Q: layer.q,
    });
    const envelope = new GainNode(context, { gain: 0 });
    const attack = layer.attackMs / 1000;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(toGain(layer.gainDb), start + attack);
    envelope.gain.setTargetAtTime(0, start + attack, layer.decayMs / 1000);
    source.connect(filter).connect(envelope).connect(context.destination);
    source.start(start);
  }
  const rendered = await context.startRendering();
  return Array.from(rendered.getChannelData(0));
}

function samples(ms: number): number {
  return Math.floor((ms / 1000) * SAMPLE_RATE);
}

/** 50ms 窓の最大 RMS（dBFS）。窓より短い音は全体の RMS。 */
function rms50Db(signal: Float64Array): number {
  const window = samples(50);
  let energy: number;
  if (signal.length <= window) {
    energy =
      signal.reduce((sum, value) => sum + value * value, 0) / signal.length;
  } else {
    let running = 0;
    for (let index = 0; index < window; index += 1) {
      running += signal[index]! ** 2;
    }
    let best = running;
    for (let index = window; index < signal.length; index += 1) {
      running += signal[index]! ** 2 - signal[index - window]! ** 2;
      best = Math.max(best, running);
    }
    energy = best / window;
  }
  return 10 * Math.log10(energy + 1e-15);
}

function biquad(
  signal: Float64Array,
  b: readonly number[],
  a: readonly number[],
): Float64Array {
  const [a0, a1, a2] = a as [number, number, number];
  const [b0, b1, b2] = (b as [number, number, number]).map(
    (value) => value / a0,
  ) as [number, number, number];
  const output = new Float64Array(signal.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < signal.length; index += 1) {
    const x = signal[index]!;
    const y = b0 * x + b1 * x1 + b2 * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[index] = y;
  }
  return output;
}

/** ITU-R BS.1770 の K 特性。tsume_shogi_sounds.py の `k_weight` と同じ係数（RBJ の式）。 */
function kWeight(signal: Float64Array): Float64Array {
  const amplitude = 10 ** (4 / 40);
  let omega = (2 * Math.PI * 1500) / SAMPLE_RATE;
  let alpha = Math.sin(omega) / (2 * (1 / Math.SQRT2));
  const root = 2 * Math.sqrt(amplitude) * alpha;
  let cos = Math.cos(omega);
  const shelfB = [
    amplitude * (amplitude + 1 + (amplitude - 1) * cos + root),
    -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cos),
    amplitude * (amplitude + 1 + (amplitude - 1) * cos - root),
  ];
  const shelfA = [
    amplitude + 1 - (amplitude - 1) * cos + root,
    2 * (amplitude - 1 - (amplitude + 1) * cos),
    amplitude + 1 - (amplitude - 1) * cos - root,
  ];
  omega = (2 * Math.PI * 38) / SAMPLE_RATE;
  alpha = Math.sin(omega) / (2 * 0.5);
  cos = Math.cos(omega);
  const passB = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  const passA = [1 + alpha, -2 * cos, 1 - alpha];
  return biquad(biquad(signal, shelfB, shelfA), passB, passA);
}

/** 400ms 窓の最大ラウドネス（LUFS）。前後に 400ms の無音を足して測る（tsume_shogi_sounds.py と同じ）。 */
function momentaryLoudness(signal: Float64Array): number {
  const window = samples(400);
  const padded = new Float64Array(signal.length + window * 2);
  padded.set(signal, window);
  const weighted = kWeight(padded);
  let running = 0;
  for (let index = 0; index < window; index += 1) {
    running += weighted[index]! ** 2;
  }
  let best = running;
  for (let index = window; index < weighted.length; index += 1) {
    running += weighted[index]! ** 2 - weighted[index - window]! ** 2;
    best = Math.max(best, running);
  }
  return -0.691 + 10 * Math.log10(best / window + 1e-15);
}

function peakOf(signal: Float64Array): number {
  return signal.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
}

function scaleToRms50(signal: Float64Array, targetDb: number): Float64Array {
  const gain = 10 ** ((targetDb - rms50Db(signal)) / 20);
  return signal.map((value) => value * gain);
}

/**
 * 大きさをそろえ、鳴り始めの前の無音を詰め、ピークから `floorDb` 下がったところで切って `fadeMs` で閉じる。
 * 切った後にもう一度大きさをそろえる。
 */
function finishSound(
  rendered: Float64Array,
  definition: SoundDefinition,
): Float64Array {
  const magnitude = rendered.map(Math.abs);
  const loudest = peakOf(rendered);
  const onset = Math.max(
    0,
    magnitude.findIndex((value) => value > loudest * 10 ** (-50 / 20)) -
      samples(0.5),
  );
  const window = samples(2);
  const envelope = new Float64Array(rendered.length);
  let running = 0;
  for (let index = 0; index < rendered.length; index += 1) {
    running += rendered[index]! ** 2;
    if (index >= window) {
      running -= rendered[index - window]! ** 2;
    }
    envelope[index] = Math.sqrt(Math.max(running, 0) / window);
  }
  const envelopePeak = envelope.reduce(
    (best, value, index) => (value > envelope[best]! ? index : best),
    0,
  );
  const floor = envelope[envelopePeak]! * 10 ** (definition.floorDb / 20);
  const belowFloor = envelope.findIndex(
    (value, index) => index > envelopePeak && value < floor,
  );
  const fade = samples(definition.fadeMs);
  const end = Math.min(
    rendered.length,
    (belowFloor < 0 ? rendered.length : belowFloor) + fade,
  );
  const trimmed = rendered.slice(onset, end);
  const fadeLength = Math.min(fade, trimmed.length);
  for (let index = 0; index < fadeLength; index += 1) {
    const position = trimmed.length - fadeLength + index;
    trimmed[position]! *= Math.cos(((index / fadeLength) * Math.PI) / 2) ** 2;
  }
  return scaleToRms50(trimmed, definition.rms50Db);
}

/** FLAC のメタデータから PADDING のブロックを外す。ffmpeg の FLAC は 8KB の PADDING を書くため（tsume_shogi_sounds.py と同じ）。 */
function withoutPadding(flac: Uint8Array): Uint8Array {
  let position = 4;
  const blocks: Uint8Array[] = [];
  while (true) {
    const header = flac[position]!;
    const length =
      (flac[position + 1]! << 16) |
      (flac[position + 2]! << 8) |
      flac[position + 3]!;
    if ((header & 0x7f) !== 1) {
      blocks.push(flac.slice(position, position + 4 + length));
    }
    position += 4 + length;
    if (header & 0x80) {
      break;
    }
  }
  for (const block of blocks) {
    block[0]! &= 0x7f;
  }
  blocks.at(-1)![0]! |= 0x80;
  const audio = flac.slice(position);
  const output = new Uint8Array(
    4 + blocks.reduce((sum, block) => sum + block.length, 0) + audio.length,
  );
  output.set(flac.slice(0, 4), 0);
  let offset = 4;
  for (const block of blocks) {
    output.set(block, offset);
    offset += block.length;
  }
  output.set(audio, offset);
  return output;
}

/**
 * FLAC のブロックの長さの候補。短い音は打撃と余韻で波形が大きく変わるので、ブロックが短いほど小さくなる音と、
 * 長いほど小さくなる音がある。どの長さでも中身の標本は同じで、ファイルの大きさだけが変わる。
 */
const FLAC_FRAME_SIZES = [1152, 2304, 4608];

function encodeFlac(filePath: string, signal: Float64Array, frameSize: number) {
  const result = spawnSync(
    "ffmpeg",
    [
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
      "-frame_size",
      String(frameSize),
      filePath,
    ],
    { input: Buffer.from(Float32Array.from(signal).buffer) },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg が失敗した: ${result.stderr.toString()}`);
  }
  return withoutPadding(readFileSync(filePath));
}

/**
 * 16bit の FLAC にし、ブロックの長さの候補のうち最も小さくなるものを書く。
 * STREAMINFO に長さと MD5 を書き戻せるよう、ffmpeg にはパイプではなくファイルへ書かせる。
 */
function writeFlac(filePath: string, signal: Float64Array): void {
  if (peakOf(signal) >= PEAK_LIMIT) {
    throw new Error(`ピークが大きすぎる: ${path.basename(filePath)}`);
  }
  const smallest = FLAC_FRAME_SIZES.map((frameSize) =>
    encodeFlac(filePath, signal, frameSize),
  ).reduce((best, encoded) => (encoded.length < best.length ? encoded : best));
  writeFileSync(filePath, smallest);
}

function formatDb(value: number): string {
  return value.toFixed(1);
}

function readOutputDirectory(): string {
  const index = process.argv.indexOf("--output");
  return index < 0 ? DEFAULT_OUTPUT : path.resolve(process.argv[index + 1]!);
}

async function main(): Promise<void> {
  const output = readOutputDirectory();
  mkdirSync(output, { recursive: true });
  const browser = await loadPlaywright().chromium.launch();
  try {
    const page = await browser.newPage();
    console.log(
      "| 音 | 長さ(s) | ピーク(dBFS) | RMS50(dBFS) | LUFS(400ms) | バイト |",
    );
    console.log("|---|---|---|---|---|---|");
    for (const definition of soundDefinitions) {
      const rendered = await page.evaluate(renderInPage, {
        definition,
        sampleRate: SAMPLE_RATE,
      });
      const sound = finishSound(Float64Array.from(rendered), definition);
      const filePath = path.join(output, `${definition.name}.flac`);
      writeFlac(filePath, sound);
      console.log(
        `| ${definition.name} | ${(sound.length / SAMPLE_RATE).toFixed(3)} | ${formatDb(20 * Math.log10(peakOf(sound)))} | ${formatDb(rms50Db(sound))} | ${formatDb(momentaryLoudness(sound))} | ${readFileSync(filePath).length} |`,
      );
    }
  } finally {
    await browser.close();
  }
}

await main();
