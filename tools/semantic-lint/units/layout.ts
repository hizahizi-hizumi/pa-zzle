import type { PlannedUnit, SourceDocument, Span } from "../domain/model.ts";

/** 判定stateに1回だけ載せるunit。入れ子のunitは目印に置き換えてある。 */
export type StateSubject = {
  unit: string;
  symbol?: string;
  source: string;
};

export type DecisionState = {
  file: SourceDocument;
  subjects: Record<string, StateSubject>;
};

/** file全体を覆うunitのsource。file全体はstate.fileに載せるため参照だけにする。 */
export const WHOLE_FILE_SOURCE = "(= state.file.source)";

const OMITTED_REF = "omitted";
const CONTEXT_KEY_REF = "unit";

type UnitNode = {
  unit: PlannedUnit;
  children: UnitNode[];
};

/**
 * fileを骨格とunit本文に分けた判定stateを作る。
 *
 * fileの各文字はstate.file.sourceかいずれか1つのsubjectのsourceにだけ現れる。
 * `subjectIds` にないunitは本文を載せず、省略の目印だけを残す。
 */
export function buildDecisionState(options: {
  file: SourceDocument;
  marker: string;
  units: readonly PlannedUnit[];
  subjectIds: readonly string[];
}): { state: DecisionState; keys: Map<string, string> } {
  const { file, marker, units, subjectIds } = options;
  const included = new Set(subjectIds);
  const keyPrefix = unusedKeyPrefix(file.source);
  const keys = new Map<string, string>();

  for (const unit of units) {
    if (included.has(unit.id)) {
      keys.set(unit.id, keyPrefix + keys.size);
    }
  }

  const markerFor = (unit: PlannedUnit): string | undefined => {
    if (coversFile(unit, file.source)) {
      return undefined;
    }

    const key = keys.get(unit.id);

    return renderMarker(
      marker,
      key === undefined ? OMITTED_REF : subjectRef(key),
    );
  };
  const { roots, nodes } = buildTree(units);
  const subjects: Record<string, StateSubject> = {};

  for (const [id, key] of keys) {
    const node = nodes.get(id);

    if (!node) {
      continue;
    }

    subjects[key] = {
      unit: node.unit.unit,
      ...(node.unit.symbol === undefined ? {} : { symbol: node.unit.symbol }),
      source: coversFile(node.unit, file.source)
        ? WHOLE_FILE_SOURCE
        : renderSpan(file.source, node.unit.span, node.children, markerFor),
    };
  }

  return {
    state: {
      file: {
        path: file.path,
        source: renderSpan(
          file.source,
          { start: 0, end: file.source.length },
          roots,
          markerFor,
        ),
      },
      subjects,
    },
    keys,
  };
}

/** 判定stateの目印を本文へ戻す。省略したunitは目印のまま残る。 */
export function expandDecisionState(
  state: DecisionState,
  marker: string,
): { file: string; subjects: Record<string, string> } {
  const expand = (text: string, seen: ReadonlySet<string>): string =>
    Object.entries(state.subjects).reduce((result, [key, subject]) => {
      const target = renderMarker(marker, subjectRef(key));

      if (!result.includes(target) || seen.has(key)) {
        return result;
      }

      return result
        .split(target)
        .join(expand(subject.source, new Set([...seen, key])));
    }, text);
  const file = expand(state.file.source, new Set());

  return {
    file,
    subjects: Object.fromEntries(
      Object.entries(state.subjects).map(([key, subject]) => [
        key,
        subject.source === WHOLE_FILE_SOURCE
          ? file
          : expand(subject.source, new Set([key])),
      ]),
    ),
  };
}

/**
 * stateへ本文を載せるunit。判定対象とその子孫・祖先、カタログのcontext宣言が指すunitを含める。
 * 子孫は判定対象の本文の一部なので省略しない。祖先を含めることで、載せたunitが省略したunitの中に入らないようにする。
 */
