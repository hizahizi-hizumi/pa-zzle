import {
  ANY_DIGIT_MASK,
  areAllLettersDecided,
  digitCountOfMask,
  digitsOfMask,
  type FukumenzanColumnModel,
} from "@/games/fukumenzan/problem/generation/column-model";

/**
 * 1つの桁の読み方。決まっていない文字と組は、どれも両辺で消える文字を除いて数える。
 * - `all-tuples`: 桁の式に合う組（足す側の文字・答えの文字・繰り上がりの値の組）を全部書き出す。
 * - `bounds-when-many`: 決まっていない文字が3つ以上で組が `tupleLimit` より多い桁は、和の大きさ（最小と最大）だけで読む。
 * - `skip-when-many`: 決まっていない文字が3つ以上で組が `tupleLimit` より多い桁は読まない（組が1つも無いことだけは見る）。
 */
export type FukumenzanColumnReading =
  | { kind: "all-tuples" }
  | { kind: "bounds-when-many"; tupleLimit: number }
  | { kind: "skip-when-many"; tupleLimit: number };

/**
 * 2つ以上の桁をまとめて読む上限。どちらも上限を超えたら、その組の桁はまとめて読まない。組の数は、まとめる桁のどれでも
 * 両辺で消える文字を除いて数える。
 * - `joined`: つないだ後の組の数が `cap` まで。
 * - `small-product-or-joined`: 桁ごとの組の数の積が `productCap` までなら全部をつなぎ、多ければつないだ後の組の数が `joinedCap` まで。
 */
export type FukumenzanGroupLimit =
  | { kind: "joined"; cap: number }
  | { kind: "small-product-or-joined"; productCap: number; joinedCap: number };

/**
 * 桁の式を桁の重みでまとめた式（隣り合う `windows` の桁数ずつ・`includesAllColumns` なら全部の桁）と、共通の文字を持つ2つの桁の
 * 式の差（`includesDifferences`）を読む。決まっていない変数が `enumerationLimit` 個までなら書き出し、多ければ和の大きさで読む。
 */
export type FukumenzanEquationReading = {
  windows: readonly number[];
  includesAllColumns: boolean;
  includesDifferences: boolean;
  enumerationLimit: number;
};

/**
 * 読み手の強さ。どの軸も、強める向きに変えると閉包が狭くなる単調な規則にしてある。
 * - `hiddenSingles`: 10文字の式で、1つの文字にしか入らない数字を決める。
 * - `nakedSubsets`: 2つか3つの文字の候補の和がちょうどその数なら、ほかの文字からその数字を消す。
 * - `pairProductLimit`: 2つの桁をまとめて読むのを、桁ごとの組の数（消える文字を除く）の積がこれ以下のときだけにする。
 */
export type FukumenzanReaderSettings = {
  column: FukumenzanColumnReading;
  hiddenSingles: boolean;
  nakedSubsets: boolean;
  adjacentPairs: FukumenzanGroupLimit | null;
  adjacentTriples: FukumenzanGroupLimit | null;
  sharedLetterPairs: FukumenzanGroupLimit | null;
  /** 隣り合わない3つの桁（一の位・百の位・千の位など）のまとめ。3つの中で隣り合う桁は繰り上がりでつなぐ。 */
  separatedTriples: FukumenzanGroupLimit | null;
  pairProductLimit: number | null;
  equations: FukumenzanEquationReading | null;
};

/**
 * まとめて読む桁の組。`linked` は繰り上がりでつながる隣り合う桁の組。`linked` でない組も、組の中で隣り合う桁の繰り上がりは
 * 合わせてつなぐ。
 */
export type FukumenzanColumnGroup = {
  columns: readonly number[];
  limit: FukumenzanGroupLimit;
  linked: boolean;
};

/** `Σ 係数 × 変数 = 0` の式。 */
type LinearEquation = {
  variables: readonly number[];
  coefficients: readonly number[];
};

export type FukumenzanReader = {
  model: FukumenzanColumnModel;
  settings: FukumenzanReaderSettings;
  /** 桁ごとの式。両辺に同じ係数で出る文字は係数が0になって消える。 */
  columnEquations: readonly LinearEquation[];
  groups: readonly FukumenzanColumnGroup[];
  algebraicEquations: readonly LinearEquation[];
  cancelledLettersCache: Map<string, ReadonlySet<number>>;
};

