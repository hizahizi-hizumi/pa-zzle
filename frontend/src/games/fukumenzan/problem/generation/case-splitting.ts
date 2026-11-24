import {
  areAllLettersDecided,
  createInitialDomains,
  digitCountOfMask,
  digitsOfMask,
  getCarryInVariable,
  getCarryOutVariable,
  getDomainsKey,
} from "@/games/fukumenzan/problem/generation/column-model";
import {
  closeFukumenzanDomains,
  type FukumenzanColumnGroup,
  type FukumenzanFacts,
  type FukumenzanReader,
  readFukumenzanColumn,
  readFukumenzanGroup,
  readFukumenzanTable,
} from "@/games/fukumenzan/problem/generation/column-readers";

/**
 * 場合分けの枝の読み方。
 * - `closure`: 枝を読み手の閉包で読み切る。
 * - `steps`: 枝を人の手で `stepLimit` 手まで追う。1手は1つの規則から1つの変数の候補を減らすこと（1つの事実）で、
 *   1つの桁と表から出す事実は1手、まとめて読む桁の組から出す事実はその桁の数の手。1つの規則から出る事実はまとめて出し、
 *   その数×重みを手に数える（要らない事実も数えるので、人が要る事実だけを選ぶ手より多いか同じ）。
 */
export type FukumenzanBranchReading =
  | { kind: "closure" }
  | { kind: "steps"; stepLimit: number };

/**
 * 場合分けの回数。
 * - 数: 二択も三択も1回と数えた、全部の文字が決まるまでの最短の回数。
 * - `exceeded`: 上限の回数まで調べ尽くしても決まらない。
 * - `stalled`: 許した場合分けがどれも何も消さず、進めない。
 * - `frontier-cap`: 最後の回より前に、調べる盤面が上限を超えて打ち切った。
 */
export type FukumenzanSplitCount =
  | number
  | "exceeded"
  | "stalled"
  | "frontier-cap";

export type FukumenzanSplitSearch = {
  reader: FukumenzanReader;
  branch: FukumenzanBranchReading;
  splitLimit: number;
  frontierLimit: number;
};

type Rule = {
  variables: number;
  weight: number;
  column: number | null;
  group: FukumenzanColumnGroup | null;
};

function toBits(variables: Iterable<number>): number {
  let bits = 0;
  for (const variable of variables) {
    bits |= 1 << variable;
  }
  return bits;
}

function listRules(reader: FukumenzanReader): Rule[] {
  const { model } = reader;
  function columnVariables(column: number): number[] {
    return [
      ...model.columnLetters[column]!,
      getCarryInVariable(model, column),
      getCarryOutVariable(model, column),
    ];
  }
  return [
    ...Array.from(
      { length: model.columnCount },
      (_, column): Rule => ({
        variables: toBits(columnVariables(column)),
        weight: 1,
        column,
        group: null,
      }),
    ),
    ...reader.groups.map(
      (group): Rule => ({
        variables: toBits(group.columns.flatMap(columnVariables)),
        weight: group.columns.length,
        column: null,
        group,
      }),
    ),
    {
      variables: toBits(
        Array.from({ length: model.letterCount }, (_, letter) => letter),
      ),
      weight: 1,
      column: null,
      group: null,
    },
  ];
}

function readRule(
  reader: FukumenzanReader,
  { column, group }: Rule,
  domains: readonly number[],
): FukumenzanFacts {
  if (column !== null) {
    return readFukumenzanColumn(reader, column, domains);
  }
  if (group !== null) {
    return readFukumenzanGroup(reader, group, domains);
  }
  return readFukumenzanTable(reader, domains);
}

type QueuedState = {
  cost: number;
  order: number;
  domains: readonly number[];
  key: string;
  changed: number;
};

function precedes(left: QueuedState, right: QueuedState): boolean {
  return left.cost !== right.cost
    ? left.cost < right.cost
    : left.order < right.order;
}

/** 手の少ない順（同じ手なら積んだ順）に取り出す二分ヒープへ積む。 */
function pushState(queue: QueuedState[], item: QueuedState): void {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (!precedes(queue[index]!, queue[parent]!)) {
      break;
    }
    [queue[index], queue[parent]] = [queue[parent]!, queue[index]!];
    index = parent;
  }
}

function popState(queue: QueuedState[]): QueuedState {
  const top = queue[0]!;
  const last = queue.pop()!;
  if (queue.length === 0) {
    return top;
  }
  queue[0] = last;
  let index = 0;
  for (;;) {
    const left = 2 * index + 1;
    const right = left + 1;
    let first = index;
    if (left < queue.length && precedes(queue[left]!, queue[first]!)) {
      first = left;
    }
    if (right < queue.length && precedes(queue[right]!, queue[first]!)) {
      first = right;
    }
    if (first === index) {
      return top;
    }
    [queue[index], queue[first]] = [queue[first]!, queue[index]!];
    index = first;
  }
}

/**
 * 値を1つ置いた枝を、手の少ない順に `stepLimit` 手まで追い、矛盾が見つかるかを返す。同じ盤面は少ない手で着いたものだけを残す。
 * 規則は、置く前の盤面（`base`）から変わった変数に触れるものだけを当てる。
 */
