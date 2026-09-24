import type { Span } from "../domain/model.ts";
import type { UnitCatalog } from "./catalog.ts";

export type StructuredUnit = {
  id: string;
  unit: string;
  span: Span;
  /** unitを直接囲むscope。 */
  scope: Span;
};

export type UnitLinks = {
  parentId?: string;
  contextIds: string[];
};

/**
 * 同じfileのunitについて、入れ子の親とカタログのcontext宣言による文脈を決める。
 * 同じ範囲のunitが複数あるときは、先に並んでいるunitを外側とする。
 */
export function linkUnits(
  units: readonly StructuredUnit[],
  catalog: UnitCatalog,
): Map<string, UnitLinks> {
  const ordered = units
    .map((unit, index) => ({ unit, index }))
    .sort(
      (left, right) =>
        left.unit.span.start - right.unit.span.start ||
        right.unit.span.end - left.unit.span.end ||
        left.index - right.index,
    )
    .map(({ unit }) => unit);
  const links = new Map<string, UnitLinks>();
  const stack: StructuredUnit[] = [];

  for (const unit of ordered) {
    while (stack.length > 0 && !contains(stack.at(-1)?.span, unit.span)) {
      stack.pop();
    }

    const parent = stack.at(-1);
    links.set(unit.id, {
      ...(parent === undefined ? {} : { parentId: parent.id }),
      contextIds: [],
    });
    stack.push(unit);
  }

  for (const unit of ordered) {
    const declarations = catalog.unit(unit.unit).context;
    const contextIds = new Set<string>();

    for (const declaration of declarations) {
      for (const other of ordered) {
        if (other.id === unit.id || other.unit !== declaration.unit) {
          continue;
        }

        const related =
          declaration.scope === "file" ||
          (declaration.scope === "outer" && contains(other.scope, unit.span)) ||
          (declaration.scope === "inner" && contains(unit.scope, other.span));

        if (related) {
          contextIds.add(other.id);
        }
      }
    }

    const link = links.get(unit.id);

    if (link) {
      link.contextIds = ordered
        .filter((other) => contextIds.has(other.id))
        .map((other) => other.id);
    }
  }

  return links;
}

function contains(outer: Span | undefined, inner: Span): boolean {
  return (
    outer !== undefined && outer.start <= inner.start && inner.end <= outer.end
  );
}
