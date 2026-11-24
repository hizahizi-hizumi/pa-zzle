import {
  countFukumenzanSplits,
  type FukumenzanSplitCount,
  type FukumenzanSplitSearch,
} from "@/games/fukumenzan/problem/generation/case-splitting";
import {
  createFukumenzanColumnModel,
  createInitialDomains,
  digitCountOfMask,
  type FukumenzanColumnModel,
} from "@/games/fukumenzan/problem/generation/column-model";
import {
  createFukumenzanReader,
  type FukumenzanReaderSettings,
  readFukumenzanColumn,
  solvesWithoutSplitting,
} from "@/games/fukumenzan/problem/generation/column-readers";
import { countFukumenzanSolutions } from "@/games/fukumenzan/problem/generation/exact-solver";
import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";

/**
 * 盤面の規模。`2s` は2つ足しで4桁まで、`2l` は2つ足しで5桁以上、`3s` は3つ足しで4桁まで、`3l` は3つ足しで5桁以上
 * （桁は足す数のいちばん長いもの）。
 */
export type FukumenzanScale = "2s" | "2l" | "3s" | "3l";

export type FukumenzanScaleFeatures = {
  scale: FukumenzanScale;
  addendCount: number;
  longestAddendLength: number;
  letterCount: number;
};

/** 読み手が場合分けなしで全部の文字を決められたか。 */
export type FukumenzanReaderOutcome = "solved" | "stuck";

/**
 * 読み手の族の端の結果。どの読み手も、要るときだけ安い順に当てるので、当てなかった読み手は持たない。
 * どの読み手も、答えの先頭の文字を最上位の桁の左への繰り上がりとして読み、決まっていない文字と組は両辺で消える文字を除いて数える。
 * - `weakColumns`: 1桁ずつの読みの弱い端。1桁は組4まで書き出し、決まっていない文字が3つ以上で組の多い桁は和の大きさだけで読む。
 *   表は決まった数字を消すだけ。
 * - `strongColumns`: 1桁ずつの読みの強い端。1桁は組を全部書き出し、表の隠れた1つと組の消去も使う。
 * - `weakPairs`: まとめる読みの弱い端。`weakColumns` に、隣の2桁のまとめ（つないだ組8まで、かつ探す手間50まで）を足す。
 *   探す手間は、2桁それぞれの組の数の積。
 * - `strongCombined`: まとめる読みの強い端。`strongColumns` に、隣の2桁（積200まで、多ければつないだ組50まで）・共通の文字を
 *   持つ隣でない2桁（組50まで）・隣の3桁（組12まで）・隣り合わない3桁（組12まで）のまとめを足す。
 * - `strongEquations`: `strongCombined` に、2桁・3桁・全部の桁を桁の重みでまとめた式と、共通の文字を持つ2桁の式の差の読み
 *   （決まっていない変数3つまでは書き出し、多ければ和の大きさ）を足す。
 * - `weakLightColumns`・`strongLightColumns`: 書き出しの多い桁を読まない1桁ずつの読み。決まっていない文字が3つ以上で組が4
 *   （強い端は12）より多い桁を読まない。強い端は隠れた1つと組の消去も使う。
 * - `splitsByClosure`: `weakPairs` から探す手間の上限を外した読み手が、枝を閉包で読む場合分けの回数。
 * - `splitsBySteps`: 同じ読み手が、枝を人の手18手まで追う場合分けの回数。
 */
export type FukumenzanReaderResults = {
  weakColumns: FukumenzanReaderOutcome;
  strongColumns?: FukumenzanReaderOutcome;
  weakPairs?: FukumenzanReaderOutcome;
  strongCombined?: FukumenzanReaderOutcome;
  strongEquations?: FukumenzanReaderOutcome;
  weakLightColumns?: FukumenzanReaderOutcome;
  strongLightColumns?: FukumenzanReaderOutcome;
  splitsByClosure?: FukumenzanSplitCount;
  splitsBySteps?: FukumenzanSplitCount;
};