/**
 * 読みから出た事実。添字の変数の候補をこの集まりとの共通部分に狭める。何も言えない変数は `ANY_DIGIT_MASK`。
 * `null` は矛盾（組が1つも無い）。
 */
export type FukumenzanFacts = readonly number[] | null;

export type FukumenzanClosure = {
  status: "contradiction" | "stuck";
  domains: number[];
};

/**
 * 桁の組。値は4ビットずつ（`letters` の順。足す側・答え・左への繰り上がりが文字ならその文字の5つまで）、右から入る
 * 繰り上がりは20ビット目、左へ出る繰り上がりは24ビット目から。
 */
type ColumnTuples = {
  letters: readonly number[];
  codes: readonly number[];
  masks: readonly number[];
};

const CARRY_IN_SHIFT = 20;
const CARRY_OUT_SHIFT = 24;
const CARRY_BITS = (0xf << CARRY_IN_SHIFT) | (0xf << CARRY_OUT_SHIFT);

function getTupleValue(code: number, position: number): number {
  return (code >> (4 * position)) & 0xf;
}

function createColumnEquation(
  model: FukumenzanColumnModel,
  column: number,
): LinearEquation {
  const coefficients = new Map<number, number>();
  function add(variable: number, coefficient: number): void {
    coefficients.set(variable, (coefficients.get(variable) ?? 0) + coefficient);
  }
  const { terms, resultVariable, carryInVariable, carryOutVariable } =
    model.columns[column]!;
  for (const { variable, multiplicity } of terms) {
    add(variable, multiplicity);
  }
  add(resultVariable, -1);
  add(carryInVariable, 1);
  add(carryOutVariable, -10);
  return toLinearEquation(coefficients);
}

function toLinearEquation(coefficients: Map<number, number>): LinearEquation {
  const entries = [...coefficients].filter(([, coefficient]) => coefficient);
  return {
    variables: entries.map(([variable]) => variable),
    coefficients: entries.map(([, coefficient]) => coefficient),
  };
}

function listGroups(
  model: FukumenzanColumnModel,
  settings: FukumenzanReaderSettings,
): FukumenzanColumnGroup[] {
  const { columnCount, columnLetters } = model;
  const groups: FukumenzanColumnGroup[] = [];
  const {
    adjacentPairs,
    adjacentTriples,
    sharedLetterPairs,
    separatedTriples,
  } = settings;
  if (adjacentPairs !== null) {
    for (let column = 0; column + 1 < columnCount; column += 1) {
      groups.push({
        columns: [column, column + 1],
        limit: adjacentPairs,
        linked: true,
      });
    }
  }
  if (adjacentTriples !== null) {
    for (let column = 0; column + 2 < columnCount; column += 1) {
      groups.push({
        columns: [column, column + 1, column + 2],
        limit: adjacentTriples,
        linked: true,
      });
    }
  }
  if (sharedLetterPairs !== null) {
    for (let left = 0; left < columnCount; left += 1) {
      for (let right = left + 2; right < columnCount; right += 1) {
        const shared = [...columnLetters[left]!].some((letter) =>
          columnLetters[right]!.has(letter),
        );
        if (shared) {
          groups.push({
            columns: [left, right],
            limit: sharedLetterPairs,
            linked: false,
          });
        }
      }
    }
  }
  if (separatedTriples !== null) {
    for (let first = 0; first < columnCount; first += 1) {
      for (let second = first + 1; second < columnCount; second += 1) {
        for (let third = second + 1; third < columnCount; third += 1) {
          if (second === first + 1 && third === second + 1) {
            continue;
          }
          groups.push({
            columns: [first, second, third],
            limit: separatedTriples,
            linked: false,
          });
        }
      }
    }
  }
  return groups;
}

