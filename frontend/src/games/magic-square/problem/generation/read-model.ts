import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";
import {
  countMaskValues,
  fullMask,
  hasMaskValue,
  highestMaskValue,
  intersectMasks,
  isSingleValueMask,
  listMaskValues,
  lowestMaskValue,
  maskOfValue,
  rangeMask,
  subtractMask,
  uniteMasks,
  type ValueMask,
} from "@/games/magic-square/problem/generation/value-mask";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";

/*
 * 読むモデル（人間向けの解法器）。盤面に見える置いた数・列の今の合計と合計の定数・候補のメモだけから、空いたマスの候補を絞る。
 * 難易度の資料（`docs/パズル/導入調査/魔方陣/魔方陣難易度.md` §2.2）の基準の読むモデル。
 *
 * 読む単位は次の2つ。どちらも「その単位の空いたマスに、メモの候補の数を互いに違うように入れて、単位の列の合計を全部満たす入れ方」を
 * 全部考える。
 * - 列: 空きが e マスの列（段 e）。
 * - 鎖: 1つのマスの数を t と置くと、ほかの全部のマスが t の式で順に書けるまとまり（段2）。空きが2マスの列が同じマスでつながったもの
 *   （2本以上）から始め、空きのうち1マスを除く全部がまとまりの中にある列を足して、その列の残る1マスもまとまりに入れる。
 *   足した先のマスからも空き2の列をたどり、足せる列が無くなるまで続ける（全部のマスが中にある列は確かめの式として足す）。
 * 単位を読んだ結果は2つで、どちらもその巡の結果に入る。
 * - 台: 単位の各マスの候補を、どれかの入れ方で入る数に絞る。
 * - 組の数を他で使わない: どの入れ方でも単位の中で使う数を、その巡に読んだ単位のマスのうち単位の外のマスの候補から消す（段2以上）。
 * 1巡は、段 t 以下の単位を全部、巡の始めの候補（同じ写し）から読み、台を同じマスで、メモに書ける数に関わらず全部重ねること
 * （頭の中で重ねる。メモの上限は巡と巡の間にだけ当てる）。重ねた候補で、候補が1つのマスと、入る所が1マスだけになった数
 * （この数はここだけ）を、その巡で決まったマスとする。巡の数は、読みの依存の段数の最小になり、読む順に依らない。
 * 段1で置けなくなった盤面（行き詰まり）では、段2・段3・段4の順に、どの段も行き詰まりの始めの候補から巡を重ね、決まったマスが
 * 出たら止める。決まったマスが出た最も低い段と、そこまでの巡の数を、その「所」の値にする。決まったマスは全部置き、段1に戻る。
 */

/** 読む単位の、空きのマスと係数と右辺の式（係数 × 数の和 = 右辺）。 */
type ReadEquation = {
  cells: readonly number[];
  coefficients: readonly number[];
  sum: number;
};

type ReadUnit = {
  kind: "line" | "chain" | "joint";
  /** 列は列の並び順の空いたマス、ほかは番号の小さい順。 */
  cells: readonly number[];
  equations: readonly ReadEquation[];
  /** 単位の段（空きのマスの数 − 式の数 + 1）。 */
  tier: number;
  /** 組（`jointk`）の、近道を使わないときの段。ほかの単位は `tier` と同じ。 */
  naturalTier?: number;
  key: string;
  /** 単位に入る列の数。 */
  lineCount: number;
};

/** 読むときに合計を確かめる列。4×4 の仮想の列も同じ形で足す。 */
export type MagicSquareReadLine = {
  cells: readonly number[];
  sum: number;
};

/**
 * 読み方の設定。基準は `defaultMagicSquareReadOptions`。基準と、一致を求める部品（`reading-parts.ts`）が使う設定だけを持つ。
 */
export type MagicSquareReadOptions = {
  /** 読む列の空きの上限（段）。4 は空きが4マス以上の列も読む。 */
  maxTier: number;
  /** 置いた後も絞った候補を残すか（候補のメモを使う人）。 */
  memory: boolean;
  /** 段を上げた所の巡: 行き詰まりの始めから（`fresh`）・下の段を出し切った候補から続ける（`carry`）・それに下の段で候補が動いた巡を足す（`cum`）。 */
  count: "fresh" | "carry" | "cum";
  /** 空き2の列の鎖を読むか。 */
  chains: boolean;
  /** 鎖を、空きがこの数までの列で延ばす。0 は延ばさない。 */
  tchain: number;
  /** 0 は閉じるまで延ばす。k は空き3以上の列で k 回だけ延ばす。 */
  tchainSteps: number;
  /** 0 より大きければ、鎖をつながったこの本数ずつに分けて読む。 */
  chainLimit: number;
  /** 行き詰まりで使う段: 置ける最も低い段（`lowest`）・巡の最も少ない段（`fewest`）。 */
  tierChoice: "lowest" | "fewest";
  /** 「この数はここだけ」を使う最も低い段。 */
  hiddenMinTier: number;
  /** 「組の数を他で使わない」を使う最も低い段。 */
  lockMinTier: number;
  /** 列に足して読む式（4×4 の仮想の列）。 */
  extraLines: readonly MagicSquareReadLine[];
  /** 空き4マス以上の列と鎖・組を読むときの節点の上限。計算を止めるためのもので、人の能力ではない。 */
  enumCap: number;
  /** 1巡で決まったマスを全部置くか（`false` は番号の最も小さい1マスだけ）。 */
  batch: boolean;
  /** 「組の数を他で使わない」で消す数を次の巡から効かせるか。 */
  lockNext: boolean;
  /** 「この数はここだけ」を巡の始めの候補で見るか（次の巡から効く）。 */
  hiddenNext: boolean;
  /** 「この数はここだけ」を使うか。 */
  hidden: boolean;
  /** 鎖から「組の数を他で使わない」を使うか。 */
  chainLock: boolean;
  /** 「組の数を他で使わない」で消すマス: その巡に読んだ単位のマスだけ（`units`）・単位の外の全マス（`all`）。 */
  lockScope: "units" | "all";
  /** 「組の数を他で使わない」で消した数をメモに残さない（その巡の判定にだけ使う）か。 */
  lockEphemeral: boolean;
  /** 列の上下限を読む: 残っている数の和からの上下限（`range`）・違反の知らせで分かる上限（`viol`）。 */
  bounds: "range" | "viol" | null;
  /** 上下限を使う最も低い段。 */
  boundsTier: number;
  /** 0 より大きければ段2で、組がこの数以下の空き3の列も読む（近道）。 */
  short3Sets: number;
  /** 0 より大きければ、空き2〜3の列のつながったこの本数までの組（空き3の列を含む）を一緒に読む。 */
  jointk: number;
  /** メモに書けるのは候補がこの数以下のマスだけ（巡の間で、それより多いマスは全部の数に戻る）。`null` は上限なし。 */
  memoMax: number | null;
  /** 0 より大きければ、列がこの本数以上の鎖を段3に数える。 */
  chainTier3From: number;
  /** 斜めの列を鎖と組につなぐか。 */
  diagChain: boolean;
  /** 段2以上の各段の1巡目は鎖を読まない（列を1本ずつ読んでから鎖をつなぐ）か。 */
  chainLate: boolean;
  /** 0 より大きければ段2で、入れ方がこの数以下の段3の組も読む（近道）。 */
  shortJointSets: number;
  /** 段1で、残っている数で組が1通りの空き2の列も読む（近道）か。 */
  pair1: boolean;
  /** 0 より大きければ、この段から、メモの最小・最大で空き3以上の列の上下限を取る。 */
  mrange: number;
};

