import {
  type AnalysisGame,
  type AnalysisState,
  countBits,
  createAnalysisStateKey,
  iterateBits,
} from "@/games/shuttle-parking/problem/generation/state-game";

/**
 * 罠と読み手。罠 = 読み手の候補のうち、どう続けても勝てない手。罠の深さ = その手の後に乗れる人数（先頭から数える）。
 * 深さ + 1 人を見れば負けが見えるので、これを罠の重さと呼ぶ。
 */

/** 先頭に合わせる人が広げていく候補の段。 */
export type ShuttleParkingTier =
  | "cheapest"
  | "headFirst"
  | "run1"
  | "run2"
  | "run3"
  | "all"
  | "window";

/** 先頭の色の車がすぐ出せればそれ、無ければ先頭の色の車とそれを塞ぐ車、列の次の色の区間まで…と広げる。 */
export const SHUTTLE_PARKING_HEAD_FIRST_WIDEN = [
  "headFirst",
  "run1",
  "run2",
  "run3",
  "all",
] as const satisfies readonly ShuttleParkingTier[];

/** 先回りする人が候補にする窓（先頭から何人に出てくる色か）。 */
export const SHUTTLE_PARKING_WINDOW = 5;

function windowColors(
  queueColors: readonly number[],
  head: number,
  runs: number,
): Set<number> {
  const colors = new Set<number>();
  let seen = 0;
  for (let index = head; index < queueColors.length; index += 1) {
    if (index === head || queueColors[index] !== queueColors[index - 1]) {
      seen += 1;
      if (seen > runs) break;
    }
    colors.add(queueColors[index]!);
  }
  return colors;
}

/** `seeds` の車と、それを（塞ぐ車を塞ぐ車も含めて）塞ぐ車。 */
export function closeBlockers(
  sides: readonly (readonly number[])[],
  mask: number,
  seeds: number,
): number {
  let found = seeds;
  let frontier = seeds;
  while (frontier) {
    let added = 0;
    for (const carId of iterateBits(frontier)) {
      for (const ray of sides[carId]!) added |= ray & mask;
    }
    frontier = added & ~found;
    found |= frontier;
  }
  return found;
}

/** 先頭の色の車のうち、塞ぐ車の最も少ない進路を開けるのに出す車。 */
function digCheapest(
  sides: readonly (readonly number[])[],
  mask: number,
  headMask: number,
): number {
  const costs = [...iterateBits(headMask)].map((carId) => ({
    carId,
    cost: Math.min(...sides[carId]!.map((ray) => countBits(ray & mask))),
  }));
  const cheapest = Math.min(...costs.map(({ cost }) => cost));
  let seeds = 0;
  for (const { carId, cost } of costs) {
    if (cost !== cheapest) continue;
    for (const ray of sides[carId]!) {
      if (countBits(ray & mask) === cheapest) seeds |= ray & mask;
    }
  }
  return closeBlockers(sides, mask, seeds);
}

function headMaskOf(game: AnalysisGame, state: AnalysisState): number {
  return game.colorMasks[game.queueColors[game.progress(state)]!]! & state.mask;
}

/** 出すとすぐ待機枠が埋まる手（全部出し終える手は除く）を避けた手。 */
export function listSafeMoves(
  game: AnalysisGame,
  state: AnalysisState,
): number[] {
  return game.moves(state).filter((carId) => {
    const child = game.step(state, carId);
    return child.mask === 0 || game.waiting(child) < game.bays;
  });
}

/** 素朴な解き方: 先頭の色の車が出せれば出す。無ければ塞ぎの少ない先頭の色の車を掘る。すぐ詰む手は避ける。 */
export function listNaiveMoves(
  game: AnalysisGame,
  state: AnalysisState,
): number[] {
  const options = listSafeMoves(game, state);
  if (options.length === 0) return [];
  const headMask = headMaskOf(game, state);
  const direct = options.filter((carId) => (headMask >> carId) & 1);
  if (direct.length) return direct;
  const dig = digCheapest(game.sides, state.mask, headMask);
  const digging = options.filter((carId) => (dig >> carId) & 1);
  return digging.length ? digging : options;
}