function listAlgebraicEquations(
  model: FukumenzanColumnModel,
  columnEquations: readonly LinearEquation[],
  reading: FukumenzanEquationReading | null,
): LinearEquation[] {
  if (reading === null) {
    return [];
  }
  const { columnCount, letterCount } = model;
  const widths = new Set(
    reading.windows.filter((width) => width <= columnCount),
  );
  if (reading.includesAllColumns) {
    widths.add(columnCount);
  }
  const equations: LinearEquation[] = [];
  for (const width of [...widths].sort((left, right) => left - right)) {
    for (let start = 0; start + width <= columnCount; start += 1) {
      const coefficients = new Map<number, number>();
      for (let offset = 0; offset < width; offset += 1) {
        const { variables, coefficients: columnCoefficients } =
          columnEquations[start + offset]!;
        for (const [index, variable] of variables.entries()) {
          coefficients.set(
            variable,
            (coefficients.get(variable) ?? 0) +
              columnCoefficients[index]! * 10 ** offset,
          );
        }
      }
      equations.push(toLinearEquation(coefficients));
    }
  }
  if (reading.includesDifferences) {
    for (let left = 0; left < columnCount; left += 1) {
      for (let right = left + 1; right < columnCount; right += 1) {
        const leftEquation = columnEquations[left]!;
        const rightEquation = columnEquations[right]!;
        const sharesLetter = leftEquation.variables.some(
          (variable) =>
            variable < letterCount &&
            rightEquation.variables.includes(variable),
        );
        if (!sharesLetter) {
          continue;
        }
        const coefficients = new Map<number, number>();
        for (const [index, variable] of leftEquation.variables.entries()) {
          coefficients.set(variable, leftEquation.coefficients[index]!);
        }
        for (const [index, variable] of rightEquation.variables.entries()) {
          coefficients.set(
            variable,
            (coefficients.get(variable) ?? 0) -
              rightEquation.coefficients[index]!,
          );
        }
        const difference = toLinearEquation(coefficients);
        if (difference.variables.length > 0) {
          equations.push(difference);
        }
      }
    }
  }
  return equations;
}

export function createFukumenzanReader(
  model: FukumenzanColumnModel,
  settings: FukumenzanReaderSettings,
): FukumenzanReader {
  const columnEquations = Array.from({ length: model.columnCount }, (_, j) =>
    createColumnEquation(model, j),
  );
  return {
    model,
    settings,
    columnEquations,
    groups: listGroups(model, settings),
    algebraicEquations: listAlgebraicEquations(
      model,
      columnEquations,
      settings.equations,
    ),
    cancelledLettersCache: new Map(),
  };
}

function createUnconstrainedFacts(model: FukumenzanColumnModel): number[] {
  return Array.from({ length: model.variableCount }, () => ANY_DIGIT_MASK);
}

function listColumnTuples(
  model: FukumenzanColumnModel,
  column: number,
  domains: readonly number[],
): ColumnTuples {
  const { terms, resultVariable, carryInVariable, carryOutVariable } =
    model.columns[column]!;
  const termCount = terms.length;
  const letters = terms.map(({ variable }) => variable);
  const resultPosition = letters.indexOf(resultVariable);
  if (resultPosition < 0) {
    letters.push(resultVariable);
  }
  const carryOutIsLetter = carryOutVariable < model.letterCount;
  const carryOutPosition = carryOutIsLetter
    ? letters.indexOf(carryOutVariable)
    : -1;
  const carryOutLetterPosition =
    carryOutIsLetter && carryOutPosition < 0 ? letters.length : -1;
  if (carryOutLetterPosition >= 0) {
    letters.push(carryOutVariable);
  }
  const termDigits = terms.map(
    ({ variable }) => digitsOfMask[domains[variable]!]!,
  );
  const multiplicities = terms.map(({ multiplicity }) => multiplicity);
  const resultMask = domains[resultVariable]!;
  const carryOutMask = domains[carryOutVariable]!;
  const codes: number[] = [];
  const masks: number[] = [];

  function extend(
    position: number,
    carryIn: number,
    sum: number,
    mask: number,
    code: number,
  ): void {
    if (position < termCount) {
      const multiplicity = multiplicities[position]!;
      for (const digit of termDigits[position]!) {
        if ((mask >> digit) & 1) {
          continue;
        }
        extend(
          position + 1,
          carryIn,
          sum + digit * multiplicity,
          mask | (1 << digit),
          code | (digit << (4 * position)),
        );
      }
      return;
    }
    const digit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    if (!((carryOutMask >> carryOut) & 1)) {
      return;
    }
    let tupleCode =
      code | (carryIn << CARRY_IN_SHIFT) | (carryOut << CARRY_OUT_SHIFT);
    let tupleMask = mask;
    if (resultPosition >= 0) {
      if (getTupleValue(code, resultPosition) !== digit) {
        return;
      }
    } else {
      if (!((resultMask >> digit) & 1) || (mask >> digit) & 1) {
        return;
      }
      tupleCode |= digit << (4 * termCount);
      tupleMask |= 1 << digit;
    }
    // 答えの先頭の文字は左への繰り上がりそのものなので、桁のほかの文字と同じ文字ならその値に等しく、違う文字なら違う数字。
    if (carryOutPosition >= 0) {
      if (getTupleValue(tupleCode, carryOutPosition) !== carryOut) {
        return;
      }
    } else if (carryOutLetterPosition >= 0) {
      if ((tupleMask >> carryOut) & 1) {
        return;
      }
      tupleCode |= carryOut << (4 * carryOutLetterPosition);
      tupleMask |= 1 << carryOut;
    }
    codes.push(tupleCode);
    masks.push(tupleMask);
  }

  for (const carryIn of digitsOfMask[domains[carryInVariable]!]!) {
    extend(0, carryIn, carryIn, 0, 0);
  }
  return { letters, codes, masks };
}