function findsContradictionWithinSteps(
  reader: FukumenzanReader,
  rules: readonly Rule[],
  start: readonly number[],
  base: readonly number[],
  stepLimit: number,
): boolean {
  const startKey = getDomainsKey(start);
  const best = new Map<string, number>([[startKey, 0]]);
  const queue: QueuedState[] = [];
  let order = 0;
  pushState(queue, {
    cost: 0,
    order,
    domains: start,
    key: startKey,
    changed: toBits(
      start.flatMap((mask, variable) =>
        mask !== base[variable] ? [variable] : [],
      ),
    ),
  });
  while (queue.length > 0) {
    const { cost, domains, key, changed } = popState(queue);
    if ((best.get(key) ?? Number.POSITIVE_INFINITY) < cost) {
      continue;
    }
    for (const rule of rules) {
      if (!(rule.variables & changed) || cost + rule.weight > stepLimit) {
        continue;
      }
      const facts = readRule(reader, rule, domains);
      if (facts === null) {
        return true;
      }
      const next = [...domains];
      let newlyChanged = 0;
      let factCount = 0;
      for (const [variable, mask] of facts.entries()) {
        const narrowed = domains[variable]! & mask;
        if (narrowed !== domains[variable]) {
          if (narrowed === 0) {
            return true;
          }
          next[variable] = narrowed;
          newlyChanged |= 1 << variable;
          factCount += 1;
        }
      }
      if (factCount === 0) {
        continue;
      }
      const nextCost = cost + rule.weight * factCount;
      if (nextCost > stepLimit) {
        continue;
      }
      const nextKey = getDomainsKey(next);
      if ((best.get(nextKey) ?? Number.POSITIVE_INFINITY) <= nextCost) {
        continue;
      }
      best.set(nextKey, nextCost);
      order += 1;
      pushState(queue, {
        cost: nextCost,
        order,
        domains: next,
        key: nextKey,
        changed: changed | newlyChanged,
      });
    }
  }
  return false;
}

/** 変数 `variable` を1回場合分けし、矛盾した値を消した盤面。何も消えなければ `null`。 */
function splitOnce(
  search: FukumenzanSplitSearch,
  rules: readonly Rule[],
  domains: readonly number[],
  variable: number,
): number[] | null {
  const { reader, branch } = search;
  const next = [...domains];
  for (const digit of digitsOfMask[domains[variable]!]!) {
    const placed = [...domains];
    placed[variable] = 1 << digit;
    const contradicts =
      branch.kind === "closure"
        ? closeFukumenzanDomains(reader, placed).status === "contradiction"
        : findsContradictionWithinSteps(
            reader,
            rules,
            placed,
            domains,
            branch.stepLimit,
          );
    if (contradicts) {
      next[variable]! &= ~(1 << digit);
    }
  }
  return next.every((mask, index) => mask === domains[index]) ? null : next;
}

/**
 * 場合分けしてよい変数: 候補が2つの文字か繰り上がりと、候補が3つの繰り上がり（場合分けの弱い端。候補が3つの文字は
 * 読み比べる値が多く、1回の場合分けとして追いにくい）。
 */
function canSplit(
  search: FukumenzanSplitSearch,
  variable: number,
  candidateCount: number,
): boolean {
  return (
    candidateCount === 2 ||
    (candidateCount === 3 && variable >= search.reader.model.letterCount)
  );
}

/**
 * 読みの閉包から、1つの変数の場合分けの結論を入れて読み直すのを1回と数え、全部の文字が決まるまでの最短の回数を
 * 盤面の幅優先で求める。
 */
export function countFukumenzanSplits(
  search: FukumenzanSplitSearch,
): FukumenzanSplitCount {
  const { reader, splitLimit, frontierLimit } = search;
  const { model } = reader;
  const rules = listRules(reader);
  const initial = closeFukumenzanDomains(reader, createInitialDomains(model));
  if (initial.status === "contradiction") {
    throw new Error("Fukumenzan reading contradicted a solvable equation");
  }
  if (areAllLettersDecided(model, initial.domains)) {
    return 0;
  }
  let frontier: (readonly number[])[] = [initial.domains];
  const seen = new Set([getDomainsKey(initial.domains)]);
  for (let count = 1; count <= splitLimit; count += 1) {
    const next: (readonly number[])[] = [];
    for (const domains of frontier) {
      for (let variable = 0; variable < model.variableCount; variable += 1) {
        const candidateCount = digitCountOfMask[domains[variable]!]!;
        if (candidateCount < 2 || !canSplit(search, variable, candidateCount)) {
          continue;
        }
        const split = splitOnce(search, rules, domains, variable);
        if (split === null) {
          continue;
        }
        const closed = closeFukumenzanDomains(reader, split);
        if (closed.status === "contradiction") {
          throw new Error(
            "Fukumenzan splitting contradicted a solvable equation",
          );
        }
        if (areAllLettersDecided(model, closed.domains)) {
          return count;
        }
        const key = getDomainsKey(closed.domains);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(closed.domains);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) {
      return "stalled";
    }
    if (count < splitLimit && frontier.length > frontierLimit) {
      return "frontier-cap";
    }
  }
  return "exceeded";
}
