import type { PartKind, SourceRange } from "../domain/model.ts";

/**
 * 違反と判定したunitで、partを違反箇所として指摘する確率の下限。
 * ruleごとには変えず、golden benchmarkで校正した値を全ruleに使う。
 */
export const PART_VIOLATION_THRESHOLD = 0.5;

type LineRange = Pick<SourceRange, "startLine" | "endLine">;

export type LocatablePart<R extends LineRange> = {
  kind: PartKind;
  range: R;
  probability: number;
};

export type LocatedRange<R extends LineRange> = {
  range: R;
  /** 違反箇所として選んだpartの確率（結合したときは最大値）。unit全体ならundefined。 */
  probability?: number;
};

/**
 * 違反と判定したunitの指摘範囲を決める。
 *
 * - 確率が `threshold` 以上のpartを違反箇所として指摘する。
 * - 連続して選ばれた子unit（describeの中の兄弟testなど）は1つの範囲に結合する。
 *   兄弟の関係そのものが違反になる規約で、組を1つの指摘にするため。
 *   文は1つずつ別の指摘にする。
 * - どのpartも選ばれない、またはpartがないときはunit全体を指摘する。
 */
export function locateViolation<R extends LineRange>(
  subjectRange: R,
  parts: ReadonlyArray<LocatablePart<R>> | undefined,
  threshold: number = PART_VIOLATION_THRESHOLD,
): Array<LocatedRange<R>> {
  const located: Array<LocatedRange<R>> = [];
  let previousSelectedUnit = false;

  for (const part of parts ?? []) {
    if (part.probability < threshold) {
      previousSelectedUnit = false;
      continue;
    }

    const last = located.at(-1);

    if (part.kind === "unit" && previousSelectedUnit && last) {
      last.range = extendRange(last.range, part.range);
      last.probability = Math.max(last.probability ?? 0, part.probability);
    } else {
      located.push({ range: part.range, probability: part.probability });
    }

    previousSelectedUnit = part.kind === "unit";
  }

  return located.length > 0 ? located : [{ range: subjectRange }];
}

/** `first` の開始から `last` の終了までの範囲。列があれば列も引き継ぐ。 */
function extendRange<R extends LineRange>(first: R, last: R): R {
  const end: Partial<SourceRange> = { endLine: last.endLine };

  if ("endColumn" in last) {
    end.endColumn = (last as unknown as SourceRange).endColumn;
  }

  return { ...first, ...end };
}