function collectTupleFacts(
  model: FukumenzanColumnModel,
  column: number,
  { letters, codes }: ColumnTuples,
): FukumenzanFacts {
  if (codes.length === 0) {
    return null;
  }
  const facts = createUnconstrainedFacts(model);
  const supports = letters.map(() => 0);
  let carryIns = 0;
  let carryOuts = 0;
  for (const code of codes) {
    for (let position = 0; position < letters.length; position += 1) {
      supports[position]! |= 1 << getTupleValue(code, position);
    }
    carryIns |= 1 << ((code >> CARRY_IN_SHIFT) & 0xf);
    carryOuts |= 1 << ((code >> CARRY_OUT_SHIFT) & 0xf);
  }
  const { carryInVariable, carryOutVariable } = model.columns[column]!;
  facts[carryInVariable] = carryIns;
  facts[carryOutVariable] = carryOuts;
  for (const [position, letter] of letters.entries()) {
    facts[letter] = supports[position]!;
  }
  return facts;
}

/** 組を `keptLetters` の文字と繰り上がりだけに縮めたときの、違う組の数。 */
function countProjectedTuples(
  { letters, codes }: ColumnTuples,
  keptLetters: ReadonlySet<number>,
): number {
  let keptBits = CARRY_BITS;
  for (const [position, letter] of letters.entries()) {
    if (keptLetters.has(letter)) {
      keptBits |= 0xf << (4 * position);
    }
  }
  return new Set(codes.map((code) => code & keptBits)).size;
}

type WeightedVariable = { variable: number; coefficient: number };

/**
 * 違う文字は違う数字として、`Σ 係数 × 文字` の最小と最大を求める。`excluded` の数字はどの文字にも当てない。
 * 当てられる数字の並びが無ければ `null`。文字を順に当て、使った数字の集まりごとに和の最小と最大を持つ。
 */
function boundDistinctSum(
  letters: readonly WeightedVariable[],
  domains: readonly number[],
  excluded: number,
): readonly [number, number] | null {
  let ranges = new Map<number, [number, number]>([[excluded, [0, 0]]]);
  for (const { variable, coefficient } of letters) {
    const next = new Map<number, [number, number]>();
    for (const [used, [low, high]] of ranges) {
      for (const digit of digitsOfMask[domains[variable]! & ~used]!) {
        const key = used | (1 << digit);
        const value = coefficient * digit;
        const range = next.get(key);
        if (range === undefined) {
          next.set(key, [low + value, high + value]);
        } else {
          range[0] = Math.min(range[0], low + value);
          range[1] = Math.max(range[1], high + value);
        }
      }
    }
    if (next.size === 0) {
      return null;
    }
    ranges = next;
  }
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const range of ranges.values()) {
    low = Math.min(low, range[0]);
    high = Math.max(high, range[1]);
  }
  return [low, high];
}

/**
 * 式 `Σ 係数 × 変数 = 0` を和の大きさで読み、合わない値を `domains` から消す。矛盾なら `false`。
 * 同じ側（係数の符号が同じ）の違う文字の最小と最大は違う数字で取る（足す文字が2つなら 9＋8 まで）。
 * 文字の値を調べるときは、その数字をほかのどの文字にも当てない。反対の側の文字どうしの違いと、繰り上がりは区間のまま読む。
 */