export const defaultMagicSquareReadOptions: MagicSquareReadOptions = {
  maxTier: 4,
  memory: true,
  count: "fresh",
  chains: true,
  tchain: 99,
  tchainSteps: 0,
  chainLimit: 0,
  tierChoice: "lowest",
  hiddenMinTier: 1,
  lockMinTier: 2,
  extraLines: [],
  enumCap: 200_000,
  batch: true,
  lockNext: false,
  hiddenNext: false,
  hidden: true,
  chainLock: true,
  lockScope: "units",
  lockEphemeral: false,
  bounds: null,
  boundsTier: 2,
  short3Sets: 0,
  jointk: 0,
  memoMax: null,
  chainTier3From: 0,
  diagChain: true,
  chainLate: false,
  shortJointSets: 0,
  pair1: false,
  mrange: 0,
};

/** 空きが3マス以上の列にだけメモの上下限を当てる。 */
const MRANGE_MIN_EMPTY_COUNT = 3;

/** 決まったマスの種類: 段1の候補1つ（`one`）・段2以上の候補1つ（`cross`）・この数はここだけ（`hidden`）。 */
export type MagicSquarePlacementKind = "one" | "cross" | "hidden";

/** 読みで置いた1か所（所）。 */
export type MagicSquareReadStep = {
  /** 所の段。 */
  tier: number;
  /** 所の巡。 */
  sweeps: number;
  /** 置いたマスの数。 */
  placed: number;
  /** 見つかったマスの数（1つずつ置く読み方でも、見つかった数）。 */
  found: number;
  kinds: readonly MagicSquarePlacementKind[];
  /** 「組の数を他で使わない」で候補が消えたか。 */
  lock: boolean;
  /** 段2以上の所の1巡目に読んだ、空きが2マス以上の単位ごとの組の数。 */
  combos: readonly number[];
  /** 段2以上の所の1巡目に読んだ鎖の列の数の最大。 */
  chain: number;
  /** 置いたマス（番号の小さい順）。 */
  cells: readonly number[];
};

/**
 * - `solved`: 最後まで置けた。
 * - `stuck`: 段 `maxTier` まで読んでも決まらない所が残った。
 * - `contradiction`: 読みで矛盾が出た（与える数が答えに合わない）。
 */
export type MagicSquareReadResult = {
  status: "solved" | "stuck" | "contradiction";
  steps: readonly MagicSquareReadStep[];
  /** 読んで置いた盤面（止まったときは止まった所まで）。矛盾のときは `null`。 */
  grid: readonly number[] | null;
  /** 読む単位の節点の上限で読めなかった回数。 */
  cappedReads: number;
};

class ReadCapReached extends Error {}
class ReadContradiction extends Error {}

type UnitReading = {
  support: number[];
  required: ValueMask;
  setCount: number;
};

