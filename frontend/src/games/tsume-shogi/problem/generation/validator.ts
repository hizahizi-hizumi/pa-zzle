import {
  solveTsumeShogiMainLine,
  type TsumeShogiMainLine,
} from "@/games/tsume-shogi/problem/generation/solver";
import { TsumeShogiMateSearch } from "@/games/tsume-shogi/puzzle/mate-search";
import type { TsumeShogiPosition } from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiSearchPosition } from "@/games/tsume-shogi/puzzle/search-position";

/**
 * 詰将棋の strict validator。品質の状態を1つの真偽値に潰さず、項目ごとに持つ。
 *
 * - `accepted`: V1 で提供できる完全作。
 * - `unsupported`: 作品として成り立ちうるが、V1 の supported subset の外（合駒が作意に現れる、合駒の数え方や2手変長で解釈が割れる）。
 * - `invalid`: 指定の手数の完全作として成り立たない（不詰・早詰・作意線上の余詰・駒余り）。
 */
export type TsumeShogiVerdict = "accepted" | "unsupported" | "invalid";

export type TsumeShogiQualityIssue =
  /** 指定の手数以内に詰まない。 */
  | "noMate"
  /** 指定の手数より短く詰む。 */
  | "prematureMate"
  /** 作意の攻方の手番のどこかで、残りの手数以内に詰む王手が2つ以上ある。 */
  | "mainLineAlternative"
  /** 作意の詰め上がりで攻方の持駒が残る。 */
  | "leftoverPieces"
  /** 作意の玉方の手に合駒がある。 */
  | "interpositionInMainLine"
  /**
   * 玉方の合駒を逃れに数えないと、最短の詰み手数か、作意の攻方の手番で残りの手数以内に詰む王手の数が変わる
   * （無駄合の解釈で答えが変わりうる）。
   */
  | "interpositionSensitive"
  /**
   * 2手変長の規則（玉方が2手長く逃れる手順が駒余りなら、2手短い駒余りでない手順を作意とする）を玉方の手番1か所に当てはめると、
   * より短く詰むか、作意の攻方の手番で別の王手でも詰む（2手変長の解釈で答えが変わりうる）。
   * ほかの状態で `invalid` と決まる問題では調べない。
   */
  | "longerVariationSensitive"
  /** 作意の玉方の手番のどこかで、作意と同じ手数になる応手が2つ以上ある（変化同手数）。判定は変えない。 */
  | "equalLengthVariation";

export type TsumeShogiValidation = {
  verdict: TsumeShogiVerdict;
  issues: TsumeShogiQualityIssue[];
  plies: number;
  /** 指定の手数以内で最短の詰み手数。詰まなければ `null`。 */
  shortestMatePlies: number | null;
  /** 最短の詰みの作意。詰まなければ `null`。 */
  mainLine: TsumeShogiMainLine | null;
  /** 玉方の合駒を逃れに数えないときの、指定の手数以内で最短の詰み手数。 */
  shortestMatePliesIgnoringInterposition: number | null;
  /** 玉方の合駒を逃れに数えないときの、作意の攻方の手番ごとの残りの手数以内に詰む王手の数。 */
  matingCheckCountsIgnoringInterposition: number[];
};

const invalidIssues: readonly TsumeShogiQualityIssue[] = [
  "noMate",
  "prematureMate",
  "mainLineAlternative",
  "leftoverPieces",
];

const unsupportedIssues: readonly TsumeShogiQualityIssue[] = [
  "interpositionInMainLine",
  "interpositionSensitive",
  "longerVariationSensitive",
];

/** 攻方の手番の局面を、ちょうど `plies` 手（奇数）の詰将棋として検証する。 */
export function validateTsumeShogiProblem(
  position: TsumeShogiPosition,
  plies: number,
): TsumeShogiValidation {
  if (!Number.isInteger(plies) || plies < 1 || plies % 2 === 0) {
    throw new RangeError(`手数は正の奇数にしてください: ${plies}`);
  }
  const root = new TsumeShogiSearchPosition(position);
  if (root.sideToMove !== "attacker") {
    throw new RangeError("攻方の手番の局面ではありません");
  }

  const strict = new TsumeShogiMateSearch("counted");
  const shortestMatePlies = strict.findShortestMate(root, plies);
  const mainLine =
    shortestMatePlies === null
      ? null
      : solveTsumeShogiMainLine(position, shortestMatePlies, strict);

  const ignoringInterposition = new TsumeShogiMateSearch("ignored");
  const shortestMatePliesIgnoringInterposition =
    ignoringInterposition.findShortestMate(root, plies);
  const matingCheckCountsIgnoringInterposition =
    mainLine === null
      ? []
      : countMatingChecksAlongMainLine(root, mainLine, ignoringInterposition);

  const issues: TsumeShogiQualityIssue[] = [];
  if (shortestMatePlies === null) {
    issues.push("noMate");
  } else if (shortestMatePlies < plies) {
    issues.push("prematureMate");
  }
  if (mainLine !== null) {
    if (
      mainLine.attackerTurns.some(function hasAlternative(turn) {
        return turn.matingCheckCount > 1;
      })
    ) {
      issues.push("mainLineAlternative");
    }
    if (mainLine.leftoverAttackerPieceCount > 0) {
      issues.push("leftoverPieces");
    }
    if (mainLine.hasDefenderInterposition) {
      issues.push("interpositionInMainLine");
    }
    if (
      shortestMatePliesIgnoringInterposition !== shortestMatePlies ||
      matingCheckCountsIgnoringInterposition.some(
        function differsFromCounted(count, turnIndex) {
          return count !== mainLine.attackerTurns[turnIndex]!.matingCheckCount;
        },
      )
    ) {
      issues.push("interpositionSensitive");
    }
    // 2手変長の判定は重いので、ほかの状態で既に invalid と決まる問題では調べない。
    if (
      !issues.some((issue) => invalidIssues.includes(issue)) &&
      isLongerVariationSensitive(root, mainLine, strict)
    ) {
      issues.push("longerVariationSensitive");
    }
    if (
      mainLine.defenderTurns.some(function hasEqualLength(turn) {
        return turn.longestResponseCount > 1;
      })
    ) {
      issues.push("equalLengthVariation");
    }
  }

  return {
    verdict: decideVerdict(issues),
    issues,
    plies,
    shortestMatePlies,
    mainLine,
    shortestMatePliesIgnoringInterposition,
    matingCheckCountsIgnoringInterposition,
  };
}