function propagateSumBounds(
  equation: LinearEquation,
  domains: number[],
  letterCount: number,
): boolean {
  const terms = equation.variables.map((variable, index) => ({
    variable,
    coefficient: equation.coefficients[index]!,
  }));
  const sides = [
    terms.filter(
      ({ variable, coefficient }) => variable < letterCount && coefficient > 0,
    ),
    terms.filter(
      ({ variable, coefficient }) => variable < letterCount && coefficient < 0,
    ),
  ];
  const carries = terms.filter(({ variable }) => variable >= letterCount);
  for (;;) {
    let moved = false;
    for (const { variable, coefficient } of terms) {
      const isLetter = variable < letterCount;
      let kept = 0;
      for (const digit of digitsOfMask[domains[variable]!]!) {
        let low = coefficient * digit;
        let high = low;
        let feasible = true;
        for (const side of sides) {
          const bound = boundDistinctSum(
            side.filter((term) => term.variable !== variable),
            domains,
            isLetter ? 1 << digit : 0,
          );
          if (bound === null) {
            feasible = false;
            break;
          }
          low += bound[0];
          high += bound[1];
        }
        for (const carry of carries) {
          if (carry.variable === variable) {
            continue;
          }
          const digits = digitsOfMask[domains[carry.variable]!]!;
          const first = carry.coefficient * digits[0]!;
          const last = carry.coefficient * digits[digits.length - 1]!;
          low += Math.min(first, last);
          high += Math.max(first, last);
        }
        if (feasible && low <= 0 && 0 <= high) {
          kept |= 1 << digit;
        }
      }
      if (kept === 0) {
        return false;
      }
      if (kept !== domains[variable]) {
        domains[variable] = kept;
        moved = true;
      }
    }
    if (!moved) {
      return true;
    }
  }
}

function readColumnBounds(
  reader: FukumenzanReader,
  column: number,
  domains: readonly number[],
): FukumenzanFacts {
  const { model } = reader;
  const equation = reader.columnEquations[column]!;
  const touched = new Set([
    ...equation.variables,
    ...model.columnLetters[column]!,
    model.columns[column]!.carryInVariable,
    model.columns[column]!.carryOutVariable,
  ]);
  if ([...touched].some((variable) => domains[variable] === 0)) {
    return null;
  }
  const narrowed = [...domains];
  if (!propagateSumBounds(equation, narrowed, model.letterCount)) {
    return null;
  }
  const facts = createUnconstrainedFacts(model);
  for (const variable of touched) {
    facts[variable] = narrowed[variable]!;
  }
  return facts;
}

function countUndecided(
  variables: Iterable<number>,
  domains: readonly number[],
  counted: ReadonlySet<number> | null = null,
): number {
  let count = 0;
  for (const variable of variables) {
    if (
      digitCountOfMask[domains[variable]!]! > 1 &&
      (counted === null || counted.has(variable))
    ) {
      count += 1;
    }
  }
  return count;
}

export function readFukumenzanColumn(
  reader: FukumenzanReader,
  column: number,
  domains: readonly number[],
): FukumenzanFacts {
  const { model, settings } = reader;
  const reading = settings.column;
  const tuples = listColumnTuples(model, column, domains);
  if (reading.kind === "all-tuples" || tuples.codes.length === 0) {
    return collectTupleFacts(model, column, tuples);
  }
  const remaining = new Set(reader.columnEquations[column]!.variables);
  const isHeavy =
    countUndecided(model.columnLetters[column]!, domains, remaining) > 2 &&
    countProjectedTuples(tuples, remaining) > reading.tupleLimit;
  if (!isHeavy) {
    return collectTupleFacts(model, column, tuples);
  }
  return reading.kind === "bounds-when-many"
    ? readColumnBounds(reader, column, domains)
    : createUnconstrainedFacts(model);
}

export function readFukumenzanTable(
  reader: FukumenzanReader,
  domains: readonly number[],
): FukumenzanFacts {
  const { model, settings } = reader;
  const { letterCount } = model;
  let decided = 0;
  for (let letter = 0; letter < letterCount; letter += 1) {
    if (digitCountOfMask[domains[letter]!] === 1) {
      if (decided & domains[letter]!) {
        return null;
      }
      decided |= domains[letter]!;
    }
  }
  const facts = createUnconstrainedFacts(model);
  for (let letter = 0; letter < letterCount; letter += 1) {
    if (digitCountOfMask[domains[letter]!]! > 1 && domains[letter]! & decided) {
      facts[letter] = domains[letter]! & ~decided;
    }
  }
  if (letterCount === 10 && settings.hiddenSingles) {
    for (let digit = 0; digit < 10; digit += 1) {
      const holders: number[] = [];
      for (let letter = 0; letter < letterCount; letter += 1) {
        if ((domains[letter]! >> digit) & 1) {
          holders.push(letter);
        }
      }
      if (holders.length === 0) {
        return null;
      }
      const [holder] = holders;
      if (holders.length === 1 && digitCountOfMask[domains[holder!]!]! > 1) {
        facts[holder!]! &= 1 << digit;
      }
    }
  }
  if (settings.nakedSubsets) {
    const undecided: number[] = [];
    for (let letter = 0; letter < letterCount; letter += 1) {
      if (digitCountOfMask[domains[letter]!]! > 1) {
        undecided.push(letter);
      }
    }
    for (const size of [2, 3]) {
      for (const subset of listCombinations(undecided, size)) {
        let union = 0;
        for (const letter of subset) {
          union |= domains[letter]!;
        }
        const unionSize = digitCountOfMask[union]!;
        if (unionSize < size) {
          return null;
        }
        if (unionSize === size) {
          for (const letter of undecided) {
            if (!subset.includes(letter) && domains[letter]! & union) {
              facts[letter]! &= ~union;
            }
          }
        }
      }
    }
  }
  return facts;
}