/**
 * 読みの組。値を仮に置かずに決まるかを、族の端の読み手で言い切れるかで分ける。
 * - `E`: 1桁ずつ読めば決まる（`weakColumns` が解く）。
 * - `mE`: 1桁ずつの読みの端の間の余白（`weakColumns` は止まり、`strongColumns` が解く）。
 * - `H1`: 1桁ずつではどう読んでも止まり、隣の桁と少ない組を突き合わせれば決まる（`weakPairs` が解く）。
 * - `mH`: まとめる読みの端の間の余白（`weakPairs` は止まり、`strongCombined` か `strongEquations` が解く）。
 * - `H2`: どうまとめて読んでも、値を仮に置く場合分けが要る。
 */
export type FukumenzanReadingClass = "E" | "mE" | "H1" | "mH" | "H2";

/**
 * E の中の1桁の重さ。`E1` は書き出しの少ない桁だけで決まる（`weakLightColumns` が解く）。`E2` は、決まっていない文字が3つ
 * ある桁を和の大きさか大きな書き出しで読まなければ決まらない（`strongLightColumns` も止まる）。`between` はその間の余白。
 */
export type FukumenzanColumnWeight = "E1" | "E2" | "between";

/** どの規模の盤面で、1桁の重さと場合分けの回数を測るか。ほかの規模では当てない。 */
export type FukumenzanAnalysisScope = {
  columnWeightScales: ReadonlySet<FukumenzanScale>;
  splitScales: ReadonlySet<FukumenzanScale>;
};

/**
 * 1問の分析。
 * - `invalid`: 解が1つでない。
 * - `unsupported`: 場合分けの重さを測れない。`cause` は、枝を閉包で読んでも許した場合分けで進めない（`stalled`）か、
 *   調べる盤面が上限を超えた（`frontier-cap`）か。
 * - `analyzed`: `splitCount` は、場合分けを測る規模の H2 で、枝を閉包で読む人と18手で追う人のどちらも上限の回数までで解けた
 *   ときの、18手で追う人の回数。どちらかが上限を超えたか進めなかったら `exceeded`。
 */
export type FukumenzanDifficultyAnalysis =
  | { status: "invalid" }
  | {
      status: "unsupported";
      cause: "stalled" | "frontier-cap";
      scale: FukumenzanScaleFeatures;
      readers: FukumenzanReaderResults;
    }
  | {
      status: "analyzed";
      scale: FukumenzanScaleFeatures;
      readers: FukumenzanReaderResults;
      readingClass: FukumenzanReadingClass;
      columnWeight: FukumenzanColumnWeight | null;
      splitCount: number | "exceeded" | null;
    };

/** 提供する場合分けの回数の上限。二択も三択も1回と数える。 */
export const FUKUMENZAN_SPLIT_LIMIT = 2;

const SPLIT_FRONTIER_LIMIT = 300;

const SPLIT_STEP_LIMIT = 18;

const noGroups = {
  adjacentPairs: null,
  adjacentTriples: null,
  sharedLetterPairs: null,
  separatedTriples: null,
  pairProductLimit: null,
  equations: null,
} as const satisfies Partial<FukumenzanReaderSettings>;

const weakColumnsSettings = {
  ...noGroups,
  column: { kind: "bounds-when-many", tupleLimit: 4 },
  hiddenSingles: false,
  nakedSubsets: false,
} as const satisfies FukumenzanReaderSettings;

const strongColumnsSettings = {
  ...noGroups,
  column: { kind: "all-tuples" },
  hiddenSingles: true,
  nakedSubsets: true,
} as const satisfies FukumenzanReaderSettings;

const weakPairsWithoutProductLimitSettings = {
  ...weakColumnsSettings,
  adjacentPairs: { kind: "joined", cap: 8 },
} as const satisfies FukumenzanReaderSettings;

const weakPairsSettings = {
  ...weakPairsWithoutProductLimitSettings,
  pairProductLimit: 50,
} as const satisfies FukumenzanReaderSettings;

const strongCombinedSettings = {
  ...strongColumnsSettings,
  adjacentPairs: {
    kind: "small-product-or-joined",
    productCap: 200,
    joinedCap: 50,
  },
  adjacentTriples: { kind: "joined", cap: 12 },
  sharedLetterPairs: { kind: "joined", cap: 50 },
  separatedTriples: { kind: "joined", cap: 12 },
} as const satisfies FukumenzanReaderSettings;

