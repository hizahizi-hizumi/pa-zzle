import type { PlannedUnit, SourceDocument, Span } from "../domain/model.ts";

/** 判定対象のunit。本文はstate.file.sourceの中で開始・終了の目印に囲まれている。 */
export type StateSubject = {
  unit: string;
  symbol?: string;
};

export type DecisionState = {
  file: SourceDocument;
  subjects: Record<string, StateSubject>;
};

const OMITTED_REF = "omitted";
const CONTEXT_KEY_REF = "unit";

type UnitNode = {
  unit: PlannedUnit;
  children: UnitNode[];
};

/**
 * fileを元の並びのまま1回だけ載せ、stateへ含めるunitを開始・終了の目印で囲んだ判定stateを作る。
 *
 * 入れ子のunitも親の本文の中にそのまま現れるため、親の判定で子の本文を参照先から辿る必要がない。
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
  const subjects: Record<string, StateSubject> = {};

  for (const unit of units) {
    if (included.has(unit.id)) {
      const key = keyPrefix + keys.size;
      keys.set(unit.id, key);
      subjects[key] = {
        unit: unit.unit,
        ...(unit.symbol === undefined ? {} : { symbol: unit.symbol }),
      };
    }
  }

  const { roots } = buildTree(units);
  const markerFor = (unit: PlannedUnit): string | undefined =>
    keys.has(unit.id) ? undefined : renderMarker(marker, OMITTED_REF);
  const wrap = (unit: PlannedUnit, body: string): string => {
    const key = keys.get(unit.id);

    return key === undefined
      ? body
      : renderMarker(marker, subjectBoundary(key, "begin")) +
          body +
          renderMarker(marker, subjectBoundary(key, "end"));
  };

  return {
    state: {
      file: {
        path: file.path,
        source: renderSpan(
          file.source,
          { start: 0, end: file.source.length },
          roots,
          markerFor,
          wrap,
        ),
      },
      subjects,
    },
    keys,
  };
}

/** 判定stateから、目印を除いたfileと各subjectの本文を取り出す。省略したunitは目印のまま残る。 */
export function expandDecisionState(
  state: DecisionState,
  marker: string,
): { file: string; subjects: Record<string, string> } {
  const boundaries = Object.keys(state.subjects).flatMap((key) => [
    renderMarker(marker, subjectBoundary(key, "begin")),
    renderMarker(marker, subjectBoundary(key, "end")),
  ]);
  const strip = (text: string): string =>
    boundaries.reduce((result, boundary) => result.split(boundary).join(""), text);

  return {
    file: strip(state.file.source),
    subjects: Object.fromEntries(
      Object.keys(state.subjects).map((key) => {
        const begin = renderMarker(marker, subjectBoundary(key, "begin"));
        const end = renderMarker(marker, subjectBoundary(key, "end"));
        const from = state.file.source.indexOf(begin);
        const to = state.file.source.indexOf(end);

        return [
          key,
          from < 0 || to < 0
            ? ""
            : strip(state.file.source.slice(from + begin.length, to)),
        ];
      }),
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

/**
 * spanのsourceを書き出す。目印を返す子unitは目印に置き換え、undefinedを返す子unitは中へ進んで
 * `wrap` で囲む。
 */
function renderSpan(
  source: string,
  span: Span,
  children: readonly UnitNode[],
  markerFor: (unit: PlannedUnit) => string | undefined,
  wrap: (unit: PlannedUnit, body: string) => string = (_, body) => body,
): string {
  let output = "";
  let cursor = span.start;

  for (const child of children) {
    output += source.slice(cursor, child.unit.span.start);
    output +=
      markerFor(child.unit) ??
      wrap(
        child.unit,
        renderSpan(source, child.unit.span, child.children, markerFor, wrap),
      );
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

function subjectBoundary(key: string, edge: "begin" | "end"): string {
  return `${subjectRef(key)} ${edge}`;
}

function containsSpan(outer: Span, inner: Span): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}