function listCombinations(values: readonly number[], size: number): number[][] {
  if (size === 0) {
    return [[]];
  }
  return values.flatMap((value, index) =>
    listCombinations(values.slice(index + 1), size - 1).map((rest) => [
      value,
      ...rest,
    ]),
  );
}

/** どの桁でも、その桁の式から消える文字（両辺に同じ係数で出る文字）。 */
function getCancelledLetters(
  reader: FukumenzanReader,
  columns: readonly number[],
): ReadonlySet<number> {
  const key = columns.join(",");
  const cached = reader.cancelledLettersCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const occurring = new Set(
    columns.flatMap((column) => [...reader.model.columnLetters[column]!]),
  );
  const cancelled = new Set(
    [...occurring].filter((letter) =>
      columns.every(
        (column) =>
          !reader.model.columnLetters[column]!.has(letter) ||
          !reader.columnEquations[column]!.variables.includes(letter),
      ),
    ),
  );
  reader.cancelledLettersCache.set(key, cancelled);
  return cancelled;
}

/** つないだ組の途中。繰り上がりは、まとめる桁の並びの位置ごとに持ち、まだつないでいない桁は -1。 */
type JoinedPart = {
  assigned: readonly number[];
  assignedCount: number;
  mask: number;
  carryIns: readonly number[];
  carryOuts: readonly number[];
};

/** 3つの桁は、どの順でつないでもよい。どの段もつないだ組が上限までに収まる順があれば、その順で読む。 */
const TRIPLE_JOIN_ORDERS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/**
 * まとめる桁の組を `order` の順につなぐ。組の中で隣り合う桁の繰り上がりは合わせる。2つ目の桁から、つないだ組
 * （消える文字を除いた文字の値・最初につないだ桁に入る繰り上がり・つないだ桁から出る繰り上がり）が `joinedCap` を
 * 超えたら `"exceeded"`。合う組が無ければ `null`。
 */
function joinGroupTuples(
  model: FukumenzanColumnModel,
  columns: readonly number[],
  tupleLists: readonly ColumnTuples[],
  cancelled: ReadonlySet<number>,
  joinedCap: number | null,
  order: readonly number[],
): JoinedPart[] | "exceeded" | null {
  let parts: JoinedPart[] = [
    {
      assigned: Array.from({ length: model.letterCount }, () => -1),
      assignedCount: 0,
      mask: 0,
      carryIns: columns.map(() => -1),
      carryOuts: columns.map(() => -1),
    },
  ];
  for (const [stage, position] of order.entries()) {
    const column = columns[position]!;
    const previous = columns.indexOf(column - 1);
    const following = columns.indexOf(column + 1);
    const { letters, codes, masks } = tupleLists[position]!;
    const next: JoinedPart[] = [];
    const seen = new Set<string>();
    for (const part of parts) {
      for (const [index, code] of codes.entries()) {
        const carryIn = (code >> CARRY_IN_SHIFT) & 0xf;
        const carryOut = (code >> CARRY_OUT_SHIFT) & 0xf;
        if (
          (previous >= 0 &&
            part.carryOuts[previous]! >= 0 &&
            carryIn !== part.carryOuts[previous]) ||
          (following >= 0 &&
            part.carryIns[following]! >= 0 &&
            carryOut !== part.carryIns[following])
        ) {
          continue;
        }
        let agrees = true;
        let added = 0;
        for (const [letterPosition, letter] of letters.entries()) {
          const value = part.assigned[letter]!;
          if (value < 0) {
            added += 1;
          } else if (value !== getTupleValue(code, letterPosition)) {
            agrees = false;
            break;
          }
        }
        if (!agrees) {
          continue;
        }
        const mask = part.mask | masks[index]!;
        const assignedCount = part.assignedCount + added;
        if (digitCountOfMask[mask] !== assignedCount) {
          continue;
        }
        const assigned = [...part.assigned];
        for (const [letterPosition, letter] of letters.entries()) {
          assigned[letter] = getTupleValue(code, letterPosition);
        }
        const carryIns = [...part.carryIns];
        const carryOuts = [...part.carryOuts];
        carryIns[position] = carryIn;
        carryOuts[position] = carryOut;
        next.push({ assigned, assignedCount, mask, carryIns, carryOuts });
        if (joinedCap === null || stage === 0) {
          continue;
        }
        const joinedCarryOuts = order
          .slice(0, stage + 1)
          .map((joined) => carryOuts[joined]);
        seen.add(
          `${assigned.map((value, letter) => (cancelled.has(letter) ? -1 : value)).join(",")}|${carryIns[order[0]!]}|${joinedCarryOuts.join(",")}`,
        );
        if (seen.size > joinedCap) {
          return "exceeded";
        }
      }
    }
    parts = next;
    if (parts.length === 0) {
      return null;
    }
  }
  return parts;
}