const strongEquationsSettings = {
  ...strongCombinedSettings,
  equations: {
    windows: [2, 3],
    includesAllColumns: true,
    includesDifferences: true,
    enumerationLimit: 3,
  },
} as const satisfies FukumenzanReaderSettings;

const weakLightColumnsSettings = {
  ...noGroups,
  column: { kind: "skip-when-many", tupleLimit: 4 },
  hiddenSingles: false,
  nakedSubsets: false,
} as const satisfies FukumenzanReaderSettings;

const strongLightColumnsSettings = {
  ...noGroups,
  column: { kind: "skip-when-many", tupleLimit: 12 },
  hiddenSingles: true,
  nakedSubsets: true,
} as const satisfies FukumenzanReaderSettings;

export function getFukumenzanScale(
  problem: FukumenzanProblem,
): FukumenzanScaleFeatures {
  const addendCount = problem.addends.length;
  const longestAddendLength = Math.max(
    ...problem.addends.map((addend) => addend.length),
  );
  const short = longestAddendLength <= 4;
  return {
    scale: addendCount === 2 ? (short ? "2s" : "2l") : short ? "3s" : "3l",
    addendCount,
    longestAddendLength,
    letterCount: new Set([...problem.addends, problem.result].join("")).size,
  };
}

function readOutcome(
  model: FukumenzanColumnModel,
  settings: FukumenzanReaderSettings,
): FukumenzanReaderOutcome {
  return solvesWithoutSplitting(
    createFukumenzanReader(model, settings),
    createInitialDomains(model),
  )
    ? "solved"
    : "stuck";
}

function countSplits(
  model: FukumenzanColumnModel,
  branch: FukumenzanSplitSearch["branch"],
): FukumenzanSplitCount {
  return countFukumenzanSplits({
    reader: createFukumenzanReader(model, weakPairsWithoutProductLimitSettings),
    branch,
    splitLimit: FUKUMENZAN_SPLIT_LIMIT,
    frontierLimit: SPLIT_FRONTIER_LIMIT,
  });
}

/** 読み手を、組が決まるまで安い順に当てる。 */
function measureReaders(
  model: FukumenzanColumnModel,
  scale: FukumenzanScale,
  { columnWeightScales, splitScales }: FukumenzanAnalysisScope,
): FukumenzanReaderResults {
  const weakColumns = readOutcome(model, weakColumnsSettings);
  if (weakColumns === "solved") {
    if (!columnWeightScales.has(scale)) {
      return { weakColumns };
    }
    const weakLightColumns = readOutcome(model, weakLightColumnsSettings);
    return weakLightColumns === "solved"
      ? { weakColumns, weakLightColumns }
      : {
          weakColumns,
          weakLightColumns,
          strongLightColumns: readOutcome(model, strongLightColumnsSettings),
        };
  }
  const strongColumns = readOutcome(model, strongColumnsSettings);
  if (strongColumns === "solved") {
    return { weakColumns, strongColumns };
  }
  const weakPairs = readOutcome(model, weakPairsSettings);
  if (weakPairs === "solved") {
    return { weakColumns, strongColumns, weakPairs };
  }
  const strongCombined = readOutcome(model, strongCombinedSettings);
  if (strongCombined === "solved") {
    return { weakColumns, strongColumns, weakPairs, strongCombined };
  }
  const strongEquations = readOutcome(model, strongEquationsSettings);
  const combined = {
    weakColumns,
    strongColumns,
    weakPairs,
    strongCombined,
    strongEquations,
  };
  if (strongEquations === "solved" || !splitScales.has(scale)) {
    return combined;
  }
  // 枝を閉包で読む人は18手で追う人より強いので、回数は18手で追う人以下になる。上限を超える問題を安く外す前置き。
  const splitsByClosure = countSplits(model, { kind: "closure" });
  if (
    typeof splitsByClosure !== "number" ||
    splitsByClosure < 1 ||
    splitsByClosure > FUKUMENZAN_SPLIT_LIMIT
  ) {
    return { ...combined, splitsByClosure };
  }
  return {
    ...combined,
    splitsByClosure,
    splitsBySteps: countSplits(model, {
      kind: "steps",
      stepLimit: SPLIT_STEP_LIMIT,
    }),
  };
}

