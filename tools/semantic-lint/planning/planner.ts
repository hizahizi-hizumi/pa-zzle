import type {
  EvaluationPlan,
  EvaluationTask,
  PlannedFile,
  PlannedUnit,
  Rule,
  SourceDocument,
} from "../domain/model.ts";
import type { UnitExtractor } from "../units/extract.ts";
import { LineIndex } from "../units/position.ts";
import { unitParts } from "../units/parts.ts";
import { linkUnits } from "../units/structure.ts";

/** 違反箇所の候補（part）に使う文のunit。カタログの語彙。 */
const PART_STATEMENT_UNIT = "statement";

/** ruleの対象pathか。`paths` のどれかに一致し、`exclude` のどれにも一致しないもの。 */
export type PathMatcher = (
  rule: Pick<Rule, "paths" | "exclude">,
  path: string,
) => boolean;

/** カタログに言語がないfileで使う目印。file unitだけを抽出するため通常は使われない。 */
const DEFAULT_MARKER = "/* {ref} */";

export function buildEvaluationPlan(options: {
  documents: SourceDocument[];
  rules: Rule[];
  extractor: UnitExtractor;
  matchesPath: PathMatcher;
}): EvaluationPlan {
  const { documents, rules, extractor, matchesPath } = options;
  const files: PlannedFile[] = [];

  for (const document of [...documents].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const matchingRules = rules
      .filter((rule) => matchesPath(rule, document.path))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (matchingRules.length === 0) {
      continue;
    }

    const units = planUnits(
      document,
      [...new Set(matchingRules.map((rule) => rule.unit))],
      extractor,
    );
    const tasks: EvaluationTask[] = [];

    for (const rule of matchingRules) {
      for (const unit of units) {
        if (unit.unit !== rule.unit) {
          continue;
        }

        tasks.push({
          id: taskId(rule.id, unit.id),
          ruleId: rule.id,
          subjectId: unit.id,
        });
      }
    }

    files.push({
      path: document.path,
      source: document.source,
      marker:
        extractor.catalog.languageFor(document.path)?.marker ?? DEFAULT_MARKER,
      units,
      tasks,
    });
  }

  return { files };
}

/** fileから指定unitを抽出し、出現順に入れ子・文脈・違反箇所の候補を付けて並べる。 */
export function planUnits(
  document: SourceDocument,
  unitNames: readonly string[],
  extractor: UnitExtractor,
): PlannedUnit[] {
  const extracted = extractor.extract(document, [
    ...new Set([...unitNames, PART_STATEMENT_UNIT]),
  ]);
  const lines = new LineIndex(document.source);
  const items = unitNames.flatMap((unit) =>
    (extracted.get(unit) ?? []).map((item, index) => ({
      id: subjectId(unit, document.path, index),
      item,
    })),
  );
  const links = linkUnits(
    items.map(({ id, item }) => ({
      id,
      unit: item.unit,
      span: { start: item.start, end: item.end },
      scope: item.scope,
    })),
    extractor.catalog,
  );

  const parts = unitParts(
    items.map(({ id, item }) => {
      const parentId = links.get(id)?.parentId;

      return {
        id,
        span: { start: item.start, end: item.end },
        ...(parentId === undefined ? {} : { parentId }),
        ...(item.report === undefined ? {} : { reported: true }),
      };
    }),
    extracted.get(PART_STATEMENT_UNIT) ?? [],
  );

  return items
    .map(({ id, item }): PlannedUnit => {
      const link = links.get(id);

      return {
        id,
        unit: item.unit,
        path: document.path,
        range: lines.range(item),
        ...(item.symbol === undefined ? {} : { symbol: item.symbol }),
        source: document.source.slice(item.start, item.end),
        ...(item.report === undefined
          ? {}
          : {
              reportRange: lines.range(item.report),
              reportSpan: { start: item.report.start, end: item.report.end },
            }),
        span: { start: item.start, end: item.end },
        parts: (parts.get(id) ?? []).map(({ kind, start, end }) => ({
          kind,
          span: { start, end },
          range: lines.range({ start, end }),
        })),
        ...(link?.parentId === undefined ? {} : { parentId: link.parentId }),
        contextIds: link?.contextIds ?? [],
      };
    })
    .sort(
      (left, right) =>
        left.span.start - right.span.start || right.span.end - left.span.end,
    );
}

export function bunGlobPathMatcher(
  rule: Pick<Rule, "paths" | "exclude">,
  path: string,
): boolean {
  return matchesAnyGlob(rule.paths, path) && !matchesAnyGlob(rule.exclude, path);
}

export function matchesAnyGlob(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(path));
}

export function subjectId(unit: string, path: string, index: number): string {
  return `${unit}:${path}:${index}`;
}

function taskId(ruleId: string, subjectId: string): string {
  return `${ruleId}::${subjectId}`;
}
