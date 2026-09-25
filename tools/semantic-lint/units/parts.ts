import type { PartKind, Span } from "../domain/model.ts";

export type PartSpan = Span & { kind: PartKind };

type LinkedSpan = {
  id: string;
  span: Span;
  parentId?: string;
  /** カタログが指摘位置を宣言したunit。 */
  reported?: boolean;
};

/**
 * unitごとに違反箇所の候補（part）を決める。
 *
 * partはunit直下の文（ブロックの中で、unitとの間に別の文を挟まない文）と、unit直下の子unit。
 * 子unitを含む文はその子unitに置き換える（`test(...);` の文ではなくtest unitをpartにする）。
 * 文はカタログの `statement` unitのqueryで抽出したものを使い、言語やruleで分岐しない。
 *
 * 指摘位置を宣言したunit（変数宣言など）は違反箇所を問わないためpartを持たず、
 * 他のunitのpartや子unitとしても扱わない（その中の子unitは、宣言していない最も近い祖先の子とする）。
 */
export function unitParts(
  units: readonly LinkedSpan[],
  statements: readonly Span[],
): Map<string, PartSpan[]> {
  const sortedStatements = [...statements].sort(
    (left, right) => left.start - right.start || right.end - left.end,
  );
  const result = new Map<string, PartSpan[]>();
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const partParent = (unit: LinkedSpan): string | undefined => {
    let parentId = unit.parentId;

    while (parentId !== undefined && byId.get(parentId)?.reported) {
      parentId = byId.get(parentId)?.parentId;
    }

    return parentId;
  };

  for (const unit of units) {
    if (unit.reported) {
      result.set(unit.id, []);
      continue;
    }

    const children = units.filter(
      (other) => !other.reported && partParent(other) === unit.id,
    );
    const inner = sortedStatements.filter(
      (statement) =>
        contains(unit.span, statement) && !sameSpan(unit.span, statement),
    );
    const direct = outermost(inner);
    const parts: PartSpan[] = [];
    const placed = new Set<string>();

    for (const statement of direct) {
      const nested = children.filter((child) =>
        contains(statement, child.span),
      );

      if (nested.length === 0) {
        parts.push({ kind: "statement", ...statement });
        continue;
      }

      for (const child of nested) {
        parts.push({ kind: "unit", ...child.span });
        placed.add(child.id);
      }
    }

    for (const child of children) {
      if (!placed.has(child.id)) {
        parts.push({ kind: "unit", ...child.span });
      }
    }

    result.set(unit.id, dedupe(parts));
  }

  return result;
}

/** 他の文に含まれない文だけを残す。入力は開始位置の昇順・同じ開始なら長い順。 */
function outermost(statements: readonly Span[]): Span[] {
  const result: Span[] = [];

  for (const statement of statements) {
    const last = result.at(-1);

    if (last && contains(last, statement)) {
      continue;
    }

    result.push(statement);
  }

  return result;
}

function dedupe(parts: PartSpan[]): PartSpan[] {
  const seen = new Set<string>();

  return parts
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((part) => {
      const key = `${part.start}:${part.end}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function contains(outer: Span, inner: Span): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

function sameSpan(left: Span, right: Span): boolean {
  return left.start === right.start && left.end === right.end;
}