/** 列1本（空きのマスの候補 `masks`、残り `rest`）を読む。入れ方が無ければ台は全部 0。 */
function enumerateLine(
  masks: readonly ValueMask[],
  rest: number,
  maxValue: number,
  cap: number,
): UnitReading {
  const emptyCount = masks.length;
  const support: number[] = Array(emptyCount).fill(0);
  const sets = new Set<ValueMask>();
  let required = fullMask(maxValue);
  let count = 0;
  if (emptyCount === 1) {
    if (rest >= 1 && rest <= maxValue && hasMaskValue(masks[0]!, rest)) {
      const mask = maskOfValue(rest);
      return { support: [mask], required: mask, setCount: 1 };
    }
    return { support: [0], required: 0, setCount: 0 };
  }
  if (emptyCount === 2) {
    const [first, second] = masks as [ValueMask, ValueMask];
    for (const value of listMaskValues(first)) {
      const partner = rest - value;
      if (
        partner !== value &&
        partner >= 1 &&
        partner <= maxValue &&
        hasMaskValue(second, partner)
      ) {
        support[0] = uniteMasks(support[0]!, maskOfValue(value));
        support[1] = uniteMasks(support[1]!, maskOfValue(partner));
        const set = uniteMasks(maskOfValue(value), maskOfValue(partner));
        sets.add(set);
        required = intersectMasks(required, set);
        count += 1;
      }
    }
    return { support, required: count ? required : 0, setCount: sets.size };
  }
  if (emptyCount === 3) {
    const [first, second, third] = masks as [ValueMask, ValueMask, ValueMask];
    for (const value of listMaskValues(first)) {
      for (const middle of listMaskValues(
        subtractMask(second, maskOfValue(value)),
      )) {
        const last = rest - value - middle;
        if (
          last !== value &&
          last !== middle &&
          last >= 1 &&
          last <= maxValue &&
          hasMaskValue(third, last)
        ) {
          support[0] = uniteMasks(support[0]!, maskOfValue(value));
          support[1] = uniteMasks(support[1]!, maskOfValue(middle));
          support[2] = uniteMasks(support[2]!, maskOfValue(last));
          const set = uniteMasks(
            uniteMasks(maskOfValue(value), maskOfValue(middle)),
            maskOfValue(last),
          );
          sets.add(set);
          required = intersectMasks(required, set);
          count += 1;
        }
      }
    }
    return { support, required: count ? required : 0, setCount: sets.size };
  }
  // 4マス以上: 候補の少ないマスから深さ優先。和の上下限で枝を切る。
  const order = Array.from({ length: emptyCount }, (_, index) => index).sort(
    (left, right) =>
      countMaskValues(masks[left]!) - countMaskValues(masks[right]!),
  );
  const orderedMasks = order.map((index) => masks[index]!);
  const orderedSupport: number[] = Array(emptyCount).fill(0);
  const chosen: number[] = Array(emptyCount).fill(0);
  let nodes = 0;
  const search = (index: number, remaining: number, used: ValueMask) => {
    nodes += 1;
    if (nodes > cap) {
      throw new ReadCapReached();
    }
    if (index === emptyCount - 1) {
      if (
        remaining >= 1 &&
        remaining <= maxValue &&
        !hasMaskValue(used, remaining) &&
        hasMaskValue(orderedMasks[index]!, remaining)
      ) {
        chosen[index] = remaining;
        const set = uniteMasks(used, maskOfValue(remaining));
        for (let position = 0; position < emptyCount; position += 1) {
          orderedSupport[position] = uniteMasks(
            orderedSupport[position]!,
            maskOfValue(chosen[position]!),
          );
        }
        sets.add(set);
        required = intersectMasks(required, set);
        count += 1;
      }
      return;
    }
    const after = emptyCount - index - 1;
    let restMask = 0;
    for (let position = index + 1; position < emptyCount; position += 1) {
      restMask = uniteMasks(restMask, orderedMasks[position]!);
    }
    const restValues = listMaskValues(subtractMask(restMask, used));
    if (restValues.length < after) {
      return;
    }
    const lowestRest = sumOf(restValues.slice(0, after));
    const highestRest = sumOf(restValues.slice(-after));
    for (const value of listMaskValues(
      subtractMask(orderedMasks[index]!, used),
    )) {
      const left = remaining - value;
      if (left < lowestRest) {
        break;
      }
      if (left > highestRest) {
        continue;
      }
      chosen[index] = value;
      search(index + 1, left, uniteMasks(used, maskOfValue(value)));
    }
  };
  search(0, rest, 0);
  order.forEach((index, position) => {
    support[index] = orderedSupport[position]!;
  });
  return { support, required: count ? required : 0, setCount: sets.size };
}

function sumOf(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum;
}

/**
 * 式がいくつかある単位（鎖・組）の入れ方を全部考える。台はマスの並び順。数は単位の中で互いに違う。
 * 候補の最も少ないマスから始め、決めたマスと同じ式に多く入るマスを次にして、式の最後のマスで式を確かめる。
 */
function enumerateEquations(
  cells: readonly number[],
  equations: readonly ReadEquation[],
  candidates: readonly ValueMask[],
  maxValue: number,
  cap: number,
): UnitReading {
  const cellCount = cells.length;
  const positions = new Map(cells.map((cell, position) => [cell, position]));
  const localEquations = equations.map(
    ({ cells: equationCells, coefficients, sum }) => ({
      variables: equationCells.map((cell) => positions.get(cell)!),
      coefficients,
      sum,
    }),
  );
  const order: number[] = [];
  const left: number[] = Array.from({ length: cellCount }, (_, index) => index);
  const popcounts = cells.map((cell) => countMaskValues(candidates[cell]!));
  let first = left[0]!;
  for (const index of left) {
    if (popcounts[index]! < popcounts[first]!) {
      first = index;
    }
  }
  order.push(first);
  left.splice(left.indexOf(first), 1);
  const placed = new Set<number>([first]);
  while (left.length > 0) {
    let best = left[0]!;
    let bestLinked = -1;
    for (const index of left) {
      let linked = 0;
      for (const { variables } of localEquations) {
        if (variables.includes(index)) {
          for (const variable of variables) {
            if (placed.has(variable)) {
              linked += 1;
            }
          }
        }
      }
      if (
        linked > bestLinked ||
        (linked === bestLinked && popcounts[index]! < popcounts[best]!)
      ) {
        best = index;
        bestLinked = linked;
      }
    }
    order.push(best);
    placed.add(best);
    left.splice(left.indexOf(best), 1);
  }
  const rank: number[] = Array(cellCount).fill(0);
  order.forEach((index, position) => {
    rank[index] = position;
  });
  const byLast = new Map<number, number[]>();
  localEquations.forEach(({ variables }, equationIndex) => {
    const last = Math.max(...variables.map((variable) => rank[variable]!));
    const list = byLast.get(last);
    if (list) {
      list.push(equationIndex);
    } else {
      byLast.set(last, [equationIndex]);
    }
  });
  const values: number[] = Array(cellCount).fill(0);
  const support: number[] = Array(cellCount).fill(0);
  const sets = new Set<ValueMask>();
  let required = fullMask(maxValue);
  let count = 0;
  let nodes = 0;
  const search = (position: number, used: ValueMask) => {
    nodes += 1;
    if (nodes > cap) {
      throw new ReadCapReached();
    }
    if (position === cellCount) {
      let set = 0;
      for (let index = 0; index < cellCount; index += 1) {
        const mask = maskOfValue(values[index]!);
        support[index] = uniteMasks(support[index]!, mask);
        set = uniteMasks(set, mask);
      }
      sets.add(set);
      required = intersectMasks(required, set);
      count += 1;
      return;
    }
    const index = order[position]!;
    const closing = byLast.get(position) ?? [];
    let forced: number | null = null;
    for (const equationIndex of closing) {
      const { variables, coefficients, sum } = localEquations[equationIndex]!;
      let accumulated = sum;
      let own = 0;
      variables.forEach((variable, term) => {
        if (variable === index) {
          own += coefficients[term]!;
        } else {
          accumulated -= coefficients[term]! * values[variable]!;
        }
      });
      if (own === 0) {
        continue;
      }
      if (accumulated % own !== 0) {
        return;
      }
      const value = accumulated / own;
      if (forced === null) {
        forced = value;
      } else if (forced !== value) {
        return;
      }
    }
    const mask = subtractMask(candidates[cells[index]!]!, used);
    const options =
      forced !== null
        ? forced >= 1 && forced <= maxValue && hasMaskValue(mask, forced)
          ? [forced]
          : []
        : listMaskValues(mask);
    for (const value of options) {
      values[index] = value;
      const satisfied = closing.every((equationIndex) => {
        const { variables, coefficients, sum } = localEquations[equationIndex]!;
        let total = 0;
        variables.forEach((variable, term) => {
          total += coefficients[term]! * values[variable]!;
        });
        return total === sum;
      });
      if (satisfied) {
        search(position + 1, uniteMasks(used, maskOfValue(value)));
      }
    }
  };
  search(0, 0);
  return { support, required: count ? required : 0, setCount: sets.size };
}