export function readFukumenzanGroup(
  reader: FukumenzanReader,
  group: FukumenzanColumnGroup,
  domains: readonly number[],
): FukumenzanFacts {
  const { model, settings } = reader;
  const { columns, limit, linked } = group;
  const tupleLists = columns.map((column) =>
    listColumnTuples(model, column, domains),
  );
  if (tupleLists.some(({ codes }) => codes.length === 0)) {
    return null;
  }
  const cancelled = getCancelledLetters(reader, columns);
  const remaining = new Set(
    tupleLists
      .flatMap(({ letters }) => letters)
      .filter((letter) => !cancelled.has(letter)),
  );
  if (settings.pairProductLimit !== null && columns.length === 2) {
    const product = tupleLists.reduce(
      (total, tuples) => total * countProjectedTuples(tuples, remaining),
      1,
    );
    if (product > settings.pairProductLimit) {
      return createUnconstrainedFacts(model);
    }
  }
  let joinedCap: number | null = limit.kind === "joined" ? limit.cap : null;
  if (limit.kind === "small-product-or-joined") {
    const product = tupleLists.reduce(
      (total, tuples) => total * countProjectedTuples(tuples, remaining),
      1,
    );
    joinedCap = product <= limit.productCap ? null : limit.joinedCap;
  }

  const orders = columns.length === 3 ? TRIPLE_JOIN_ORDERS : [[0, 1]];
  let parts: JoinedPart[] | "exceeded" | null = "exceeded";
  for (const order of orders) {
    parts = joinGroupTuples(
      model,
      columns,
      tupleLists,
      cancelled,
      joinedCap,
      order,
    );
    if (parts !== "exceeded") {
      break;
    }
  }
  if (parts === null) {
    return null;
  }
  if (parts === "exceeded") {
    return createUnconstrainedFacts(model);
  }

  const facts = createUnconstrainedFacts(model);
  const groupLetters = new Set(tupleLists.flatMap(({ letters }) => letters));
  for (const letter of groupLetters) {
    facts[letter] = 0;
  }
  const carryFacts = linked
    ? columns.flatMap((column, position) => [
        {
          variable: model.columns[column]!.carryInVariable,
          read: (part: JoinedPart) => part.carryIns[position]!,
        },
        {
          variable: model.columns[column]!.carryOutVariable,
          read: (part: JoinedPart) => part.carryOuts[position]!,
        },
      ])
    : [];
  for (const { variable } of carryFacts) {
    facts[variable] = 0;
  }
  for (const part of parts) {
    for (const letter of groupLetters) {
      facts[letter]! |= 1 << part.assigned[letter]!;
    }
    for (const { variable, read } of carryFacts) {
      facts[variable]! |= 1 << read(part);
    }
  }
  return facts;
}

