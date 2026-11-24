import {
  closeBlockers,
  listNaiveMoves,
  listSafeMoves,
} from "@/games/shuttle-parking/problem/generation/readers";
import {
  type AnalysisGame,
  type AnalysisState,
  countBits,
  createAnalysisStateKey,
  iterateBits,
} from "@/games/shuttle-parking/problem/generation/state-game";

/**
 * 先読みせず、前もって固定した規則だけで出す人（素朴な解き方の組）。上位の問題が規則だけで勝ててしまわないかを測るのに使う。
 * 規則は「候補の作り方」と「候補の中の選び方（鍵の小さい車）」の組。鍵が並んだ車の選び方（同点の選び方）は別に決める。
 * - 候補 `cheapest`: 素朴な解き方（先頭の色の車をすぐ出せれば出し、無ければ塞ぎの最も少ない先頭の色の車を掘る）。
 * - 候補 `wide`: 掘る場面で、どの先頭の色の車を掘ってもよい。
 * - 候補 `deep`: 先頭の色の車のうち、出すのに要る台数が空いている待機枠に収まる中で、最も深く埋まった車を掘る。
 * - 候補 `all`: 待機枠がすぐ埋まる手を除いた、出せる車すべて。
 * `deepCommit` は `deep` と同じ目標を選び、選んだ目標の車を出すまで目標を変えない（掘った車を使い切る）。
 * `untangle` は直接ふさいでいる車の台数で、`untangleDeep` はふさぎを何段もたどった台数（その車がいないと出られない車の台数）で選ぶ。
 */
type CandidateBase = "cheapest" | "wide" | "deep" | "all";
type RuleKey =
  | "any"
  | "small"
  | "big"
  | "unblock"
  | "needed"
  | "fill"
  | "untangle"
  | "untangleDeep"
  | "unblockDeep";

export const SHUTTLE_PARKING_NAIVE_RULES = {
  any: ["cheapest", "any"],
  small: ["cheapest", "small"],
  big: ["cheapest", "big"],
  unblock: ["cheapest", "unblock"],
  needed: ["cheapest", "needed"],
  fill: ["cheapest", "fill"],
  wideNeeded: ["wide", "needed"],
  wideFill: ["wide", "fill"],
  deepDig: ["deep", "any"],
  deepCommit: ["deep", "any"],
  untangle: ["all", "untangle"],
  untangleDeep: ["all", "untangleDeep"],
} as const satisfies Record<string, readonly [CandidateBase, RuleKey]>;

export type ShuttleParkingNaiveRule = keyof typeof SHUTTLE_PARKING_NAIVE_RULES;

/**
 * 鍵が並んだ車の選び方。`uniform` は一様に選ぶ（勝率はその平均）。ほかは、並んだ車をこの鍵（規則の鍵と同じ定義）で
 * さらに絞り、それでも並べば一様に選ぶ。`unblockDeep` は `unblock` のふさぐ台数を、何段もたどった台数にしたもの。
 * 素朴な規則の上限は、規則ごと・選び方ごとの勝率の最大で見る。
 */
export const SHUTTLE_PARKING_TIE_BREAKS = [
  "uniform",
  "needed",
  "unblock",
  "unblockDeep",
  "fill",
  "small",
  "big",
] as const;
export type ShuttleParkingTieBreak =
  (typeof SHUTTLE_PARKING_TIE_BREAKS)[number];

/** 調査コード（`shuttle-parking_difficulty.py`）が持つ8つの規則。移植の確かめに使う。 */
export const SHUTTLE_PARKING_RESEARCH_RULES = [
  "any",
  "small",
  "big",
  "unblock",
  "needed",
  "fill",
  "wideNeeded",
  "wideFill",
] as const satisfies readonly ShuttleParkingNaiveRule[];

const NO_SHORTAGE = 10 ** 6;

/** `carId` を出すのに出す車（`carId` を含む）。進路ごとに求めて最も少ないもの。 */
function closeExit(game: AnalysisGame, mask: number, carId: number): number {
  let best: number | null = null;
  for (const ray of game.sides[carId]!) {
    const closure = closeBlockers(game.sides, mask, ray & mask) | (1 << carId);
    if (best === null || countBits(closure) < countBits(best)) best = closure;
  }
  return best ?? 1 << carId;
}