function readUnit(
  unit: ReadUnit,
  candidates: readonly ValueMask[],
  maxValue: number,
  cap: number,
): UnitReading {
  if (unit.kind === "line") {
    return enumerateLine(
      unit.cells.map((cell) => candidates[cell]!),
      unit.equations[0]!.sum,
      maxValue,
      cap,
    );
  }
  return enumerateEquations(
    unit.cells,
    unit.equations,
    candidates,
    maxValue,
    cap,
  );
}

type LineState = {
  lineIndex: number;
  empties: readonly number[];
  rest: number;
};

function listLineStates(
  grid: readonly number[],
  lines: readonly MagicSquareReadLine[],
): LineState[] {
  return lines.map(({ cells, sum }, lineIndex) => {
    let filled = 0;
    const empties: number[] = [];
    for (const cell of cells) {
      const value = grid[cell]!;
      if (value) {
        filled += value;
      } else {
        empties.push(cell);
      }
    }
    return { lineIndex, empties, rest: sum - filled };
  });
}

function lineEquation({ empties, rest }: LineState): ReadEquation {
  return {
    cells: empties,
    coefficients: empties.map(() => 1),
    sum: rest,
  };
}

function listLineUnits(
  grid: readonly number[],
  lines: readonly MagicSquareReadLine[],
): ReadUnit[] {
  return listLineStates(grid, lines).flatMap((state) =>
    state.empties.length > 0
      ? [
          {
            kind: "line" as const,
            cells: state.empties,
            equations: [lineEquation(state)],
            tier: state.empties.length,
            key: `L${state.lineIndex}`,
            lineCount: 1,
          },
        ]
      : [],
  );
}

function sharesCell(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return left.some((cell) => right.includes(cell));
}

/** `members` の中で、つながった `size` 本の組を全部（番号の組の辞書順）。 */
function listConnectedSubsets(
  members: readonly number[],
  adjacency: ReadonlyMap<number, readonly number[]>,
  size: number,
): number[][] {
  const found = new Map<string, number[]>();
  const grow = (current: number[]) => {
    if (current.length === size) {
      const sorted = [...current].sort((left, right) => left - right);
      found.set(sorted.join(","), sorted);
      return;
    }
    const smallest = Math.min(...current);
    const frontier = new Set<number>();
    for (const member of current) {
      for (const next of adjacency.get(member) ?? []) {
        frontier.add(next);
      }
    }
    for (const next of frontier) {
      if (!current.includes(next) && next > smallest) {
        grow([...current, next]);
      }
    }
  };
  for (const member of members) {
    grow([member]);
  }
  return [...found.values()].sort(compareNumberLists);
}

function compareNumberLists(
  left: readonly number[],
  right: readonly number[],
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index]! - right[index]!;
    }
  }
  return left.length - right.length;
}

/** 空きが2マスの列が同じマスでつながったまとまり（2本以上）。`limit` 本より長い鎖は、つながった `limit` 本ずつに分ける。 */
function listChainUnits(
  grid: readonly number[],
  lines: readonly MagicSquareReadLine[],
  limit: number,
): ReadUnit[] {
  const pairs = listLineStates(grid, lines).filter(
    ({ empties }) => empties.length === 2,
  );
  const parent = pairs.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!;
      current = parent[current]!;
    }
    return current;
  };
  for (let left = 0; left < pairs.length; left += 1) {
    for (let right = left + 1; right < pairs.length; right += 1) {
      if (sharesCell(pairs[left]!.empties, pairs[right]!.empties)) {
        parent[find(left)] = find(right);
      }
    }
  }
  const components = new Map<number, number[]>();
  pairs.forEach((_, index) => {
    const root = find(index);
    const component = components.get(root);
    if (component) {
      component.push(index);
    } else {
      components.set(root, [index]);
    }
  });
  const units: ReadUnit[] = [];
  for (const component of components.values()) {
    if (component.length < 2) {
      continue;
    }
    let parts: number[][] = [component];
    if (limit && component.length > limit) {
      const adjacency = new Map(
        component.map((index) => [
          index,
          component.filter(
            (other) =>
              other !== index &&
              sharesCell(pairs[index]!.empties, pairs[other]!.empties),
          ),
        ]),
      );
      parts = listConnectedSubsets(component, adjacency, limit);
    }
    for (const part of parts) {
      const cells = [
        ...new Set(part.flatMap((index) => pairs[index]!.empties)),
      ].sort((left, right) => left - right);
      const lineIndices = part
        .map((index) => pairs[index]!.lineIndex)
        .sort((left, right) => left - right);
      units.push({
        kind: "chain",
        cells,
        equations: part.map((index) => lineEquation(pairs[index]!)),
        tier: 2,
        key: `K${lineIndices.join(",")}`,
        lineCount: part.length,
      });
    }
  }
  return units;
}

