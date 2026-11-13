export type ProblemFeatureValue =
  | { kind: "count"; count: number }
  | { kind: "board-size"; rows: number; columns: number };

export type ProblemFeatureAxis<Features, Id extends string = string> = {
  id: Id;
  getValue(features: Features): ProblemFeatureValue;
};

export function createCountFeatureValue(count: number): ProblemFeatureValue {
  return { kind: "count", count };
}

export function createBoardSizeFeatureValue(
  rows: number,
  columns: number,
): ProblemFeatureValue {
  return { kind: "board-size", rows, columns };
}