/** 残っている車のうち、出すのに `carId` を出す必要がある車（ふさぎを何段もたどる）。 */
function countDependents(
  game: AnalysisGame,
  state: AnalysisState,
  carId: number,
): number {
  const { mask } = state;
  let count = 0;
  for (const other of iterateBits(mask)) {
    if (other !== carId && (closeExit(game, mask, other) >> carId) & 1) {
      count += 1;
    }
  }
  return count;
}

function firstAppearance(
  game: AnalysisGame,
  state: AnalysisState,
  carId: number,
): number {
  const first = game.queueColors.indexOf(
    game.colorOf[carId]!,
    game.progress(state),
  );
  return first < 0 ? NO_SHORTAGE : first;
}

/** 残っている車のうち、いま出られず、`carId` がその進路の上にいる車。 */
function listBlockedBy(
  game: AnalysisGame,
  state: AnalysisState,
  carId: number,
): number[] {
  const { mask } = state;
  return [...iterateBits(mask)].filter(
    (other) =>
      other !== carId &&
      game.sides[other]!.every((ray) => ray & mask) &&
      game.sides[other]!.some((ray) => (ray >> carId) & 1),
  );
}

/** 色ごとに、外に出ている車の空き座席と、いますぐ出せる車（`excluded` 以外）の座席で、列のどこで足りなくなるか。 */
function findShortages(
  game: AnalysisGame,
  state: AnalysisState,
  excluded: number,
): Map<number, number> {
  const [head, freeSeats] = game.info(state.mask);
  const supply = [...freeSeats];
  for (const carId of game.geometricMoves(state.mask)) {
    if (carId !== excluded)
      supply[game.colorOf[carId]!]! += game.lengths[carId]!;
  }
  const shortages = new Map<number, number>();
  for (let index = head; index < game.queueColors.length; index += 1) {
    const color = game.queueColors[index]!;
    if (supply[color]! > 0) supply[color]! -= 1;
    else if (!shortages.has(color)) shortages.set(color, index);
  }
  return shortages;
}

const ruleKeys = {
  any: () => [0],
  small: (game, _, carId) => [game.lengths[carId]!],
  big: (game, _, carId) => [-game.lengths[carId]!],
  unblock: (game, state, carId) => [
    -listBlockedBy(game, state, carId).length,
    game.lengths[carId]!,
  ],
  // 塞いでいる車の色が最も早く足りなくなる車を先に。並べば定員の小さい車。
  needed: (game, state, carId) => {
    const shortages = findShortages(game, state, carId);
    return [
      Math.min(
        NO_SHORTAGE,
        ...listBlockedBy(game, state, carId).map(
          (other) => shortages.get(game.colorOf[other]!) ?? NO_SHORTAGE,
        ),
      ),
      game.lengths[carId]!,
    ];
  },
  // 出すと座席が最も早く埋まって出ていく車を先に（その色の列の何人目で埋まるか）。
  fill: (game, state, carId) => {
    const [head, supply] = game.info(state.mask);
    const color = game.colorOf[carId]!;
    const target = supply[color]! + game.lengths[carId]!;
    let seen = 0;
    for (let index = head; index < game.queueColors.length; index += 1) {
      if (game.queueColors[index] === color) {
        seen += 1;
        if (seen === target) return [index];
      }
    }
    return [NO_SHORTAGE];
  },
  // 進路をふさいでいる「いま出られない車」が最も多い車を先に。並べば、その色が列の先頭から最初に現れる位置が前の車。
  untangle: (game, state, carId) => [
    -listBlockedBy(game, state, carId).length,
    firstAppearance(game, state, carId),
  ],
  // 出すのにその車を出す必要がある車（ふさぎを何段もたどる）が最も多い車を先に。並べば `untangle` と同じ。
  untangleDeep: (game, state, carId) => [
    -countDependents(game, state, carId),
    firstAppearance(game, state, carId),
  ],
  unblockDeep: (game, state, carId) => [
    -countDependents(game, state, carId),
    game.lengths[carId]!,
  ],
} as const satisfies Record<
  RuleKey,
  (game: AnalysisGame, state: AnalysisState, carId: number) => number[]
