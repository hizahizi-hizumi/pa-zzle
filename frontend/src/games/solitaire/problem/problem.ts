import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  isSolitaireCard,
  SOLITAIRE_CARD_COUNT,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import {
  SOLITAIRE_COLUMN_COUNT,
  type SolitaireColumn,
} from "@/games/solitaire/puzzle/state";
import { isRecordObject } from "@/lib/type-guards";

/**
 * 配った札。`columns` は左から7列で、左から i 番目（0始まり）の列に i + 1 枚。`stock` は残りの24枚の山札で、先頭が最初にめくる札。
 * 山札の並びも1問に含める（何周でもめくれるので解けるかには効かないが、めくって出てくる順が変わる）。
 */
export type SolitaireProblem = {
  columns: readonly SolitaireColumn[];
  stock: readonly SolitaireCard[];
};

export const SOLITAIRE_STOCK_CARD_COUNT =
  SOLITAIRE_CARD_COUNT -
  (SOLITAIRE_COLUMN_COUNT * (SOLITAIRE_COLUMN_COUNT + 1)) / 2;

/** 配った札の符号（`seed`）の意味が変わり、同じ identity から別の配り方ができるようになったら上げる。 */
export const SOLITAIRE_GENERATOR_VERSION = "1";

/** どの問題も同じ規模（52枚・7列）なので、生成条件を持たない。 */
export type SolitaireGenerationConditions = Readonly<Record<string, never>>;

/**
 * 同じ問題を再現するための情報。`seed` は乱数の種ではなく、配った札の符号（`createSolitaireProblemIdentity`）。
 */
export type SolitaireProblemIdentity = {
  generatorVersion: typeof SOLITAIRE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: SolitaireGenerationConditions;
};

export type SolitaireRecordedProblemIdentity = RecordedProblemIdentity;

export type SolitaireIdentifiedProblem = {
  problem: SolitaireProblem;
  identity: SolitaireProblemIdentity;
};

function listDealtCards({ columns, stock }: SolitaireProblem): SolitaireCard[] {
  return [...columns.flat(), ...stock];
}

export function assertSolitaireProblem(problem: SolitaireProblem): void {
  const { columns, stock } = problem;
  if (
    columns.length !== SOLITAIRE_COLUMN_COUNT ||
    columns.some((column, columnIndex) => column.length !== columnIndex + 1)
  ) {
    throw new RangeError(
      "Solitaire columns must hold 1 to 7 cards from left to right",
    );
  }
  if (stock.length !== SOLITAIRE_STOCK_CARD_COUNT) {
    throw new RangeError(
      `Solitaire stock must hold ${SOLITAIRE_STOCK_CARD_COUNT} cards`,
    );
  }
  const cards = listDealtCards(problem);
  if (
    !cards.every(isSolitaireCard) ||
    new Set(cards).size !== SOLITAIRE_CARD_COUNT
  ) {
    throw new RangeError("Solitaire problem must deal each card exactly once");
  }
}

/** 札1枚を1文字にする。札の番号の順に `A`〜`Z`、`a`〜`z`。 */
const cardCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 符号から配った札を読む。札の数・重なり・字が正しくなければ `null`。 */
function decodeSolitaireProblem(seed: string): SolitaireProblem | null {
  if (seed.length !== SOLITAIRE_CARD_COUNT) {
    return null;
  }
  const cards = Array.from(seed, (character) =>
    cardCodeAlphabet.indexOf(character),
  );
  if (cards.some((card) => card < 0) || new Set(cards).size !== cards.length) {
    return null;
  }
  const columns = Array.from({ length: SOLITAIRE_COLUMN_COUNT }, (_, index) =>
    cards.slice((index * (index + 1)) / 2, ((index + 1) * (index + 2)) / 2),
  );
  return {
    columns,
    stock: cards.slice(SOLITAIRE_CARD_COUNT - SOLITAIRE_STOCK_CARD_COUNT),
  };
}

/**
 * 問題から identity を作る。`seed` は、列を左から順に各列の一番奥から手前へ、続けて山札を最初にめくる札から並べ、
 * 札を1文字ずつ（`cardCodeAlphabet`）にした52文字。
 */
function createSolitaireProblemIdentity(
  problem: SolitaireProblem,
): SolitaireProblemIdentity {
  assertSolitaireProblem(problem);
  return {
    generatorVersion: SOLITAIRE_GENERATOR_VERSION,
    seed: listDealtCards(problem)
      .map((card) => cardCodeAlphabet[card])
      .join(""),
    conditions: {},
  };
}

/** identity の `seed` から問題を復号する。 */
export function restoreSolitaireProblem(
  identity: SolitaireProblemIdentity,
): SolitaireIdentifiedProblem {
  if (identity.generatorVersion !== SOLITAIRE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported solitaire generator version: ${identity.generatorVersion}`,
    );
  }
  const problem = decodeSolitaireProblem(identity.seed);
  if (!problem) {
    throw new RangeError(`Invalid solitaire problem seed: ${identity.seed}`);
  }
  return { problem, identity };
}

/** 記録・診断など外部から読み戻した値が、復元できる識別情報かを確かめる。 */
export function isCurrentSolitaireProblemIdentity(
  value: unknown,
): value is SolitaireProblemIdentity {
  return (
    isRecordObject(value) &&
    isRecordObject(value.conditions) &&
    Object.keys(value.conditions).length === 0 &&
    value.generatorVersion === SOLITAIRE_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    decodeSolitaireProblem(value.seed) !== null
  );
}

export function isSolitaireRecordedProblemIdentity(
  value: unknown,
): value is SolitaireRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: SOLITAIRE_GENERATOR_VERSION,
    isProblemIdentity: isCurrentSolitaireProblemIdentity,
  });
}

export const _private = {
  createSolitaireProblemIdentity,
  decodeSolitaireProblem,
};
