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

export type ZukanFeatureAxisSource = {
  id: string;
  countRangeWidth?: number;
};

/** 数をまとめないときは `min` と `max` が同じ。 */
export type ZukanFeatureOption =
  | { kind: "count"; min: number; max: number }
  | { kind: "board-size"; rows: number; columns: number };

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

export type ZukanLevelFeatures = {
  valuesByProblem: ReadonlyMap<
    ProblemId,
    ReadonlyMap<string, ProblemFeatureValue>
  >;
  /** 選択肢が2つ以上ある軸だけを、軸の順に持つ。選択肢が1つの軸では問題を分けられない。 */
  axes: readonly ZukanFeatureAxisOptions[];
};

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
    // 特徴を求められない問題は、特徴の条件に当たらない。
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

export function createZukanLevelFeaturesCache(
  axes: readonly ZukanFeatureAxisSource[],
  findValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null,
): (
  difficulty: DifficultyLevel,
  problems: readonly ZukanProblem[],
) => ZukanLevelFeatures {
  // 問題集はゲームのホームを開いている間に変わらないので、絞り込みを閉じて開き直しても、離脱の保存で図鑑が導き直されても求め直さない。
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

export type ZukanPerformanceAxis = "mistakes" | "moves";

export type ZukanPerformanceCondition =
  | "no-mistakes"
  | "with-mistakes"
  | "optimal-moves"
  | "over-optimal-moves";

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

export function isZukanPerformanceConditionOfAxis(
  value: string,
  axis: ZukanPerformanceAxis,
): value is ZukanPerformanceCondition {
  const axisConditions: readonly string[] =
    zukanPerformanceConditionsByAxis[axis];
  return axisConditions.includes(value);
}

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

type ZukanFeatureAxisId = string;

type ZukanFeatureOptionKey = string;

/** どの種類も、空なら条件をかけない。 */
export type ZukanFilterConditions = {
  statuses: readonly ZukanProblemStatus[];
  features: Readonly<
    Record<ZukanFeatureAxisId, readonly ZukanFeatureOptionKey[]>
  >;
  performances: readonly ZukanPerformanceCondition[];
};

export const noZukanFilterConditions: ZukanFilterConditions = {
  statuses: [],
  features: {},
  performances: [],
};

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

export function hasZukanFeatureConditions({
  features,
}: ZukanFilterConditions): boolean {
  return Object.values(features).some((keys) => keys.length > 0);
}

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

/** 特徴の条件は、レベルの特徴 `levelFeatures` の選択肢と値で判定し、求めていなければどの問題も当たらない。 */
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

export type ZukanFilterOptionCounts = {
  statuses: Readonly<Record<ZukanProblemStatus, number>>;
  features: Readonly<
    Record<ZukanFeatureAxisId, Readonly<Record<ZukanFeatureOptionKey, number>>>
  >;
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

/** 種類（特徴と成績は軸）の中はどれかに当たればよいので、選択肢を選ぶと、少なくともこの数の問題が当たる。 */
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

export type ZukanArrangement = {
  /** 当たった問題を番号の順に前へ、当たらなかった問題を番号の順に後ろへ並べる。 */
  problems: readonly ZukanProblem[];
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