>;

function compareKeys(
  left: readonly number[],
  right: readonly number[],
): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function listWideMoves(game: AnalysisGame, state: AnalysisState): number[] {
  const moves = listSafeMoves(game, state);
  if (moves.length === 0) return [];
  const { mask } = state;
  const headMask =
    game.colorMasks[game.queueColors[game.progress(state)]!]! & mask;
  const direct = moves.filter((carId) => (headMask >> carId) & 1);
  if (direct.length) return direct;
  let seeds = 0;
  for (const carId of iterateBits(headMask)) {
    for (const ray of game.sides[carId]!) seeds |= ray & mask;
  }
  const dig = closeBlockers(game.sides, mask, seeds);
  const digging = moves.filter((carId) => (dig >> carId) & 1);
  return digging.length ? digging : moves;
}

/** `deep` の目標: 先頭の色の車のうち、出すのに出す車の台数が空いている待機枠以下で、その台数が最も多い車（並べば全部）。 */
function listDeepTargets(game: AnalysisGame, state: AnalysisState): number[] {
  const { mask } = state;
  const headMask =
    game.colorMasks[game.queueColors[game.progress(state)]!]! & mask;
  const freeBays = game.bays - game.waiting(state);
  const fitting = [...iterateBits(headMask)]
    .map((carId) => ({ carId, closure: closeExit(game, mask, carId) }))
    .filter(({ closure }) => countBits(closure) <= freeBays);
  if (fitting.length === 0) return [];
  const deepest = Math.max(...fitting.map(({ closure }) => countBits(closure)));
  return fitting
    .filter(({ closure }) => countBits(closure) === deepest)
    .map(({ carId }) => carId);
}

/** `targets` を出すのに出す車のうち、いま出せる安全な手。無ければ素朴の候補。 */
function listDiggingMoves(
  game: AnalysisGame,
  state: AnalysisState,
  moves: readonly number[],
  targets: readonly number[],
): number[] {
  const dig = targets.reduce(
    (union, carId) => union | closeExit(game, state.mask, carId),
    0,
  );
  const digging = moves.filter((carId) => (dig >> carId) & 1);
  return digging.length ? digging : listNaiveMoves(game, state);
}

function listDeepMoves(game: AnalysisGame, state: AnalysisState): number[] {
  const moves = listSafeMoves(game, state);
  if (moves.length === 0) return [];
  const targets = listDeepTargets(game, state);
  return targets.length
    ? listDiggingMoves(game, state, moves, targets)
    : listNaiveMoves(game, state);
}

const candidateBases = {
  cheapest: listNaiveMoves,
  wide: listWideMoves,
  deep: listDeepMoves,
  all: listSafeMoves,
} as const satisfies Record<
  CandidateBase,
  (game: AnalysisGame, state: AnalysisState) => number[]
>;

function filterByKey(
  game: AnalysisGame,
  state: AnalysisState,
  options: readonly number[],
  keyName: RuleKey,
): number[] {
  if (options.length <= 1) return [...options];
  const keys = options.map((carId) => ruleKeys[keyName](game, state, carId));
  const best = keys.reduce((lowest, key) =>
    compareKeys(key, lowest) < 0 ? key : lowest,
  );
  return options.filter((_, index) => compareKeys(keys[index]!, best) === 0);
}

function breakTies(
  game: AnalysisGame,
  state: AnalysisState,
  options: readonly number[],
  tieBreak: ShuttleParkingTieBreak,
): number[] {
  return tieBreak === "uniform"
    ? [...options]
    : filterByKey(game, state, options, tieBreak);
}

function listRuleMoves(
  game: AnalysisGame,
  state: AnalysisState,
  rule: ShuttleParkingNaiveRule,
  tieBreak: ShuttleParkingTieBreak,
): number[] {
  const [base, keyName] = SHUTTLE_PARKING_NAIVE_RULES[rule];
  const options = candidateBases[base](game, state);
  if (options.length === 0) return [];
  return breakTies(
    game,
    state,
    filterByKey(game, state, options, keyName),
    tieBreak,
  );
}

