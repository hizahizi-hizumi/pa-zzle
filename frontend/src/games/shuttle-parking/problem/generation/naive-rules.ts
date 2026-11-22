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
 * 規則は「候補の作り方」と「候補の中の選び方（鍵の小さい車、同じなら一様に）」の組。
 * - 候補 `cheapest`: 素朴な解き方（先頭の色の車をすぐ出せれば出し、無ければ塞ぎの最も少ない先頭の色の車を掘る）。
 * - 候補 `wide`: 掘る場面で、どの先頭の色の車を掘ってもよい。
 * - 候補 `deep`: 先頭の色の車のうち、出すのに要る台数が空いている待機枠に収まる中で、最も深く埋まった車を掘る。
 */
type CandidateBase = "cheapest" | "wide" | "deep";
type RuleKey = "any" | "small" | "big" | "unblock" | "needed" | "fill";

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
} as const satisfies Record<string, readonly [CandidateBase, RuleKey]>;

export type ShuttleParkingNaiveRule = keyof typeof SHUTTLE_PARKING_NAIVE_RULES;

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

/** `carId` を出すのに出す車（`carId` を含む）。進路ごとに求めて最も少ないもの。 */
function closeExit(game: AnalysisGame, mask: number, carId: number): number {
  let best: number | null = null;
  for (const ray of game.sides[carId]!) {
    const closure = closeBlockers(game.sides, mask, ray & mask) | (1 << carId);
    if (best === null || countBits(closure) < countBits(best)) best = closure;
  }
  return best ?? 1 << carId;
}

function listDeepMoves(game: AnalysisGame, state: AnalysisState): number[] {
  const moves = listSafeMoves(game, state);
  if (moves.length === 0) return [];
  const { mask } = state;
  const headMask =
    game.colorMasks[game.queueColors[game.progress(state)]!]! & mask;
  const freeBays = game.bays - game.waiting(state);
  const fitting = [...iterateBits(headMask)]
    .map((carId) => closeExit(game, mask, carId))
    .filter((closure) => countBits(closure) <= freeBays);
  if (fitting.length) {
    const deepest = Math.max(...fitting.map(countBits));
    const dig = fitting
      .filter((closure) => countBits(closure) === deepest)
      .reduce((union, closure) => union | closure, 0);
    const digging = moves.filter((carId) => (dig >> carId) & 1);
    if (digging.length) return digging;
  }
  return listNaiveMoves(game, state);
}

const candidateBases = {
  cheapest: listNaiveMoves,
  wide: listWideMoves,
  deep: listDeepMoves,
} as const satisfies Record<
  CandidateBase,
  (game: AnalysisGame, state: AnalysisState) => number[]
>;

function listRuleMoves(
  game: AnalysisGame,
  state: AnalysisState,
  rule: ShuttleParkingNaiveRule,
): number[] {
  const [base, keyName] = SHUTTLE_PARKING_NAIVE_RULES[rule];
  const options = candidateBases[base](game, state);
  if (options.length === 0) return [];
  const keys = options.map((carId) => ruleKeys[keyName](game, state, carId));
  const best = keys.reduce((lowest, key) =>
    compareKeys(key, lowest) < 0 ? key : lowest,
  );
  return options.filter((_, index) => compareKeys(keys[index]!, best) === 0);
}

/** 規則だけで出す人の勝率（候補が同点なら一様に選ぶ）。 */
export function measureShuttleParkingRuleWinProbability(
  game: AnalysisGame,
  rule: ShuttleParkingNaiveRule,
): number {
  const cache = new Map<string, number>();
  const value = (state: AnalysisState): number => {
    if (state.mask === 0) return 1;
    if (!game.wins(state)) return 0;
    const key = createAnalysisStateKey(state);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const options = listRuleMoves(game, state, rule);
    const result = options.length
      ? options.reduce(
          (sum, carId) => sum + value(game.step(state, carId)),
          0,
        ) / options.length
      : 0;
    cache.set(key, result);
    return result;
  };
  return value(game.start);
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