/** 式 `Σ 係数 × 変数 = 0` を、決まっていない変数が少なければ書き出し（文字は互いに違う数字）、多ければ和の大きさで読む。 */
function readAlgebraicEquation(
  reader: FukumenzanReader,
  equation: LinearEquation,
  domains: readonly number[],
): FukumenzanFacts {
  const { model } = reader;
  const { variables, coefficients } = equation;
  if (variables.some((variable) => domains[variable] === 0)) {
    return null;
  }
  const facts = createUnconstrainedFacts(model);
  const undecided = countUndecided(variables, domains);
  const enumerationLimit = reader.settings.equations!.enumerationLimit;
  if (undecided > enumerationLimit) {
    const narrowed = [...domains];
    if (!propagateSumBounds(equation, narrowed, model.letterCount)) {
      return null;
    }
    for (const variable of variables) {
      facts[variable] = narrowed[variable]!;
    }
    return facts;
  }
  const supports = variables.map(() => 0);
  const values = variables.map(() => 0);
  let found = false;
  function enumerate(index: number, sum: number, letterMask: number): void {
    if (index === variables.length) {
      if (sum !== 0) {
        return;
      }
      found = true;
      for (const [position, value] of values.entries()) {
        supports[position]! |= 1 << value;
      }
      return;
    }
    const variable = variables[index]!;
    const isLetter = variable < model.letterCount;
    for (const digit of digitsOfMask[domains[variable]!]!) {
      if (isLetter && (letterMask >> digit) & 1) {
        continue;
      }
      values[index] = digit;
      enumerate(
        index + 1,
        sum + coefficients[index]! * digit,
        isLetter ? letterMask | (1 << digit) : letterMask,
      );
    }
  }
  enumerate(0, 0, 0);
  if (!found) {
    return null;
  }
  for (const [position, variable] of variables.entries()) {
    facts[variable] = supports[position]!;
  }
  return facts;
}

/** 事実を候補へ入れる。何かが狭まったら `true`、矛盾したら `null`。 */
function applyFacts(
  domains: number[],
  facts: readonly number[],
): boolean | null {
  let changed = false;
  for (const [variable, mask] of facts.entries()) {
    const narrowed = domains[variable]! & mask;
    if (narrowed !== domains[variable]) {
      domains[variable] = narrowed;
      changed = true;
      if (narrowed === 0) {
        return null;
      }
    }
  }
  return changed;
}

/**
 * 読みの閉包。桁を一の位から順に読み、何も変わらなくなったら表を読み、それでも変わらなければまとめて読む桁の組を順に読む。
 * どの規則も候補を減らすだけなので、読む順に依らず同じ盤面に止まる。式の読みを持つ読み手は、止まった盤面で式を順に読み、
 * 何かが狭まったら読み直す。
 */
export function closeFukumenzanDomains(
  reader: FukumenzanReader,
  initial: readonly number[],
): FukumenzanClosure {
  const domains = [...initial];
  for (;;) {
    const status = closeWithoutEquations(reader, domains);
    if (status === "contradiction") {
      return { status, domains };
    }
    let moved = false;
    for (const equation of reader.algebraicEquations) {
      const facts = readAlgebraicEquation(reader, equation, domains);
      const changed = facts === null ? null : applyFacts(domains, facts);
      if (changed === null) {
        return { status: "contradiction", domains };
      }
      if (changed) {
        moved = true;
        break;
      }
    }
    if (!moved) {
      return { status: "stuck", domains };
    }
  }
}

function closeWithoutEquations(
  reader: FukumenzanReader,
  domains: number[],
): "contradiction" | "stuck" {
  const { columnCount } = reader.model;
  for (;;) {
    let changed = false;
    for (let column = 0; column < columnCount; column += 1) {
      const facts = readFukumenzanColumn(reader, column, domains);
      const applied = facts === null ? null : applyFacts(domains, facts);
      if (applied === null) {
        return "contradiction";
      }
      changed ||= applied;
    }
    if (changed) {
      continue;
    }
    const tableFacts = readFukumenzanTable(reader, domains);
    const tableApplied =
      tableFacts === null ? null : applyFacts(domains, tableFacts);
    if (tableApplied === null) {
      return "contradiction";
    }
    if (tableApplied) {
      continue;
    }
    for (const group of reader.groups) {
      const facts = readFukumenzanGroup(reader, group, domains);
      const applied = facts === null ? null : applyFacts(domains, facts);
      if (applied === null) {
        return "contradiction";
      }
      if (applied) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      return "stuck";
    }
  }
}

/** 場合分けなしで、全部の文字が決まるか。 */
export function solvesWithoutSplitting(
  reader: FukumenzanReader,
  initial: readonly number[],
): boolean {
  const { status, domains } = closeFukumenzanDomains(reader, initial);
  return (
    status !== "contradiction" && areAllLettersDecided(reader.model, domains)
  );
}
