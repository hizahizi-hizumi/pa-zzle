import { TsumeShogiMateSearch } from "@/games/tsume-shogi/puzzle/mate-search";
import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import type { TsumeShogiPosition } from "@/games/tsume-shogi/puzzle/position";
import {
  isTsumeShogiInterposition,
  type TsumeShogiSearchMove,
  TsumeShogiSearchPosition,
  toTsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/search-position";

/**
 * 作意（攻方の最短の詰みに対する、玉方の最長抵抗の手順）を求める。
 *
 * 玉方の応手の選び方（詰将棋の一般的な規則のうち V1 で扱う部分）:
 * 1. 詰むまでの手数が最も長くなる応手を選ぶ。手数は合駒も1手として数える（無駄合を手数から除かない）。
 * 2. 同じ手数なら、詰め上がりで攻方の持駒が少なくなる応手を選ぶ（駒余りにならない方を作意とする）。
 * 3. それでも並ぶなら、合駒でない応手を選び、残りは列挙の順で最初の手を選ぶ。
 * 攻方の手は、最短で詰む王手のうち詰め上がりの持駒が少ない方を、並べば列挙の順で最初の手を選ぶ。
 */

/** 作意の攻方の手番ごとの記録。 */
export type TsumeShogiAttackerTurn = {
  /** 残りの手数以内に詰む王手の数。1 なら攻方の正解は一意、2 以上は余詰。 */
  matingCheckCount: number;
};

/** 作意の玉方の手番ごとの記録。 */
export type TsumeShogiDefenderTurn = {
  /** 王手を受ける合法手の数。 */
  responseCount: number;
  /** 詰むまでの手数が最も長くなる応手の数。2 以上は変化同手数。 */
  longestResponseCount: number;
  /** 最長の応手のうち、詰め上がりの持駒の数でも並んだ応手の数。 */
  tiedResponseCount: number;
};

export type TsumeShogiMainLine = {
  /** 攻方・玉方の順に交互に並ぶ。最後は詰めた攻方の手。 */
  moves: TsumeShogiMove[];
  attackerTurns: TsumeShogiAttackerTurn[];
  defenderTurns: TsumeShogiDefenderTurn[];
  /** 詰め上がりで攻方に残った持駒の枚数。 */
  leftoverAttackerPieceCount: number;
  /** 作意の玉方の手に合駒があるか。 */
  hasDefenderInterposition: boolean;
};

type Evaluation = {
  moves: TsumeShogiSearchMove[];
  attackerTurns: TsumeShogiAttackerTurn[];
  defenderTurns: TsumeShogiDefenderTurn[];
  leftoverAttackerPieceCount: number;
};

/** 攻方の手番の局面から、`maximumPlies` 手以内で最短の詰み手数。詰まなければ `null`。 */
export function findTsumeShogiShortestMate(
  position: TsumeShogiPosition,
  maximumPlies: number,
): number | null {
  return new TsumeShogiMateSearch().findShortestMate(
    new TsumeShogiSearchPosition(position),
    maximumPlies,
  );
}

/**
 * 攻方の手番の局面の作意。最短の詰みがちょうど `plies` 手でなければ `RangeError` を投げる。
 * `search` を渡すと、同じ局面を調べた置換表を使い回す。
 */
export function solveTsumeShogiMainLine(
  position: TsumeShogiPosition,
  plies: number,
  search: TsumeShogiMateSearch = new TsumeShogiMateSearch(),
): TsumeShogiMainLine {
  const state = new TsumeShogiSearchPosition(position);
  if (
    state.sideToMove !== "attacker" ||
    search.findShortestMate(state, plies) !== plies
  ) {
    throw new RangeError(
      `最短 ${plies} 手で詰む攻方の手番の局面ではありません`,
    );
  }
  const evaluation = new MainLineSolver(search).evaluateAttacker(state, plies);
  return {
    moves: evaluation.moves.map(toTsumeShogiMove),
    attackerTurns: evaluation.attackerTurns,
    defenderTurns: evaluation.defenderTurns,
    leftoverAttackerPieceCount: evaluation.leftoverAttackerPieceCount,
    hasDefenderInterposition: evaluation.moves.some(
      function isDefenderInterposition(move, index) {
        return index % 2 === 1 && isTsumeShogiInterposition(move);
      },
    ),
  };
}

class MainLineSolver {
  readonly #search: TsumeShogiMateSearch;

  constructor(search: TsumeShogiMateSearch) {
    this.#search = search;
  }

  /** 攻方の手番で、最短の詰みがちょうど `plies` 手の局面。 */
  evaluateAttacker(state: TsumeShogiSearchPosition, plies: number): Evaluation {
    let best: { check: TsumeShogiSearchMove; evaluation: Evaluation } | null =
      null;
    let matingCheckCount = 0;
    for (const check of state.listAttackerChecks()) {
      state.play(check);
      if (this.#search.isMateWithin(state, plies - 1)) {
        matingCheckCount += 1;
        const evaluation = this.evaluateDefender(state, plies - 1);
        if (
          best === null ||
          evaluation.leftoverAttackerPieceCount <
            best.evaluation.leftoverAttackerPieceCount
        ) {
          best = { check, evaluation };
        }
      }
      state.undo(check);
    }
    if (best === null) {
      throw new Error(`${plies} 手以内に詰む王手が見つかりません`);
    }
    return {
      moves: [best.check, ...best.evaluation.moves],
      attackerTurns: [{ matingCheckCount }, ...best.evaluation.attackerTurns],
      defenderTurns: best.evaluation.defenderTurns,
      leftoverAttackerPieceCount: best.evaluation.leftoverAttackerPieceCount,
    };
  }

  /** 玉方の手番で、`plies` 手以内に必ず詰み、それより2手短くは詰まない局面。 */
  evaluateDefender(state: TsumeShogiSearchPosition, plies: number): Evaluation {
    const responses = state.listDefenderResponses();
    if (responses.length === 0) {
      return {
        moves: [],
        attackerTurns: [],
        defenderTurns: [],
        leftoverAttackerPieceCount: state.attackerHandPieceCount,
      };
    }
    const longest = responses.filter((response) => {
      state.play(response);
      const mateLength = this.#search.findShortestMate(state, plies - 1);
      state.undo(response);
      if (mateLength === null) {
        throw new Error(`${plies} 手以内に詰まない応手があります`);
      }
      return mateLength === plies - 1;
    });
    const evaluated = longest.map((response) => {
      state.play(response);
      const evaluation = this.evaluateAttacker(state, plies - 1);
      state.undo(response);
      return { response, evaluation };
    });
    const fewestLeftover = Math.min(
      ...evaluated.map(function leftoverOf({ evaluation }) {
        return evaluation.leftoverAttackerPieceCount;
      }),
    );
    const tied = evaluated.filter(function hasFewestLeftover({ evaluation }) {
      return evaluation.leftoverAttackerPieceCount === fewestLeftover;
    });
    const chosen =
      tied.find(function isNotInterposition({ response }) {
        return !isTsumeShogiInterposition(response);
      }) ?? tied[0]!;
    return {
      moves: [chosen.response, ...chosen.evaluation.moves],
      attackerTurns: chosen.evaluation.attackerTurns,
      defenderTurns: [
        {
          responseCount: responses.length,
          longestResponseCount: longest.length,
          tiedResponseCount: tied.length,
        },
        ...chosen.evaluation.defenderTurns,
      ],
      leftoverAttackerPieceCount: fewestLeftover,
    };
  }
}