/**
 * 単位を、空きが2〜`maxEmpty` マスで、空きのうち1マスを除く全部が単位の中にある列で延ばす。全部のマスが中にある列は確かめの式として足す。
 * `steps` が 0 なら閉じるまで延ばし、延ばした先のマスから空き2の列もたどる（もとの鎖のマスに触れる空き2の列は足さない）。
 * `steps` が k なら空き3以上の列で k 回延ばす（回の間だけ、延ばした先のマスから空き2の列をたどる）。
 * `cells`・`equations`・`used` を書き換え、足した空き3以上の列の数を返す。
 */
function extendUnit(
  states: readonly LineState[],
  cells: Set<number>,
  equations: ReadEquation[],
  used: Set<number>,
  maxEmpty: number,
  steps: number,
): number {
  const original = new Set(cells);
  const accepts = (
    state: LineState,
    base: ReadonlySet<number>,
    allowPair: boolean,
  ): boolean => {
    const { lineIndex, empties } = state;
    if (
      used.has(lineIndex) ||
      empties.length < 2 ||
      empties.length > maxEmpty
    ) {
      return false;
    }
    const inside = empties.filter((cell) => base.has(cell)).length;
    if (inside < empties.length - 1) {
      return false;
    }
    if (empties.length === 2) {
      return allowPair && !empties.some((cell) => original.has(cell));
    }
    return true;
  };
  const add = (state: LineState) => {
    used.add(state.lineIndex);
    equations.push(lineEquation(state));
    for (const cell of state.empties) {
      cells.add(cell);
    }
  };
  let added = 0;
  if (steps === 0) {
    let grew = true;
    while (grew) {
      grew = false;
      for (const state of states) {
        if (accepts(state, cells, true)) {
          add(state);
          if (state.empties.length >= 3) {
            added += 1;
          }
          grew = true;
        }
      }
    }
    return added;
  }
  for (let step = 0; step < steps; step += 1) {
    if (step > 0) {
      let grew = true;
      while (grew) {
        grew = false;
        for (const state of states) {
          if (state.empties.length === 2 && accepts(state, cells, true)) {
            add(state);
            grew = true;
          }
        }
      }
    }
    const base = new Set(cells);
    for (const state of states) {
      if (state.empties.length >= 3 && accepts(state, base, false)) {
        add(state);
        added += 1;
      }
    }
  }
  return added;
}

