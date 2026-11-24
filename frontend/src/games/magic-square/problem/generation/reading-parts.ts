import type {
  MagicSquareReadLine,
  MagicSquareReadOptions,
} from "@/games/magic-square/problem/generation/read-model";

type MagicSquareReadOverrides = Partial<MagicSquareReadOptions>;

/**
 * 読み方の部品。基準の読むモデルのほかに、人が使いうる読み方・数え方。部品の1つ・2つ・3つの組み合わせのどれで読んでも
 * 基準と同じレベルになる問題だけにレベルを付ける（難易度の資料 §2.3）。並びは組み合わせの順を決める。
 */
export const magicSquareReadingParts = [
  // 段を上げた所の巡
  { id: "carry", options: { count: "carry" } },
  { id: "cum", options: { count: "cum" } },
  // メモの書き方
  { id: "lock_all", options: { lockScope: "all" } },
  { id: "lock_eph", options: { lockEphemeral: true } },
  { id: "memoryless", options: { memory: false } },
  // 置き方・段の選び方
  { id: "one", options: { batch: false } },
  { id: "fewest", options: { tierChoice: "fewest" } },
  // 1巡の区切り方
  { id: "hidden_next", options: { hiddenNext: true } },
  { id: "lock_next", options: { lockNext: true } },
  // 安い読み
  { id: "range2", options: { bounds: "range", boundsTier: 2 } },
  { id: "viol2", options: { bounds: "viol", boundsTier: 2 } },
  { id: "short3_1", options: { short3Sets: 1 } },
  { id: "short3_2", options: { short3Sets: 2 } },
  { id: "range1", options: { bounds: "range", boundsTier: 1 } },
  { id: "viol1", options: { bounds: "viol", boundsTier: 1 } },
  { id: "jointk2", options: { jointk: 2 } },
  // 読みを減らす人
  { id: "chain2", options: { chainLimit: 2 } },
  { id: "nohidden", options: { hidden: false } },
  { id: "chain_nolock", options: { chainLock: false } },
  // 上の部品をまとめて使う人
  {
    id: "strong",
    options: {
      bounds: "range",
      boundsTier: 1,
      short3Sets: 2,
      jointk: 2,
      count: "carry",
      lockScope: "all",
    },
  },
  {
    id: "weak",
    options: {
      count: "cum",
      lockNext: true,
      chainLimit: 2,
      hidden: false,
      chainLock: false,
      memory: false,
    },
  },
  // ゲームのメモの上限（1マス4つまで）
  { id: "memo4", options: { memoMax: 4 } },
  // 段の付け方・つなぎ方
  { id: "chain4t3", options: { chainTier3From: 4 } },
  { id: "diag_nochain", options: { diagChain: false } },
  // 組が少ない単位の近道
  { id: "short3_3", options: { short3Sets: 3 } },
  { id: "short3_4", options: { short3Sets: 4 } },
  { id: "jointk2_s1", options: { jointk: 2, shortJointSets: 1 } },
  { id: "jointk2_s2", options: { jointk: 2, shortJointSets: 2 } },
  // メモの最小・最大で取る上下限
  { id: "mrange2", options: { mrange: 2 } },
  { id: "mrange1", options: { mrange: 1 } },
  // 鎖を遅れてつなぐ人と、組が1通りの空き2の列を段1で読む人
  { id: "chain_late", options: { chainLate: true } },
  { id: "pair1", options: { pair1: true } },
  // 鎖の延ばし方
  { id: "tchain_none", options: { tchain: 0 } },
  { id: "tchain3_1", options: { tchain: 3, tchainSteps: 1 } },
] as const satisfies readonly {
  id: string;
  options: MagicSquareReadOverrides;
}[];

export type MagicSquareReadingPartId =
  (typeof magicSquareReadingParts)[number]["id"];

/** 部品の読み方。`a+b+c` は部品の組み合わせ。 */
export type MagicSquareReading = {
  id: string;
  options: MagicSquareReadOverrides;
};

/** 組み合わせで値を重ねる設定。「K 通りまで」「K 本まで」は大きい方を採る。 */
const mergedByMaximum = new Set<keyof MagicSquareReadOptions>([
  "short3Sets",
  "shortJointSets",
  "jointk",
]);
/** 「段 t から」は低い方を採る（0 は使わない）。 */
const mergedByMinimum = new Set<keyof MagicSquareReadOptions>(["mrange"]);