export function subjectClosure(
  units: readonly PlannedUnit[],
  targetIds: Iterable<string>,
): string[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const selected = new Set<string>();
  const targets = [...targetIds]
    .map((id) => byId.get(id))
    .filter((unit): unit is PlannedUnit => unit !== undefined);

  for (const unit of units) {
    if (targets.some((target) => isDescendant(unit, target, byId))) {
      selected.add(unit.id);
    }
  }

  const addWithAncestors = (id: string | undefined): void => {
    for (
      let unit = id === undefined ? undefined : byId.get(id);
      unit && !selected.has(unit.id);
      unit = unit.parentId === undefined ? undefined : byId.get(unit.parentId)
    ) {
      selected.add(unit.id);
    }
  };

  for (const { id } of targets) {
    addWithAncestors(id);

    for (const contextId of byId.get(id)?.contextIds ?? []) {
      addWithAncestors(contextId);
    }
  }

  return units.filter((unit) => selected.has(unit.id)).map((unit) => unit.id);
}

function isDescendant(
  unit: PlannedUnit,
  ancestor: PlannedUnit,
  byId: ReadonlyMap<string, PlannedUnit>,
): boolean {
  for (
    let parent = unit.parentId === undefined ? undefined : byId.get(unit.parentId);
    parent;
    parent = parent.parentId === undefined ? undefined : byId.get(parent.parentId)
  ) {
    if (parent.id === ancestor.id) {
      return true;
    }
  }

  return false;
}

/**
 * unitの判定が依存する文脈をfile上に並べた文字列。判定cacheのkeyに使う。
 *
 * 対象unitとその本文、祖先、context宣言が指すunit、どのunitにも含まれない骨格を残し、
 * それ以外のunitは位置だけを示す共通の目印にする。
 */
export function unitContextView(options: {
  file: SourceDocument;
  marker: string;
  units: readonly PlannedUnit[];
  target: PlannedUnit;
}): string {
  const { file, marker, units, target } = options;
  const visible = new Set(subjectClosure(units, [target.id]));
  const { roots } = buildTree(units);
  const elided = renderMarker(marker, CONTEXT_KEY_REF);

  const markerFor = (unit: PlannedUnit): string | undefined =>
    visible.has(unit.id) || containsSpan(target.span, unit.span)
      ? undefined
      : elided;

  return renderSpan(
    file.source,
    { start: 0, end: file.source.length },
    roots,
    markerFor,
  );
}

function buildTree(units: readonly PlannedUnit[]): {
  roots: UnitNode[];
  nodes: Map<string, UnitNode>;
} {
  const nodes = new Map(
    units.map((unit) => [unit.id, { unit, children: [] as UnitNode[] }]),
  );
  const roots: UnitNode[] = [];

  for (const node of nodes.values()) {
    const parent =
      node.unit.parentId === undefined
        ? undefined
        : nodes.get(node.unit.parentId);

    (parent?.children ?? roots).push(node);
  }

  return { roots, nodes };
}

/** spanのsourceを、子unitを目印に置き換えて書き出す。目印がundefinedの子unitは中へ進む。 */
function renderSpan(
  source: string,
  span: Span,
  children: readonly UnitNode[],
  markerFor: (unit: PlannedUnit) => string | undefined,
): string {
  let output = "";
  let cursor = span.start;

  for (const child of children) {
    output += source.slice(cursor, child.unit.span.start);
    output +=
      markerFor(child.unit) ??
      renderSpan(source, child.unit.span, child.children, markerFor);
    cursor = child.unit.span.end;
  }

  return output + source.slice(cursor, span.end);
}

/** 目印を本文へ戻すときに取り違えないよう、sourceに現れない参照名を選ぶ。 */
function unusedKeyPrefix(source: string): string {
  for (let attempt = 0; ; attempt += 1) {
    const prefix = attempt === 0 ? "s" : `s${attempt}_`;

    if (!source.includes(subjectRef(prefix))) {
      return prefix;
    }
  }
}

function renderMarker(marker: string, ref: string): string {
  return marker.replace("{ref}", ref);
}

function subjectRef(key: string): string {
  return `state.subjects.${key}`;
}

function coversFile(unit: PlannedUnit, source: string): boolean {
  return unit.span.start === 0 && unit.span.end === source.length;
}

function containsSpan(outer: Span, inner: Span): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}