/** 鎖を延ばした単位（段2）。延びなかった鎖はそのまま。延びて同じまとまりになった鎖は1つにする。 */
function extendChainUnits(
  grid: readonly number[],
  lines: readonly MagicSquareReadLine[],
  chains: readonly ReadUnit[],
  maxEmpty: number,
  steps: number,
): ReadUnit[] {
  const states = listLineStates(grid, lines).filter(
    ({ empties }) => empties.length >= 2,
  );
  const units: ReadUnit[] = [];
  const seen = new Set<string>();
  for (const chain of chains) {
    const cells = new Set(chain.cells);
    const equations = [...chain.equations];
    const used = new Set(
      chain.key
        .slice(1)
        .split(",")
        .map((index) => Number(index)),
    );
    if (!extendUnit(states, cells, equations, used, maxEmpty, steps)) {
      units.push(chain);
      continue;
    }
    const key = `TK${[...used].sort((left, right) => left - right).join(",")}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    units.push({
      kind: "chain",
      cells: [...cells].sort((left, right) => left - right),
      equations,
      tier: chain.tier,
      key,
      lineCount: equations.length,
    });
  }
  return units;
}

/** 空き2〜3の列のつながった2〜`maxLines` 本の組（空き3の列を含むもの）。段はマスの数 − 式の数 + 1。 */
function listJointUnits(
  grid: readonly number[],
  lines: readonly MagicSquareReadLine[],
  maxLines: number,
): ReadUnit[] {
  const states = listLineStates(grid, lines).filter(
    ({ empties }) => empties.length >= 2 && empties.length <= 3,
  );
  const members = states.map((_, index) => index);
  const adjacency = new Map(
    members.map((index) => [
      index,
      members.filter(
        (other) =>
          other !== index &&
          sharesCell(states[index]!.empties, states[other]!.empties),
      ),
    ]),
  );
  const units: ReadUnit[] = [];
  for (let lineCount = 2; lineCount <= maxLines; lineCount += 1) {
    for (const subset of listConnectedSubsets(members, adjacency, lineCount)) {
      if (subset.every((index) => states[index]!.empties.length === 2)) {
        continue;
      }
      const equations = subset.map((index) => lineEquation(states[index]!));
      const cells = [
        ...new Set(subset.flatMap((index) => states[index]!.empties)),
      ].sort((left, right) => left - right);
      const tier = Math.max(2, cells.length - equations.length + 1);
      units.push({
        kind: "joint",
        cells,
        equations,
        tier,
        naturalTier: tier,
        key: `JK${subset
          .map((index) => states[index]!.lineIndex)
          .sort((left, right) => left - right)
          .join(",")}`,
        lineCount,
      });
    }
  }
  return units;
}

type ReadGeometry = {
  size: number;
  cellCount: number;
  lines: readonly MagicSquareReadLine[];
};

const geometries = new Map<number, ReadGeometry>();

function getReadGeometry(size: number): ReadGeometry {
  const cached = geometries.get(size);
  if (cached) {
    return cached;
  }
  const sum = getMagicSquareMagicSum(size);
  const geometry: ReadGeometry = {
    size,
    cellCount: getMagicSquareMaxValue(size),
    lines: listMagicSquareLines(size).map((line) => ({
      cells: getMagicSquareLineCellIndices(size, line),
      sum,
    })),
  };
  geometries.set(size, geometry);
  return geometry;
}

function buildUnits(
  geometry: ReadGeometry,
  grid: readonly number[],
  options: MagicSquareReadOptions,
  lines: readonly MagicSquareReadLine[],
): ReadUnit[] {
  const units = listLineUnits(grid, lines);
  // 鎖と組をつなぐ列。斜めをつながない読み方は、斜めの2本（行と列の後の2本）を外す。
  const chainLines = options.diagChain
    ? lines
    : lines.filter(
        (_, index) =>
          index !== 2 * geometry.size && index !== 2 * geometry.size + 1,
      );
  if (options.chains) {
    let chains = listChainUnits(grid, chainLines, options.chainLimit);
    if (options.tchain) {
      chains = extendChainUnits(
        grid,
        chainLines,
        chains,
        options.tchain,
        options.tchainSteps,
      );
    }
    if (options.chainTier3From) {
      chains = chains.map((chain) =>
        chain.lineCount >= options.chainTier3From
          ? { ...chain, tier: 3 }
          : chain,
      );
    }
    units.push(...chains);
  }
  if (options.jointk) {
    units.push(...listJointUnits(grid, chainLines, options.jointk));
  }
  return units;
}

type TierRun = {
  placements: Map<number, number>;
  kinds: Set<MagicSquarePlacementKind>;
  sweeps: number;
  lock: boolean;
  combos: number[];
  chain: number;
  candidates: ValueMask[];
  changed: boolean;
};

/** 近道（組が少ない単位を低い段で読む読み）を持つ読み方か。持つ読み方は、近道で初めて置けた所を1つ上の段と数える。 */
function hasShortcut(options: MagicSquareReadOptions): boolean {
  return Boolean(options.short3Sets || options.shortJointSets || options.pair1);
}

/**
 * 与える数（`givens`。行優先、空きは 0）を、読み方 `options` で読み切る。
 * 読みの推論はどれも健全なので、解き切れれば解は1つ。
 */
export function readMagicSquare(
  size: number,
  givens: MagicSquareGrid,
  overrides: Partial<MagicSquareReadOptions> = {},
): MagicSquareReadResult {
  const options: MagicSquareReadOptions = {
    ...defaultMagicSquareReadOptions,
    ...overrides,
  };
  const geometry = getReadGeometry(size);
  const maxValue = geometry.cellCount;
  const lines = [...geometry.lines, ...options.extraLines];
  const grid = [...givens];
  let unused = fullMask(maxValue);
  for (const value of grid) {
    if (value) {
      unused = subtractMask(unused, maskOfValue(value));
    }
  }
  const steps: MagicSquareReadStep[] = [];
  let candidates: ValueMask[] | null = null;
  let cappedReads = 0;

  /** メモの上限: 候補が上限より多いマスは書けないので、全部の数に戻る。 */
  const filterMemo = (masks: ValueMask[], empties: readonly number[]) => {
    const limit = options.memoMax;
    if (limit === null) {
      return masks;
    }
    const filtered = [...masks];
    for (const cell of empties) {
      const mask = masks[cell]!;
      if (mask !== 0 && countMaskValues(mask) > limit) {
        filtered[cell] = unused;
      }
    }
    return filtered;
  };

  /** 列の上下限: 空き e の列の各マスは、残り − 残っている数の大きい e−1 個の和以上、残り − 小さい e−1 個の和以下。 */
  const applyBounds = (masks: ValueMask[], tier: number) => {
    if (!options.bounds || tier < options.boundsTier) {
      return;
    }
    const values = listMaskValues(unused);
    for (const { empties, rest } of listLineStates(grid, lines)) {
      const emptyCount = empties.length;
      if (emptyCount < 2) {
        continue;
      }
      const [lower, upper] =
        options.bounds === "viol"
          ? [1, rest - 1]
          : [
              rest - sumOf(values.slice(-(emptyCount - 1))),
              rest - sumOf(values.slice(0, emptyCount - 1)),
            ];
      const mask = rangeMask(lower, upper, maxValue);
      for (const cell of empties) {
        masks[cell] = intersectMasks(masks[cell]!, mask);
      }
    }
  };

  /** メモの上下限: 空き3以上の列の各マスを、ほかのマスのメモの最大の和・最小の和から絞る。 */
  const applyMemoRange = (
    masks: ValueMask[],
    source: readonly ValueMask[],
    tier: number,
  ) => {
    if (!options.mrange || tier < options.mrange) {
      return;
    }
    const values = listMaskValues(unused);
    for (const { empties, rest } of listLineStates(grid, lines)) {
      const emptyCount = empties.length;
      if (emptyCount < MRANGE_MIN_EMPTY_COUNT) {
        continue;
      }
      if (empties.some((cell) => source[cell] === 0)) {
        continue;
      }
      const globalHigh = sumOf(values.slice(-(emptyCount - 1)));
      const globalLow = sumOf(values.slice(0, emptyCount - 1));
      for (const cell of empties) {
        let high = 0;
        let low = 0;
        for (const other of empties) {
          if (other !== cell) {
            high += highestMaskValue(source[other]!);
            low += lowestMaskValue(source[other]!);
          }
        }
        const upperOthers = Math.min(high, globalHigh);
        const lowerOthers = Math.max(low, globalLow);
        masks[cell] = intersectMasks(
          masks[cell]!,
          rangeMask(rest - upperOthers, rest - lowerOthers, maxValue),
        );
      }
    }
  };

  /** 組が1通りの空き2の列か。メモではなく、残っている数だけで見る。 */
  const isPairShortcut = (unit: ReadUnit): boolean =>
    enumerateLine(
      [unused, unused],
      unit.equations[0]!.sum,
      maxValue,
      options.enumCap,
    ).setCount === 1;

  const sameCandidates = (
    left: readonly ValueMask[],
    right: readonly ValueMask[],
    empties: readonly number[],
  ) => empties.every((cell) => left[cell] === right[cell]);

  /**
   * 段 `tier` 以下の単位を、置けるか動かなくなるまで巡ごとに読む。`plain` なら、組が少ない単位を低い段で読む近道を読まない。
   */
  const runTier = (
    tier: number,
    start: readonly ValueMask[],
    units: readonly ReadUnit[],
    empties: readonly number[],
    maxSweeps: number,
    plain: boolean,
  ): TierRun => {
    let current = [...start];
    let sweeps = 0;
    let lockChanged = false;
    const combos: number[] = [];
    let chain = 0;
    // 「組の数を他で使わない」を次の巡から効かせ、メモに残さない読み方は、前の巡の分を、この巡の置き場所探しにだけ使う。
    const lockNextEphemeral = options.lockNext && options.lockEphemeral;
    let pending: { inside: ReadonlySet<number>; required: ValueMask }[] = [];
    for (;;) {
      sweeps += 1;
      const next = [...current];
      const locks = new Map<number, ValueMask>();
      const unitCells = new Set<number>();
      const lockLater: { inside: ReadonlySet<number>; required: ValueMask }[] =
        [];
      for (const unit of units) {
        const cellCount = unit.cells.length;
        let shortcut = 0;
        if (plain && (unit.naturalTier ?? unit.tier) > tier) {
          continue;
        }
        if (unit.tier > tier) {
          if (
            options.short3Sets &&
            tier === 2 &&
            unit.kind === "line" &&
            cellCount === 3
          ) {
            shortcut = options.short3Sets;
          } else if (
            options.shortJointSets &&
            tier === 2 &&
            unit.kind === "joint" &&
            (unit.naturalTier ?? 3) === 3
          ) {
            shortcut = options.shortJointSets;
          } else if (
            options.pair1 &&
            tier === 1 &&
            unit.kind === "line" &&
            cellCount === 2 &&
            isPairShortcut(unit)
          ) {
            shortcut = 1;
          } else {
            continue;
          }
        }
        if (
          options.chainLate &&
          sweeps === 1 &&
          tier >= 2 &&
          unit.kind === "chain"
        ) {
          continue;
        }
        if (unit.kind === "line" && cellCount >= 4 && tier < 4) {
          continue;
        }
        let reading: UnitReading;
        try {
          reading = readUnit(unit, current, maxValue, options.enumCap);
        } catch (error) {
          if (error instanceof ReadCapReached) {
            cappedReads += 1;
            continue;
          }
          throw error;
        }
        const { support, required, setCount } = reading;
        if (shortcut && (setCount === 0 || setCount > shortcut)) {
          continue;
        }
        if (sweeps === 1 && tier >= 2 && cellCount >= 2) {
          combos.push(setCount);
          if (unit.kind === "chain") {
            chain = Math.max(chain, unit.lineCount);
          }
        }
        if (setCount === 0) {
          throw new ReadContradiction();
        }
        unit.cells.forEach((cell, index) => {
          unitCells.add(cell);
          next[cell] = intersectMasks(next[cell]!, support[index]!);
        });
        if (
          (tier >= options.lockMinTier || (shortcut && tier === 1)) &&
          required !== 0 &&
          (unit.kind !== "chain" || options.chainLock)
        ) {
          const inside = new Set(unit.cells);
          if (options.lockNext) {
            lockLater.push({ inside, required });
            continue;
          }
          for (const cell of empties) {
            if (!inside.has(cell)) {
              locks.set(cell, uniteMasks(locks.get(cell) ?? 0, required));
            }
          }
        }
      }
      applyBounds(next, tier);
      applyMemoRange(next, current, tier);
      // 組の数を他で使わない: 単位の外のマスのメモから消す（`units` はその巡に読んだ単位のマスだけ）。
      let effective = locks.size > 0 ? [...next] : next;
      for (const [cell, required] of locks) {
        if (options.lockScope === "units" && !unitCells.has(cell)) {
          continue;
        }
        if (intersectMasks(effective[cell]!, required) !== 0) {
          effective[cell] = subtractMask(effective[cell]!, required);
          lockChanged = true;
        }
      }
      if (lockNextEphemeral && pending.length > 0) {
        effective = [...effective];
        for (const { inside, required } of pending) {
          for (const cell of empties) {
            if (
              !inside.has(cell) &&
              intersectMasks(effective[cell]!, required) !== 0
            ) {
              effective[cell] = subtractMask(effective[cell]!, required);
              lockChanged = true;
            }
          }
        }
      }
      const placements = new Map<number, number>();
      const kinds = new Set<MagicSquarePlacementKind>();
      for (const cell of empties) {
        const mask = effective[cell]!;
        if (mask === 0) {
          throw new ReadContradiction();
        }
        if (isSingleValueMask(mask)) {
          placements.set(cell, lowestMaskValue(mask));
          kinds.add(tier === 1 ? "one" : "cross");
        }
      }
      if (options.hidden && tier >= options.hiddenMinTier) {
        const hiddenSource = options.hiddenNext ? current : effective;
        for (const value of listMaskValues(unused)) {
          const where = empties.filter((cell) =>
            hasMaskValue(hiddenSource[cell]!, value),
          );
          if (where.length === 0) {
            if (options.hiddenNext) {
              continue;
            }
            throw new ReadContradiction();
          }
          if (where.length === 1) {
            const cell = where[0]!;
            if (options.hiddenNext && !hasMaskValue(effective[cell]!, value)) {
              continue;
            }
            const placed = placements.get(cell);
            if (placed !== undefined && placed !== value) {
              throw new ReadContradiction();
            }
            if (placed === undefined) {
              kinds.add("hidden");
            }
            placements.set(cell, value);
          }
        }
      }
      if (new Set(placements.values()).size !== placements.size) {
        throw new ReadContradiction();
      }
      let pendingChanged = false;
      if (lockNextEphemeral) {
        const keyOf = (
          list: readonly { inside: ReadonlySet<number>; required: ValueMask }[],
        ) =>
          new Set(
            list.map(
              ({ inside, required }) =>
                `${[...inside].sort((left, right) => left - right).join(",")}|${required}`,
            ),
          );
        const before = keyOf(pending);
        pending = lockLater.splice(0);
        const after = keyOf(pending);
        pendingChanged =
          before.size !== after.size ||
          [...after].some((key) => !before.has(key));
      }
      if (lockLater.length > 0) {
        effective = [...effective];
        for (const { inside, required } of lockLater) {
          for (const cell of empties) {
            if (
              !inside.has(cell) &&
              intersectMasks(effective[cell]!, required) !== 0
            ) {
              effective[cell] = subtractMask(effective[cell]!, required);
              lockChanged = true;
            }
          }
        }
      }
      const filtered = filterMemo(
        options.lockEphemeral ? next : effective,
        empties,
      );
      const changed =
        !sameCandidates(filtered, current, empties) || pendingChanged;
      current = filtered;
      if (
        placements.size > 0 ||
        !changed ||
        (maxSweeps > 0 && sweeps >= maxSweeps)
      ) {
        return {
          placements,
          kinds,
          sweeps,
          lock: lockChanged,
          combos,
          chain,
          candidates: current,
          changed,
        };
      }
    }
  };

  /**
   * 段 `tier` を読む。近道を持つ読み方は、まず近道なしで読み、置けなければ近道も使う。近道で初めて置けた所は、使った単位の段
   * （`tier` + 1）と数え、その所の巡は、段 `tier` + 1 を近道なしで読んだときの巡を超えない（近道は読みを軽くするだけで、深くしない）。
   */
  const tryTier = (
    tier: number,
    start: readonly ValueMask[],
    units: readonly ReadUnit[],
    empties: readonly number[],
    maxSweeps = 0,
  ): { tier: number; run: TierRun } => {
    if (!hasShortcut(options) || tier >= 3) {
      return {
        tier,
        run: runTier(tier, start, units, empties, maxSweeps, false),
      };
    }
    const plainRun = runTier(tier, start, units, empties, maxSweeps, true);
    if (plainRun.placements.size > 0) {
      return { tier, run: plainRun };
    }
    const shortcutRun = runTier(tier, start, units, empties, maxSweeps, false);
    if (shortcutRun.placements.size === 0) {
      return { tier, run: shortcutRun };
    }
    const reference = runTier(tier + 1, start, units, empties, 0, tier + 1 < 3);
    if (
      reference.placements.size > 0 &&
      reference.sweeps < shortcutRun.sweeps
    ) {
      return {
        tier: tier + 1,
        run: { ...shortcutRun, sweeps: reference.sweeps },
      };
    }
    return { tier: tier + 1, run: shortcutRun };
  };

  try {
    for (;;) {
      const empties: number[] = [];
      for (let cell = 0; cell < maxValue; cell += 1) {
        if (!grid[cell]) {
          empties.push(cell);
        }
      }
      if (empties.length === 0) {
        break;
      }
      const base: ValueMask[] = Array(maxValue).fill(0);
      for (const cell of empties) {
        base[cell] =
          candidates === null || !options.memory
            ? unused
            : intersectMasks(candidates[cell]!, unused);
      }
      const stallStart = filterMemo(base, empties);
      const units = buildUnits(geometry, grid, options, lines);
      let chosen: { tier: number; run: TierRun } | null = null;
      let extraSweeps = 0;
      if (options.tierChoice === "fewest") {
        const first = tryTier(1, stallStart, units, empties);
        if (first.run.placements.size > 0) {
          chosen = first;
        } else {
          for (let tier = 2; tier <= Math.min(3, options.maxTier); tier += 1) {
            const attempt = tryTier(tier, stallStart, units, empties);
            if (
              attempt.run.placements.size > 0 &&
              (chosen === null || attempt.run.sweeps < chosen.run.sweeps)
            ) {
              chosen = attempt;
            }
          }
          if (chosen === null && options.maxTier >= 4) {
            const run = runTier(4, stallStart, units, empties, 0, false);
            if (run.placements.size > 0) {
              chosen = { tier: 4, run };
            }
          }
        }
      } else {
        let carried: readonly ValueMask[] = stallStart;
        for (let tier = 1; tier <= options.maxTier; tier += 1) {
          const start = options.count === "fresh" ? stallStart : carried;
          const attempt = tryTier(tier, start, units, empties);
          if (attempt.run.placements.size > 0) {
            chosen = attempt;
            break;
          }
          if (options.count !== "fresh") {
            carried = attempt.run.candidates;
            if (options.count === "cum" && tier >= 2) {
              extraSweeps += attempt.run.sweeps - 1;
            }
          }
        }
      }
      if (chosen === null) {
        return { status: "stuck", steps, grid, cappedReads };
      }
      const { tier, run } = chosen;
      const found = run.placements.size;
      let placements = [...run.placements].sort(
        ([left], [right]) => left - right,
      );
      if (!options.batch) {
        placements = placements.slice(0, 1);
      }
      candidates = run.candidates;
      for (const [cell, value] of placements) {
        grid[cell] = value;
        unused = subtractMask(unused, maskOfValue(value));
      }
      steps.push({
        tier,
        sweeps: run.sweeps + (tier >= 2 ? extraSweeps : 0),
        placed: placements.length,
        found,
        kinds: [...run.kinds].sort(),
        lock: run.lock,
        combos: run.combos,
        chain: run.chain,
        cells: placements.map(([cell]) => cell),
      });
    }
  } catch (error) {
    if (error instanceof ReadContradiction) {
      return { status: "contradiction", steps, grid: null, cappedReads };
    }
    throw error;
  }
  return { status: "solved", steps, grid, cappedReads };
}