function classifyReading(
  readers: FukumenzanReaderResults,
): FukumenzanReadingClass {
  if (readers.weakColumns === "solved") {
    return "E";
  }
  if (readers.strongColumns === "solved") {
    return "mE";
  }
  if (readers.weakPairs === "solved") {
    return "H1";
  }
  return readers.strongCombined === "solved" ||
    readers.strongEquations === "solved"
    ? "mH"
    : "H2";
}

function weighColumns({
  weakLightColumns,
  strongLightColumns,
}: FukumenzanReaderResults): FukumenzanColumnWeight | null {
  if (weakLightColumns === undefined) {
    return null;
  }
  if (weakLightColumns === "solved") {
    return "E1";
  }
  return strongLightColumns === "stuck" ? "E2" : "between";
}

function isWithinSplitLimit(count: FukumenzanSplitCount | undefined): boolean {
  return (
    typeof count === "number" && count >= 1 && count <= FUKUMENZAN_SPLIT_LIMIT
  );
}

/**
 * 一意解かを確かめ、読み手の族の端を当てて、読みの組・1桁の重さ・場合分けの回数を求める。
 * 1桁の重さと場合分けの回数は、`scope` が挙げる規模の盤面でだけ測る。
 */
export function analyzeFukumenzanDifficulty(
  problem: FukumenzanProblem,
  scope: FukumenzanAnalysisScope,
): FukumenzanDifficultyAnalysis {
  if (countFukumenzanSolutions(problem, 2).count !== 1) {
    return { status: "invalid" };
  }
  const model = createFukumenzanColumnModel(problem);
  const scale = getFukumenzanScale(problem);
  const readers = measureReaders(model, scale.scale, scope);
  const { splitsByClosure, splitsBySteps } = readers;
  if (splitsByClosure === "stalled") {
    return { status: "unsupported", cause: "stalled", scale, readers };
  }
  if (splitsByClosure === "frontier-cap" || splitsBySteps === "frontier-cap") {
    return { status: "unsupported", cause: "frontier-cap", scale, readers };
  }
  return {
    status: "analyzed",
    scale,
    readers,
    readingClass: classifyReading(readers),
    columnWeight: weighColumns(readers),
    splitCount:
      splitsByClosure === undefined
        ? null
        : isWithinSplitLimit(splitsByClosure) &&
            isWithinSplitLimit(splitsBySteps)
          ? (splitsBySteps as number)
          : "exceeded",
  };
}

/**
 * 入口の広さ。解き始めの盤面で、1桁ずつの読みの弱い端が各桁を1回ずつ読むだけで決まる文字の数。分類には使わず、分布を見る。
 */
export function countFukumenzanOpeningLetters(
  problem: FukumenzanProblem,
): number {
  const model = createFukumenzanColumnModel(problem);
  const reader = createFukumenzanReader(model, weakColumnsSettings);
  const initial = createInitialDomains(model);
  const decided = new Set<number>();
  for (let column = 0; column < model.columnCount; column += 1) {
    const facts = readFukumenzanColumn(reader, column, initial);
    if (facts === null) {
      continue;
    }
    for (let letter = 0; letter < model.letterCount; letter += 1) {
      if (digitCountOfMask[initial[letter]! & facts[letter]!] === 1) {
        decided.add(letter);
      }
    }
  }
  return decided.size;
}

export const _private = {
  readerSettings: {
    weakColumns: weakColumnsSettings,
    strongColumns: strongColumnsSettings,
    weakPairs: weakPairsSettings,
    strongCombined: strongCombinedSettings,
    strongEquations: strongEquationsSettings,
    weakLightColumns: weakLightColumnsSettings,
    strongLightColumns: strongLightColumnsSettings,
    splitBase: weakPairsWithoutProductLimitSettings,
  },
};