/** 罠の深さの取り方。 */
export type ShuttleParkingTrapDepth = "best" | "continuation";

/** 1つの問題・待機枠の数での読み手。 */
export class ShuttleParkingReader {
  readonly game: AnalysisGame;
  readonly depth: ShuttleParkingTrapDepth;
  readonly window: number;
  readonly #continuation = new Map<string, number>();

  constructor(
    game: AnalysisGame,
    depth: ShuttleParkingTrapDepth = "best",
    window: number = SHUTTLE_PARKING_WINDOW,
  ) {
    this.game = game;
    this.depth = depth;
    this.window = window;
  }

  /**
   * 罠の深さ。`best` はその手の後に最善を尽くして乗れる人数。`continuation` は罠に気づかず先頭に合わせて出し続けた人が
   * 詰むまでに乗せる人数の期待値（切り捨て）。勝てる手は `best` と同じ。
   */
  distance(state: AnalysisState, carId: number): number {
    const { game } = this;
    const child = game.step(state, carId);
    if (this.depth === "continuation" && !game.wins(child)) {
      return Math.trunc(
        this.#expectedContinuation(child) - game.progress(state),
      );
    }
    return game.maxReach(child) - game.progress(state);
  }

  #expectedContinuation(state: AnalysisState): number {
    const key = createAnalysisStateKey(state);
    const cached = this.#continuation.get(key);
    if (cached !== undefined) return cached;
    const { game } = this;
    const options = state.mask ? listNaiveMoves(game, state) : [];
    const result = options.length
      ? options.reduce(
          (sum, carId) =>
            sum + this.#expectedContinuation(game.step(state, carId)),
          0,
        ) / options.length
      : game.progress(state);
    this.#continuation.set(key, result);
    return result;
  }

  candidates(
    state: AnalysisState,
    tier: ShuttleParkingTier,
  ): readonly number[] {
    const { game } = this;
    const legal = game.moves(state);
    if (tier === "all") return legal;
    const { mask } = state;
    const head = game.progress(state);
    if (tier === "window") {
      const colors = new Set(
        game.queueColors.slice(head, head + Math.max(this.window, 1)),
      );
      const options = this.#relevant(legal, mask, colors);
      return options.some((carId) => game.wins(game.step(state, carId)))
        ? options
        : legal;
    }
    const headMask = headMaskOf(game, state);
    let runs = tier === "run2" ? 2 : tier === "run3" ? 3 : 1;
    if (tier === "cheapest" || tier === "headFirst") {
      const direct = legal.filter((carId) => (headMask >> carId) & 1);
      if (direct.length) return direct;
      if (tier === "cheapest") {
        const dig = digCheapest(game.sides, mask, headMask);
        return legal.filter((carId) => (dig >> carId) & 1);
      }
      runs = 1;
    }
    return this.#relevant(
      legal,
      mask,
      windowColors(game.queueColors, head, runs),
    );
  }

  #relevant(
    legal: readonly number[],
    mask: number,
    colors: ReadonlySet<number>,
  ): number[] {
    const { game } = this;
    let targets = 0;
    for (const color of colors) targets |= game.colorMasks[color]!;
    const relevant = closeBlockers(game.sides, mask, targets & mask);
    return legal.filter((carId) => (relevant >> carId) & 1);
  }

  /** `widen` の段を順に試し、勝つ手を含む最初の段の候補。 */
  widenedCandidates(
    state: AnalysisState,
    widen: readonly ShuttleParkingTier[],
  ): readonly number[] {
    for (const tier of widen) {
      const options = this.candidates(state, tier);
      if (
        options.some((carId) => this.game.wins(this.game.step(state, carId)))
      ) {
        return options;
      }
    }
    throw new Error("winning state without a winning move");
  }
}

export const SHUTTLE_PARKING_WEIGHT_THRESHOLDS = [1, 5, 8, 10] as const;

