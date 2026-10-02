import {
  type TsumeShogiDifficulty,
  tsumeShogiDifficulties,
} from "@/games/tsume-shogi/difficulty";
import {
  createTsumeShogiProblemIdentity,
  isTsumeShogiGenerationPlies,
  type TSUME_SHOGI_GENERATOR_VERSION,
  type TsumeShogiIdentifiedProblem,
  type TsumeShogiProblem,
  type TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";
import { parseTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
  type TsumeShogiHandPieceType,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * 事前生成した問題集の1問。
 * - `seed`: 生成器の identity の seed（例: `ts-5-c6-99-12`）。手数と生成条件（初手の王手の数の範囲）を含むので、
 *   ここから identity を再構成する。
 * - `position`: 初期局面の盤面（SFEN の盤面の部分）と攻方の持駒（SFEN の持駒の書き方、無ければ `-`）を空白で区切ったもの。
 *   玉方の持駒（駒箱）は盤面と攻方の持駒から決まるので持たない。
 * - `mainLine`: 作意の USI を空白で区切ったもの。
 * 実行時に生成器・探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 */
export type TsumeShogiProblemPoolEntry = readonly [
  seed: string,
  position: string,
  mainLine: string,
];

/**
 * 問題集の中の1問を指す識別情報。
 * - `poolVersion`: 問題集を作り直して問題の並びが変わったら上げる。
 * - `problemId`: `<レベル>-<番号>`（番号はレベルの中の1始まりの並び順）。例: `4-17`。
 * 生成器の identity（`TsumeShogiProblemIdentity`）とは相互に引ける。
 */
export type TsumeShogiProblemPoolReference = {
  poolVersion: string;
  problemId: string;
};

/** 問題集から復元した1問と、問題集の中の位置。 */
export type TsumeShogiPooledProblem = TsumeShogiIdentifiedProblem & {
  poolReference: TsumeShogiProblemPoolReference;
};

export type TsumeShogiProblemPool = {
  poolVersion: string;
  generatorVersion: typeof TSUME_SHOGI_GENERATOR_VERSION;
  levels: Record<TsumeShogiDifficulty, readonly TsumeShogiProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as TsumeShogiProblemPool;

export function getTsumeShogiProblemPoolVersion(): string {
  return problemPool.poolVersion;
}

/** 初期局面を問題集の形（盤面と攻方の持駒）にする。 */
export function formatTsumeShogiPoolPosition(
  position: TsumeShogiPosition,
): string {
  const [board, , hands] = formatTsumeShogiPosition(position).split(" ");
  // SFEN の持駒は先手（攻方）を大文字、後手（玉方）を小文字で書く。
  const attackerHand = [...hands!.matchAll(/\d*[A-Z]/g)]
    .map(([piece]) => piece)
    .join("");
  return `${board} ${attackerHand === "" ? "-" : attackerHand}`;
}

/** 問題集の形の初期局面を読む。駒箱は盤面と攻方の持駒から求める。読めなければ `RangeError` を投げる。 */
export function parseTsumeShogiPoolPosition(text: string): TsumeShogiPosition {
  const [board, hand, ...rest] = text.split(" ");
  if (
    board === undefined ||
    hand === undefined ||
    rest.length > 0 ||
    !/^(-|(\d*[RBGSNLP])+)$/.test(hand)
  ) {
    throw new RangeError(`Invalid Tsume Shogi pool position: ${text}`);
  }
  const attackerHand: Partial<Record<TsumeShogiHandPieceType, number>> = {};
  for (const [, count, letter] of hand.matchAll(/(\d*)([RBGSNLP])/g)) {
    const type = handPieceTypeByLetter[letter!]!;
    attackerHand[type] =
      (attackerHand[type] ?? 0) + (count === "" ? 1 : Number(count));
  }
  return createTsumeShogiPosition(board, attackerHand);
}

const handPieceTypeByLetter: Record<string, TsumeShogiHandPieceType> = {
  R: "rook",
  B: "bishop",
  G: "gold",
  S: "silver",
  N: "knight",
  L: "lance",
  P: "pawn",
};

/** 問題集の seed から identity を作る。問題集で使う形でなければ `RangeError` を投げる。 */
export function parseTsumeShogiPoolSeed(
  seed: string,
): TsumeShogiProblemIdentity {
  const match = seed.match(/^ts-(\d+)-c(\d+)-(\d+)-(\d+)$/);
  const plies = Number(match?.[1]);
  if (!match || !isTsumeShogiGenerationPlies(plies)) {
    throw new RangeError(`Invalid Tsume Shogi pool seed: ${seed}`);
  }
  return createTsumeShogiProblemIdentity(plies, Number(match[4]), {
    minimum: Number(match[2]),
    maximum: Number(match[3]),
  });
}

function toProblem(position: string, mainLine: string): TsumeShogiProblem {
  const moves = mainLine.split(" ").map(parseTsumeShogiMoveUsi);
  return {
    initialPosition: parseTsumeShogiPoolPosition(position),
    plies: moves.length,
    mainLine: moves,
  };
}

export function formatTsumeShogiPoolProblemId(
  difficulty: TsumeShogiDifficulty,
  entryIndex: number,
): string {
  return `${difficulty}-${entryIndex + 1}`;
}

function parsePoolProblemId(
  problemId: string,
): { difficulty: TsumeShogiDifficulty; entryIndex: number } | null {
  const match = problemId.match(/^([1-9]\d*)-([1-9]\d*)$/);
  const difficulty = tsumeShogiDifficulties.find(
    ({ id }) => id === match?.[1],
  )?.id;
  return match && difficulty
    ? { difficulty, entryIndex: Number(match[2]) - 1 }
    : null;
}

/** 問題集の1問を、問題集の中の位置 `poolReference` を添えて復元する。 */
export function restoreTsumeShogiPoolEntry(
  [seed, position, mainLine]: TsumeShogiProblemPoolEntry,
  poolReference: TsumeShogiProblemPoolReference,
): TsumeShogiPooledProblem {
  const identity = parseTsumeShogiPoolSeed(seed);
  const problem = toProblem(position, mainLine);
  if (problem.plies !== identity.conditions.plies) {
    throw new RangeError(
      `Tsume Shogi pool problem ${poolReference.problemId} has ${problem.plies} plies but seed ${seed}`,
    );
  }
  return { problem, identity, poolReference };
}

export function toTsumeShogiPooledProblem(
  difficulty: TsumeShogiDifficulty,
  entryIndex: number,
): TsumeShogiPooledProblem {
  const problemId = formatTsumeShogiPoolProblemId(difficulty, entryIndex);
  const entry = problemPool.levels[difficulty][entryIndex];
  if (!entry) {
    throw new RangeError(`No Tsume Shogi pool problem ${problemId}`);
  }
  return restoreTsumeShogiPoolEntry(entry, {
    poolVersion: problemPool.poolVersion,
    problemId,
  });
}

export function listTsumeShogiPoolEntries(
  difficulty: TsumeShogiDifficulty,
): readonly TsumeShogiProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

type PoolPosition = { difficulty: TsumeShogiDifficulty; entryIndex: number };

let positionsBySeed: ReadonlyMap<string, PoolPosition> | undefined;

function getPositionsBySeed(): ReadonlyMap<string, PoolPosition> {
  positionsBySeed ??= new Map(
    tsumeShogiDifficulties.flatMap(({ id: difficulty }) =>
      problemPool.levels[difficulty].map(
        ([seed], entryIndex) => [seed, { difficulty, entryIndex }] as const,
      ),
    ),
  );
  return positionsBySeed;
}

function isSameRootCheckRange(
  left: TsumeShogiProblemIdentity,
  right: TsumeShogiProblemIdentity,
): boolean {
  const leftRange = left.conditions.rootChecks;
  const rightRange = right.conditions.rootChecks;
  return (
    leftRange?.minimum === rightRange?.minimum &&
    leftRange?.maximum === rightRange?.maximum
  );
}

/** identity に一致する問題集の1問を復元する。生成器の版や条件が違う identity・問題集に無い identity には `null` を返す。 */
export function findTsumeShogiPooledProblem(
  identity: TsumeShogiProblemIdentity,
): TsumeShogiPooledProblem | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const position = getPositionsBySeed().get(identity.seed);
  if (!position) {
    return null;
  }
  const pooled = toTsumeShogiPooledProblem(
    position.difficulty,
    position.entryIndex,
  );
  return pooled.identity.conditions.plies === identity.conditions.plies &&
    isSameRootCheckRange(pooled.identity, identity)
    ? pooled
    : null;
}

/** 問題集の中の位置から1問を復元する。問題集の版が今と違う・番号が範囲外なら `null` を返す。 */
export function findTsumeShogiPooledProblemByReference({
  poolVersion,
  problemId,
}: TsumeShogiProblemPoolReference): TsumeShogiPooledProblem | null {
  if (poolVersion !== problemPool.poolVersion) {
    return null;
  }
  const position = parsePoolProblemId(problemId);
  if (
    !position ||
    position.entryIndex >= problemPool.levels[position.difficulty].length
  ) {
    return null;
  }
  return toTsumeShogiPooledProblem(position.difficulty, position.entryIndex);
}