/** 部品の設定を重ねる。ほかの設定に違う値が入る組は重ねられないので `null`。 */
function mergeReadingOptions(
  parts: readonly MagicSquareReading[],
): MagicSquareReadOverrides | null {
  const merged: Record<string, unknown> = {};
  for (const { options } of parts) {
    for (const [key, value] of Object.entries(options)) {
      const current = merged[key];
      if (current === undefined || current === value) {
        merged[key] = value;
        continue;
      }
      const optionKey = key as keyof MagicSquareReadOptions;
      if (mergedByMaximum.has(optionKey)) {
        merged[key] = Math.max(current as number, value as number);
      } else if (mergedByMinimum.has(optionKey)) {
        const used = [current as number, value as number].filter(Boolean);
        merged[key] = used.length > 0 ? Math.min(...used) : 0;
      } else {
        return null;
      }
    }
  }
  return merged as MagicSquareReadOverrides;
}

function describeOptions(options: MagicSquareReadOverrides): string {
  return Object.entries(options)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

function listIndexCombinations(count: number, size: number): number[][] {
  const combinations: number[][] = [];
  const grow = (start: number, chosen: number[]) => {
    if (chosen.length === size) {
      combinations.push(chosen);
      return;
    }
    for (let index = start; index < count; index += 1) {
      grow(index + 1, [...chosen, index]);
    }
  };
  grow(0, []);
  return combinations;
}

/** 一致を求める組み合わせの部品の数の上限。 */
const MAXIMUM_COMBINED_PART_COUNT = 3;

let readingCombinations: readonly MagicSquareReading[] | null = null;

/**
 * 部品の2つ・3つの組み合わせ（5,473 通り）。重ねられない組、部品の1つと設定が変わらない組（`strong` に含まれる部品との組など）、
 * 前に出た組と設定が同じ組は除く。並びは部品の並びの辞書順で、2つの組が先。
 */
export function listMagicSquareReadingCombinations(): readonly MagicSquareReading[] {
  if (readingCombinations !== null) {
    return readingCombinations;
  }
  const parts: readonly MagicSquareReading[] = magicSquareReadingParts;
  const seen = new Set(parts.map(({ options }) => describeOptions(options)));
  const combinations: MagicSquareReading[] = [];
  for (let size = 2; size <= MAXIMUM_COMBINED_PART_COUNT; size += 1) {
    for (const indices of listIndexCombinations(parts.length, size)) {
      const chosen = indices.map((index) => parts[index]!);
      const options = mergeReadingOptions(chosen);
      if (options === null) {
        continue;
      }
      const description = describeOptions(options);
      if (
        chosen.some((part) => describeOptions(part.options) === description) ||
        seen.has(description)
      ) {
        continue;
      }
      seen.add(description);
      combinations.push({
        id: chosen.map(({ id }) => id).join("+"),
        options,
      });
    }
  }
  readingCombinations = combinations;
  return combinations;
}

/** 部品の1つ・2つ・3つの組み合わせの全部（部品の並び、続けて組み合わせの並び）。 */
export function listMagicSquareAlternativeReadings(): readonly MagicSquareReading[] {
  return [...magicSquareReadingParts, ...listMagicSquareReadingCombinations()];
}

/** 名前（`a+b+c`）の読み方。重ねられない組なら `null`。 */
export function findMagicSquareReading(id: string): MagicSquareReading | null {
  const parts = id
    .split("+")
    .map((partId) =>
      magicSquareReadingParts.find((part) => part.id === partId),
    );
  if (parts.some((part) => part === undefined)) {
    return null;
  }
  const options = mergeReadingOptions(parts as MagicSquareReading[]);
  return options === null ? null : { id, options };
}

const MAGIC_SQUARE_4_MAGIC_SUM = 34;

/**
 * 4×4 の仮想の列。どの 4×4 魔方陣でも、四隅・中央の 2×2・上下の辺の中央2マスずつ・左右の辺の中央2マスずつの合計が 34 になる。
 * 知っている人には1マス空きの列が増えるので、足して読むとレベルが下がる 4×4 の問題は出さない。
 */
export const magicSquareVirtualLines4: readonly MagicSquareReadLine[] = [
  { cells: [0, 3, 12, 15], sum: MAGIC_SQUARE_4_MAGIC_SUM },
  { cells: [1, 2, 13, 14], sum: MAGIC_SQUARE_4_MAGIC_SUM },
  { cells: [4, 7, 8, 11], sum: MAGIC_SQUARE_4_MAGIC_SUM },
  { cells: [5, 6, 9, 10], sum: MAGIC_SQUARE_4_MAGIC_SUM },
];