/**
 * 勝ち筋の上の罠の重さ。勝ち筋 = 各局面で候補のうち勝つ手を選び続ける筋（`freePath` なら、候補の外の勝つ手も選べる）。
 * 局面の重さ = 候補のうち負ける手の重さの最大。返すのは、勝ち筋の上の重さの最大の、勝ち筋の中での最小と最大。
 */
export type ShuttleParkingWeightBounds = { minimum: number; maximum: number };

export function measureShuttleParkingWeightBounds(
  reader: ShuttleParkingReader,
  widen: readonly ShuttleParkingTier[],
  { freePath = false }: { freePath?: boolean } = {},
): ShuttleParkingWeightBounds {
  const { game } = reader;
  const memo = new Map<string, ShuttleParkingWeightBounds>();
  const visit = (state: AnalysisState): ShuttleParkingWeightBounds => {
    if (state.mask === 0) return { minimum: 0, maximum: 0 };
    const key = createAnalysisStateKey(state);
    const cached = memo.get(key);
    if (cached) return cached;
    let weight = 0;
    const winners: AnalysisState[] = [];
    for (const carId of reader.widenedCandidates(state, widen)) {
      const child = game.step(state, carId);
      if (game.wins(child)) winners.push(child);
      else weight = Math.max(weight, reader.distance(state, carId) + 1);
    }
    const kids = (
      freePath
        ? game
            .moves(state)
            .map((carId) => game.step(state, carId))
            .filter((child) => game.wins(child))
        : winners
    ).map(visit);
    const result = {
      minimum: Math.max(weight, Math.min(...kids.map((kid) => kid.minimum))),
      maximum: Math.max(weight, Math.max(...kids.map((kid) => kid.maximum))),
    };
    memo.set(key, result);
    return result;
  };
  return visit(game.start);
}

/**
 * 記録だけの回数: 勝ち筋の上で、重さの段ごとに出会う判断の回数（どの勝ち筋でも出会う最小と、最も多い勝ち筋の最大）。
 * 同じ車が罠のまま続く局面の並びを1つの判断と数える。レベルには使わない。
 */
export type ShuttleParkingDecisionCounts = {
  minimum: readonly number[];
  maximum: readonly number[];
  states: number;
};

export function countShuttleParkingDecisions(
  reader: ShuttleParkingReader,
  widen: readonly ShuttleParkingTier[],
  thresholds: readonly number[] = SHUTTLE_PARKING_WEIGHT_THRESHOLDS,
): ShuttleParkingDecisionCounts {
  const { game } = reader;
  const memo = new Map<string, readonly number[]>();
  const size = thresholds.length;
  const visit = (
    state: AnalysisState,
    previous: readonly number[],
  ): readonly number[] => {
    if (state.mask === 0) return new Array<number>(size * 2).fill(0);
    const key = `${createAnalysisStateKey(state)}#${previous.join(",")}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const masks = new Array<number>(size).fill(0);
    const winners: AnalysisState[] = [];
    for (const carId of reader.widenedCandidates(state, widen)) {
      const child = game.step(state, carId);
      if (game.wins(child)) {
        winners.push(child);
        continue;
      }
      const weight = reader.distance(state, carId) + 1;
      thresholds.forEach((threshold, index) => {
        if (weight >= threshold) masks[index]! |= 1 << carId;
      });
    }
    const fresh = masks.map((mask, index) =>
      mask && !(mask & previous[index]!) ? 1 : 0,
    );
    const kids = winners.map((child) => visit(child, masks));
    const result = [
      ...fresh.map(
        (value, index) => value + Math.min(...kids.map((kid) => kid[index]!)),
      ),
      ...fresh.map(
        (value, index) =>
          value + Math.max(...kids.map((kid) => kid[size + index]!)),
      ),
    ];
    memo.set(key, result);
    return result;
  };
  const counts = visit(game.start, new Array<number>(size).fill(0));
  return {
    minimum: counts.slice(0, size),
    maximum: counts.slice(size),
    states: memo.size,
  };
}