function decideVerdict(
  issues: readonly TsumeShogiQualityIssue[],
): TsumeShogiVerdict {
  if (issues.some((issue) => invalidIssues.includes(issue))) {
    return "invalid";
  }
  if (issues.some((issue) => unsupportedIssues.includes(issue))) {
    return "unsupported";
  }
  return "accepted";
}

/** 作意の攻方の手番ごとに、残りの手数以内に詰む王手を `search` の規則で数える。 */
function countMatingChecksAlongMainLine(
  root: TsumeShogiSearchPosition,
  mainLine: TsumeShogiMainLine,
  search: TsumeShogiMateSearch,
): number[] {
  const state = new TsumeShogiSearchPosition(root.toPosition());
  const counts: number[] = [];
  const plies = mainLine.moves.length;
  for (const [index, move] of mainLine.moves.entries()) {
    if (index % 2 === 0) {
      const remaining = plies - index;
      let count = 0;
      for (const check of state.listAttackerChecks()) {
        state.play(check);
        if (search.isMateWithin(state, remaining - 1)) {
          count += 1;
        }
        state.undo(check);
      }
      counts.push(count);
    }
    state.play(state.findMove(move)!);
  }
  return counts;
}

/**
 * 作意の攻方の手番ごとに、2手変長の規則で詰むとみなせる王手を数え、厳密な数と違うか、残りの手数より2手短く詰むとみなせる
 * 王手があるかを調べる。
 */
function isLongerVariationSensitive(
  root: TsumeShogiSearchPosition,
  mainLine: TsumeShogiMainLine,
  search: TsumeShogiMateSearch,
): boolean {
  const state = new TsumeShogiSearchPosition(root.toPosition());
  const plies = mainLine.moves.length;
  for (const [index, move] of mainLine.moves.entries()) {
    if (index % 2 === 0) {
      const remaining = plies - index;
      let count = 0;
      let mateIsShorter = false;
      for (const check of state.listAttackerChecks()) {
        state.play(check);
        if (isMatedAllowingLongerVariation(state, remaining - 1, search)) {
          count += 1;
          mateIsShorter ||=
            remaining >= 3 &&
            isMatedAllowingLongerVariation(state, remaining - 3, search);
        }
        state.undo(check);
      }
      if (
        mateIsShorter ||
        count !== mainLine.attackerTurns[index / 2]!.matingCheckCount
      ) {
        return true;
      }
    }
    state.play(state.findMove(move)!);
  }
  return false;
}

/**
 * 玉方の手番の局面で、残り `plies` 手を超えて逃れる応手が、どれもちょうど2手長く詰んで作意が駒余りで終わるなら、
 * 2手変長の規則で `plies` 手以内に詰むとみなす。この手番より先の玉方の手番には規則を当てはめない。
 */
function isMatedAllowingLongerVariation(
  state: TsumeShogiSearchPosition,
  plies: number,
  search: TsumeShogiMateSearch,
): boolean {
  for (const response of state.listDefenderResponses()) {
    state.play(response);
    const escapes =
      (plies < 2 || !search.isMateWithin(state, plies - 1)) &&
      !endsWithLeftoverTwoPliesLonger(state, plies + 1, search);
    state.undo(response);
    if (escapes) {
      return false;
    }
  }
  return true;
}

function endsWithLeftoverTwoPliesLonger(
  state: TsumeShogiSearchPosition,
  plies: number,
  search: TsumeShogiMateSearch,
): boolean {
  return (
    search.findShortestMate(state, plies) === plies &&
    solveTsumeShogiMainLine(state.toPosition(), plies, search)
      .leftoverAttackerPieceCount > 0
  );
}
