import type { DifficultyLevel } from "@/games/difficulty";
import type { ProblemFeatureValue } from "@/games/problem-feature";
import type { ProblemId } from "@/games/problem-id";
import {
  countZukanProblemsByStatus,
  type GameZukan,
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";

/** 絞り込みで問題を分ける、問題の特徴の1つの軸。 */
export type ZukanFeatureAxisSource = {
  id: string;
  /** 1つのレベルの問題集にある値の種類が多いとき、数をまとめる幅。 */
  countRangeWidth?: number;
};

/** 特徴の軸の1つの選択肢。数は範囲（まとめないときは `min` と `max` が同じ）、盤面は大きさ。 */
export type ZukanFeatureOption =
  | { kind: "count"; min: number; max: number }
  | { kind: "board-size"; rows: number; columns: number };

/** 選択肢を見分けるキー。選んだ選択肢として持つ。 */
export function getZukanFeatureOptionKey(option: ZukanFeatureOption): string {
  return option.kind === "count"
    ? `count:${option.min}-${option.max}`
    : `board-size:${option.rows}x${option.columns}`;
}

export type ZukanFeatureAxisOptions = {
  axisId: string;
  /** 小さい値の順。 */
  options: readonly ZukanFeatureOption[];
};

/** 1つのレベルの全問の特徴の値と、その値から作った軸ごとの選択肢。 */
export type ZukanLevelFeatures = {
  valuesByProblem: ReadonlyMap<
    ProblemId,
    ReadonlyMap<string, ProblemFeatureValue>
  >;
  /** 選択肢が2つ以上ある軸だけを、軸の順に持つ。選択肢が1つの軸では問題を分けられない。 */
  axes: readonly ZukanFeatureAxisOptions[];
};

/** これより種類の多い数の値は、軸の幅でまとめる。 */
const MAX_EXACT_COUNT_OPTION_COUNT = 8;

function listCountOptions(
  counts: readonly number[],
  rangeWidth: number | undefined,
): ZukanFeatureOption[] {
  const distinct = [...new Set(counts)].sort((a, b) => a - b);
  if (
    distinct.length <= MAX_EXACT_COUNT_OPTION_COUNT ||
    rangeWidth === undefined
  ) {
    return distinct.map((count) => ({ kind: "count", min: count, max: count }));
  }
  const groups = new Map<number, number[]>();
  for (const count of distinct) {
    const group = Math.floor(count / rangeWidth);
    groups.set(group, [...(groups.get(group) ?? []), count]);
  }
  // 範囲は、問題集にある値の最小から最大までで示す。
  return [...groups.values()].map((group) => ({
    kind: "count",
    min: group[0] ?? 0,
    max: group.at(-1) ?? 0,
  }));
}

function listBoardSizeOptions(
  boardSizes: readonly { rows: number; columns: number }[],
): ZukanFeatureOption[] {
  const distinct = new Map<string, ZukanFeatureOption>();
  for (const { rows, columns } of boardSizes) {
    const option: ZukanFeatureOption = { kind: "board-size", rows, columns };
    distinct.set(getZukanFeatureOptionKey(option), option);
  }
  return [...distinct.values()].sort((a, b) =>
    a.kind === "board-size" && b.kind === "board-size"
      ? a.rows - b.rows || a.columns - b.columns
      : 0,
  );
}

function listAxisOptions(
  axis: ZukanFeatureAxisSource,
  values: readonly ProblemFeatureValue[],
): ZukanFeatureOption[] {
  const counts = values.flatMap((value) =>
    value.kind === "count" ? [value.count] : [],
  );
  const boardSizes = values.flatMap((value) =>
    value.kind === "board-size" ? [value] : [],
  );
  return [
    ...listBoardSizeOptions(boardSizes),
    ...listCountOptions(counts, axis.countRangeWidth),
  ];
}

/**
 * 1つのレベルの全問の特徴の値を求め、そのレベルの問題集にある値だけから軸ごとの選択肢を作る。
 * 特徴を求められない問題は、特徴の条件に当たらない。
 */
export function collectZukanLevelFeatures(
  problems: readonly ZukanProblem[],
  axes: readonly ZukanFeatureAxisSource[],
  findValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null,
): ZukanLevelFeatures {
  const valuesByProblem = new Map<
    ProblemId,
    ReadonlyMap<string, ProblemFeatureValue>
  >();
  for (const problem of problems) {
    const values = findValues(problem);
    if (values !== null) {
      valuesByProblem.set(problem.problemId, values);
    }
  }
  const levelValues = [...valuesByProblem.values()];
  return {
    valuesByProblem,
    axes: axes.flatMap((axis) => {
      const options = listAxisOptions(
        axis,
        levelValues.flatMap((values) => {
          const value = values.get(axis.id);
          return value === undefined ? [] : [value];
        }),
      );
      return options.length < 2 ? [] : [{ axisId: axis.id, options }];
    }),
  };
}

/**
 * レベルの特徴を、レベルごとに一度だけ求めて持っておく関数を作る。
 * 問題集はゲームのホームを開いている間に変わらないので、絞り込みを閉じて開き直しても、離脱の保存で図鑑が導き直されても求め直さない。
 */
export function createZukanLevelFeaturesCache(
  axes: readonly ZukanFeatureAxisSource[],
  findValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null,
): (
  difficulty: DifficultyLevel,
  problems: readonly ZukanProblem[],
) => ZukanLevelFeatures {
  const cache = new Map<DifficultyLevel, ZukanLevelFeatures>();
  return function findLevelFeatures(difficulty, problems) {
    const cached = cache.get(difficulty);
    if (cached !== undefined) {
      return cached;
    }
    const features = collectZukanLevelFeatures(problems, axes, findValues);
    cache.set(difficulty, features);
    return features;
  };
}

function isValueInOption(
  value: ProblemFeatureValue,
  option: ZukanFeatureOption,
): boolean {
  if (value.kind === "count") {
    return (
      option.kind === "count" &&
      option.min <= value.count &&
      value.count <= option.max
    );
  }
  return (
    option.kind === "board-size" &&
    option.rows === value.rows &&
    option.columns === value.columns
  );
}

/** 解いた問題の成績の軸。そのゲームが数える事実だけを持つ。 */
export type ZukanPerformanceAxis = "mistakes" | "moves";

/** 解いた問題の成績で絞る条件。成績は、その問題をクリアしたプレイの中で最も良い値で見る。 */
export type ZukanPerformanceCondition =
  | "no-mistakes"
  | "with-mistakes"
  | "optimal-moves"
  | "over-optimal-moves";

/** 成績の軸ごとの条件。特徴の軸と同じく、軸の中はどれかに、軸をまたいではすべてに当たる問題が当たる。 */
export const zukanPerformanceConditionsByAxis = {
  mistakes: ["no-mistakes", "with-mistakes"],
  moves: ["optimal-moves", "over-optimal-moves"],
} as const satisfies Record<
  ZukanPerformanceAxis,
  readonly ZukanPerformanceCondition[]
>;

const zukanPerformanceAxisOrder = Object.keys(
  zukanPerformanceConditionsByAxis,
) as ZukanPerformanceAxis[];

/** 値が成績の軸 `axis` の条件か。 */
export function isZukanPerformanceConditionOfAxis(
  value: string,
  axis: ZukanPerformanceAxis,
): value is ZukanPerformanceCondition {
  const axisConditions: readonly string[] =
    zukanPerformanceConditionsByAxis[axis];
  return axisConditions.includes(value);
}

/** 図鑑の解いた問題に、ミスや手数を数えた成績が1つでもあるときだけ、その成績の軸を返す。 */
export function listZukanPerformanceAxes(
  zukan: GameZukan,
): ZukanPerformanceAxis[] {
  const solvedProblems = zukan.sections.flatMap(({ problems }) =>
    problems.flatMap((problem) => (problem.kind === "solved" ? [problem] : [])),
  );
  return [
    ...(solvedProblems.some(({ fewestMistakes }) => fewestMistakes !== null)
      ? (["mistakes"] as const)
      : []),
    ...(solvedProblems.some(({ fewestMoves }) => fewestMoves !== null)
      ? (["moves"] as const)
      : []),
  ];
}

function meetsPerformance(
  problem: ZukanProblem,
  condition: ZukanPerformanceCondition,
): boolean {
  if (problem.kind !== "solved") {
    return false;
  }
  const { fewestMistakes, fewestMoves } = problem;
  switch (condition) {
    case "no-mistakes":
      return fewestMistakes === 0;
    case "with-mistakes":
      return fewestMistakes !== null && fewestMistakes > 0;
    case "optimal-moves":
      return (
        fewestMoves !== null &&
        fewestMoves.completionMoveCount <= fewestMoves.optimalMoveCount
      );
    case "over-optimal-moves":
      return (
        fewestMoves !== null &&
        fewestMoves.completionMoveCount > fewestMoves.optimalMoveCount
      );
  }
}

/** 絞り込みの条件。どの種類も、空なら条件をかけない。 */
export type ZukanFilterConditions = {
  statuses: readonly ZukanProblemStatus[];
  /** 特徴の軸の ID ごとに、選んだ選択肢のキー。 */
  features: Readonly<Record<string, readonly string[]>>;
  performances: readonly ZukanPerformanceCondition[];
};

export const noZukanFilterConditions: ZukanFilterConditions = {
  statuses: [],
  features: {},
  performances: [],
};

/** かけている条件（選んだ選択肢）の数。 */
export function countZukanFilterConditions({
  statuses,
  features,
  performances,
}: ZukanFilterConditions): number {
  return (
    statuses.length +
    Object.values(features).reduce((total, keys) => total + keys.length, 0) +
    performances.length
  );
}

/** 選んだ選択肢のある特徴の軸。 */
export function hasZukanFeatureConditions({
  features,
}: ZukanFilterConditions): boolean {
  return Object.values(features).some((keys) => keys.length > 0);
}

/** 成績の条件を軸ごとに分ける。条件を選んでいない軸は持たない。 */
function groupPerformanceConditions(
  performances: readonly ZukanPerformanceCondition[],
): ZukanPerformanceCondition[][] {
  return zukanPerformanceAxisOrder
    .map((axis) =>
      performances.filter((condition) =>
        isZukanPerformanceConditionOfAxis(condition, axis),
      ),
    )
    .filter((axisConditions) => axisConditions.length > 0);
}

/**
 * 条件に当たるかを判定する関数を作る。状態は選んだ中のどれかに、特徴と成績は軸ごとに選んだ選択肢のどれかに当たり、
 * それらをすべて満たす問題が当たる。成績の条件は解いた問題だけが当たる。
 * 特徴の条件は、レベルの特徴 `levelFeatures` の選択肢と値で判定し、求めていなければどの問題も当たらない。
 */
export function createZukanFilterMatcher(
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures | null,
): (problem: ZukanProblem) => boolean {
  const statuses = new Set(conditions.statuses);
  const performanceConditions = groupPerformanceConditions(
    conditions.performances,
  );
  const featureConditions = Object.entries(conditions.features)
    .filter(([, keys]) => keys.length > 0)
    .map(([axisId, keys]) => {
      const axisOptions = levelFeatures?.axes.find(
        (axis) => axis.axisId === axisId,
      );
      return {
        axisId,
        options: (axisOptions?.options ?? []).filter((option) =>
          keys.includes(getZukanFeatureOptionKey(option)),
        ),
      };
    });

  return function matches(problem) {
    if (statuses.size > 0 && !statuses.has(getZukanProblemStatus(problem))) {
      return false;
    }
    if (
      !performanceConditions.every((axisConditions) =>
        axisConditions.some((condition) =>
          meetsPerformance(problem, condition),
        ),
      )
    ) {
      return false;
    }
    const values = levelFeatures?.valuesByProblem.get(problem.problemId);
    return featureConditions.every(({ axisId, options }) => {
      const value = values?.get(axisId);
      return (
        value !== undefined &&
        options.some((option) => isValueInOption(value, option))
      );
    });
  };
}

/** 選択肢ごとの、当たる問題の数。 */
export type ZukanFilterOptionCounts = {
  statuses: Readonly<Record<ZukanProblemStatus, number>>;
  /** 特徴の軸の ID ごとに、選択肢のキーごとの数。 */
  features: Readonly<Record<string, Readonly<Record<string, number>>>>;
  performances: Readonly<Record<ZukanPerformanceCondition, number>>;
};

function countFeatureOptions(
  problems: readonly ZukanProblem[],
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures,
): Record<string, Record<string, number>> {
  return Object.fromEntries(
    levelFeatures.axes.map(({ axisId, options }) => {
      const matchesOthers = createZukanFilterMatcher(
        { ...conditions, features: { ...conditions.features, [axisId]: [] } },
        levelFeatures,
      );
      const counts: Record<string, number> = Object.fromEntries(
        options.map((option) => [getZukanFeatureOptionKey(option), 0]),
      );
      for (const problem of problems.filter(matchesOthers)) {
        const value = levelFeatures.valuesByProblem
          .get(problem.problemId)
          ?.get(axisId);
        const option =
          value === undefined
            ? undefined
            : options.find((candidate) => isValueInOption(value, candidate));
        if (option !== undefined) {
          const key = getZukanFeatureOptionKey(option);
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
      return [axisId, counts];
    }),
  );
}

function countPerformanceConditions(
  problems: readonly ZukanProblem[],
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures | null,
): Record<ZukanPerformanceCondition, number> {
  const counts: Record<ZukanPerformanceCondition, number> = {
    "no-mistakes": 0,
    "with-mistakes": 0,
    "optimal-moves": 0,
    "over-optimal-moves": 0,
  };
  for (const axis of zukanPerformanceAxisOrder) {
    const matchesOthers = createZukanFilterMatcher(
      {
        ...conditions,
        performances: conditions.performances.filter(
          (condition) => !isZukanPerformanceConditionOfAxis(condition, axis),
        ),
      },
      levelFeatures,
    );
    const axisConditions = zukanPerformanceConditionsByAxis[axis];
    for (const problem of problems) {
      if (!matchesOthers(problem)) {
        continue;
      }
      for (const condition of axisConditions) {
        if (meetsPerformance(problem, condition)) {
          counts[condition] += 1;
        }
      }
    }
  }
  return counts;
}

/**
 * 選択肢ごとに、その選択肢とほかの種類の条件に当たる問題を数える。同じ種類（特徴と成績は同じ軸）で選んでいるほかの選択肢は数に関わらない。
 * 種類（特徴と成績は軸）の中はどれかに当たればよいので、選択肢を選ぶと、少なくともこの数の問題が当たる。
 * 特徴の選択肢は、レベルの特徴 `levelFeatures` を求めているときだけ数える。
 */
export function countZukanFilterOptions(
  problems: readonly ZukanProblem[],
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures | null,
): ZukanFilterOptionCounts {
  return {
    statuses: countZukanProblemsByStatus(
      problems.filter(
        createZukanFilterMatcher(
          { ...conditions, statuses: [] },
          levelFeatures,
        ),
      ),
    ),
    features:
      levelFeatures === null
        ? {}
        : countFeatureOptions(problems, conditions, levelFeatures),
    performances: countPerformanceConditions(
      problems,
      conditions,
      levelFeatures,
    ),
  };
}

/** 絞り込みで並べ替えた台紙の問題。 */
export type ZukanArrangement = {
  /** 当たった問題を番号の順に前へ、当たらなかった問題を番号の順に後ろへ並べる。 */
  problems: readonly ZukanProblem[];
  /** 前に並べた、当たった問題の数。 */
  matchedCount: number;
};

/** 番号の順に並んだ問題を、当たった問題を前へ詰めて並べ替える。 */
export function arrangeZukanProblems(
  problems: readonly ZukanProblem[],
  matches: (problem: ZukanProblem) => boolean,
): ZukanArrangement {
  const matched: ZukanProblem[] = [];
  const unmatched: ZukanProblem[] = [];
  for (const problem of problems) {
    (matches(problem) ? matched : unmatched).push(problem);
  }
  return {
    problems: [...matched, ...unmatched],
    matchedCount: matched.length,
  };
}
