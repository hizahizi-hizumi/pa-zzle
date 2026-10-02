import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiSideToMove,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";
import {
  isTsumeShogiInterposition,
  TsumeShogiSearchPosition,
  toTsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/search-position";

/**
 * 手数を区切った詰み探索。攻方は毎手王手、玉方はすべての受けを試す AND/OR 探索で、
 * 「残り `plies` 手以内に必ず詰むか」だけを答える。
 *
 * - `"counted"`: 玉方の合駒をすべて1手として数える。合駒を取られて詰むだけの無駄合も逃れの手になる（通常の判定）。
 * - `"ignored"`: 玉方の合駒をどれも逃れの手に数えない。無駄合の判定は解釈やソルバーによって違うが、どの解釈よりも
 *   玉方に厳しい（詰みやすい）上限になる。無駄合の解釈で答えが変わりうるかを、安全側に確かめるために使う。
 */
export type TsumeShogiInterpositionRule = "counted" | "ignored";

type BoundRecord = {
  /** この手数以内なら詰むと分かった最小の手数。 */
  provenWithin: number;
  /** この手数以内では詰まないと分かった最大の手数。 */
  disprovenWithin: number;
};

/**
 * 同じ問題の局面を何度も調べるときに、置換表を共有するための探索器。
 * 局面ごとに「何手以内なら詰む / 詰まない」の境界を覚え、同じ局面の再探索を省く。
 */
export class TsumeShogiMateSearch {
  readonly #interpositionRule: TsumeShogiInterpositionRule;
  readonly #bounds = new Map<string, BoundRecord>();
  #nodeCount = 0;

  constructor(interpositionRule: TsumeShogiInterpositionRule = "counted") {
    this.#interpositionRule = interpositionRule;
  }

  /** 探索した局面の数（置換表で済んだ局面を除く）。計測用。 */
  get nodeCount(): number {
    return this.#nodeCount;
  }

  /**
   * 手番側に関わらず、今の局面から残り `plies` 手以内に必ず詰むか。
   * 攻方の手番なら攻方の王手から、玉方の手番なら玉方の受けから数える。
   */
  isMateWithin(state: TsumeShogiSearchPosition, plies: number): boolean {
    return state.sideToMove === "attacker"
      ? this.#attackerMates(state, plies)
      : this.#defenderIsMated(state, plies);
  }

  /** 残り `maximumPlies` 手以内で最短の詰み手数。詰まなければ `null`。 */
  findShortestMate(
    state: TsumeShogiSearchPosition,
    maximumPlies: number,
  ): number | null {
    const start = state.sideToMove === "attacker" ? 1 : 0;
    for (let plies = start; plies <= maximumPlies; plies += 2) {
      if (this.isMateWithin(state, plies)) {
        return plies;
      }
    }
    return null;
  }

  #attackerMates(state: TsumeShogiSearchPosition, plies: number): boolean {
    if (plies < 1) {
      return false;
    }
    const known = this.#lookup(state.key, plies);
    if (known !== null) {
      return known;
    }
    this.#nodeCount += 1;
    let mates = false;
    for (const check of state.listAttackerChecks()) {
      state.play(check);
      mates = this.#defenderIsMated(state, plies - 1);
      state.undo(check);
      if (mates) {
        break;
      }
    }
    this.#record(state.key, plies, mates);
    return mates;
  }

  #defenderIsMated(state: TsumeShogiSearchPosition, plies: number): boolean {
    const known = this.#lookup(state.key, plies);
    if (known !== null) {
      return known;
    }
    this.#nodeCount += 1;
    let mated = true;
    for (const response of state.generateDefenderResponses()) {
      if (
        this.#interpositionRule === "ignored" &&
        isTsumeShogiInterposition(response)
      ) {
        continue;
      }
      if (plies < 2) {
        mated = false;
        break;
      }
      state.play(response);
      const stillMated = this.#attackerMates(state, plies - 1);
      state.undo(response);
      if (!stillMated) {
        mated = false;
        break;
      }
    }
    this.#record(state.key, plies, mated);
    return mated;
  }

  #lookup(key: string, plies: number): boolean | null {
    const record = this.#bounds.get(key);
    if (record === undefined) {
      return null;
    }
    if (plies >= record.provenWithin) {
      return true;
    }
    if (plies <= record.disprovenWithin) {
      return false;
    }
    return null;
  }

  #record(key: string, plies: number, mates: boolean): void {
    const record = this.#bounds.get(key) ?? {
      provenWithin: Number.POSITIVE_INFINITY,
      disprovenWithin: -1,
    };
    if (mates) {
      record.provenWithin = Math.min(record.provenWithin, plies);
    } else {
      record.disprovenWithin = Math.max(record.disprovenWithin, plies);
    }
    this.#bounds.set(key, record);
  }
}

/**
 * 局面から残り `plies` 手以内に必ず詰むか。手番側に関わらず使える。
 * 玉方は合駒を含むすべての受けを使える。
 */
export function isTsumeShogiMateWithin(
  position: TsumeShogiPosition,
  plies: number,
): boolean {
  return new TsumeShogiMateSearch().isMateWithin(
    new TsumeShogiSearchPosition(position),
    plies,
  );
}

/**
 * 攻方の王手の後（玉方の手番）で、残り `remainingPlies` 手（この玉方の手を含む）以内に詰まないことを示す玉方の応手。
 * 合駒でない受けを先に、玉の移動・王手した駒を取る手・合駒の順で最初に見つかった手を返す。
 * 残り手数以内に必ず詰む（その王手が正解の一つ）なら `null`。玉方の手番でなければ `RangeError` を投げる。
 */
export function findTsumeShogiRefutation(
  position: TsumeShogiPosition,
  remainingPlies: number,
): TsumeShogiMove | null {
  if (getTsumeShogiSideToMove(position) !== "defender") {
    throw new RangeError("玉方の手番ではありません");
  }
  const state = new TsumeShogiSearchPosition(position);
  const search = new TsumeShogiMateSearch();
  const responses = state.listDefenderResponses();
  const ordered = [
    ...responses.filter(function isNotInterposition(move) {
      return !isTsumeShogiInterposition(move);
    }),
    ...responses.filter(isTsumeShogiInterposition),
  ];
  for (const response of ordered) {
    state.play(response);
    const mates = search.isMateWithin(state, remainingPlies - 1);
    state.undo(response);
    if (!mates) {
      return toTsumeShogiMove(response);
    }
  }
  return null;
}