const NO_TARGET = -1;

/**
 * `deepCommit` の候補と、それぞれの手の後の目標。目標の車が残っていて先頭の色なら、目標を変えない。
 * 新しく選ぶ目標が並べば、同点の選び方で絞る。
 */
function listCommittedMoves(
  game: AnalysisGame,
  state: AnalysisState,
  target: number,
  tieBreak: ShuttleParkingTieBreak,
): { carId: number; next: number }[][] {
  const moves = listSafeMoves(game, state);
  if (moves.length === 0) return [];
  const headMask =
    game.colorMasks[game.queueColors[game.progress(state)]!]! & state.mask;
  const kept = target !== NO_TARGET && (headMask >> target) & 1;
  const targets = kept
    ? [target]
    : breakTies(game, state, listDeepTargets(game, state), tieBreak);
  if (targets.length === 0) {
    return [
      breakTies(game, state, listNaiveMoves(game, state), tieBreak).map(
        (carId) => ({ carId, next: NO_TARGET }),
      ),
    ];
  }
  return targets.map((goal) => {
    const digging = moves.includes(goal)
      ? [goal]
      : listDiggingMoves(game, state, moves, [goal]);
    return breakTies(game, state, digging, tieBreak).map((carId) => ({
      carId,
      next: carId === goal ? NO_TARGET : goal,
    }));
  });
}

/**
 * 規則だけで出す人の勝率。`tieBreak` が `uniform` なら並んだ車を一様に選ぶ。
 * `deepCommit` は、並んだ目標を `tieBreak` で絞って残りを一様に選び、目標ごとの候補をさらに `tieBreak` で選ぶ。
 */
export function measureShuttleParkingRuleWinProbability(
  game: AnalysisGame,
  rule: ShuttleParkingNaiveRule,
  tieBreak: ShuttleParkingTieBreak = "uniform",
): number {
  const cache = new Map<string, number>();
  const average = (values: readonly number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  const value = (state: AnalysisState, target: number): number => {
    if (state.mask === 0) return 1;
    if (!game.wins(state)) return 0;
    const key = `${createAnalysisStateKey(state)}|${target}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result =
      rule === "deepCommit"
        ? average(
            listCommittedMoves(game, state, target, tieBreak).map((options) =>
              average(
                options.map(({ carId, next }) =>
                  value(game.step(state, carId), next),
                ),
              ),
            ),
          )
        : average(
            listRuleMoves(game, state, rule, tieBreak).map((carId) =>
              value(game.step(state, carId), NO_TARGET),
            ),
          );
    cache.set(key, result);
    return result;
  };
  return value(game.start, NO_TARGET);
}

/** 規則の、同点の選び方ごとの勝率の最大。 */
export function measureShuttleParkingRuleBestWinProbability(
  game: AnalysisGame,
  rule: ShuttleParkingNaiveRule,
): number {
  let best = 0;
  for (const tieBreak of SHUTTLE_PARKING_TIE_BREAKS) {
    best = Math.max(
      best,
      measureShuttleParkingRuleWinProbability(game, rule, tieBreak),
    );
    if (best >= 1) break;
  }
  return best;
}

/**
 * 試し出しと1手戻しで解く人（検査 D1）。素朴な解き方の候補を先に、ほかの出せる車を後に、車の番号順に試し、
 * 出せる車が無くなったら1手戻して次を試す。一度詰んだと分かった局面にはもう入らない。全員を送り出すまでに戻した回数。
 */
export function countShuttleParkingBacktracks(game: AnalysisGame): {
  solved: boolean;
  backtracks: number;
} {
  let backtracks = 0;
  const failed = new Set<string>();
  const visit = (state: AnalysisState): boolean => {
    if (state.mask === 0) return true;
    const key = createAnalysisStateKey(state);
    if (failed.has(key)) return false;
    const naive = listNaiveMoves(game, state);
    const rest = game.moves(state).filter((carId) => !naive.includes(carId));
    for (const carId of [...naive, ...rest]) {
      if (visit(game.step(state, carId))) return true;
      backtracks += 1;
    }
    failed.add(key);
    return false;
  };
  const solved = visit(game.start);
  return { solved, backtracks };
}
