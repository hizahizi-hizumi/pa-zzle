import {
  canStackSolitaireCard,
  getSolitaireCardRank,
  SOLITAIRE_CARD_COUNT,
  SOLITAIRE_KING_RANK,
  SOLITAIRE_RANK_COUNT,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import {
  countSolitaireFoundationCards,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

/**
 * 今より多くの札を組札に置ける局面へ、どれかの規則の手順で行けるか。
 * - `reachable`: 行ける。
 * - `unreachable`: どの手順でも行けない。
 * - `unknown`: 調べる局面の数の上限までに決まらなかった。
 */
export type SolitaireFoundationProgress =
  | "reachable"
  | "unreachable"
  | "unknown";

/** 状態の知らせの判定で調べる局面の数の上限。上限で決まらなければ知らせない。 */
// 判定は手を打つたびに走るので、上限まで探しても止まって見えない長さに収める。2万局面は bun（2.1GHz の Xeon）で約0.1〜0.2秒。
// 調査コードの素朴な解き方が詰んだ局面で、組札を増やせないと決まった428局面のうち427局面は、2万局面までに決まった。
export const SOLITAIRE_FOUNDATION_PROGRESS_STATE_LIMIT = 20_000;

/**
 * 探す局面。山札と捨て札は、何周でもめくれるのでどの札もいつでも取り出せ、並びは行ける局面を変えない。
 * そこで列と組札だけを持ち、山札と捨て札の札は、列にも組札にも無い札の集まりとして扱う。
 * 列は札ごとに1文字（文字の番号 − `cardCodeOffset` が札の番号）の文字列で、一番奥の札が先頭。
 * `foundations` は `solitaireSuits` の順のマークごとの組札の枚数。
 */
type SearchNode = {
  columns: readonly string[];
  foundations: readonly number[];
};

const cardCodeOffset = 0x30;

function encodeCard(card: number): string {
  return String.fromCharCode(card + cardCodeOffset);
}

function decodeCard(column: string, index: number): number {
  return column.charCodeAt(index) - cardCodeOffset;
}

const stacksOnto = Array.from({ length: SOLITAIRE_CARD_COUNT }, (_, card) =>
  Array.from({ length: SOLITAIRE_CARD_COUNT }, (_, base) =>
    canStackSolitaireCard(card, base),
  ),
);
const kings = Array.from(
  { length: SOLITAIRE_CARD_COUNT },
  (_, card) => card,
).filter((card) => getSolitaireCardRank(card) === SOLITAIRE_KING_RANK);
/** 札ごとに、その上に重ねられる2枚（番号の順）。 */
const cardsStackableOn = Array.from(
  { length: SOLITAIRE_CARD_COUNT },
  (_, base) => stacksOnto.flatMap((bases, card) => (bases[base] ? [card] : [])),
);

function createSearchNode(state: SolitaireState): SearchNode {
  return {
    columns: state.columns.map((column) => column.map(encodeCard).join("")),
    foundations: solitaireSuits.map((suit) => state.foundations[suit]),
  };
}

/**
 * 列を入れ替えて同じになる局面に同じ鍵を付けるための、局面の符号。札ごとに、列でその上に重なる札の文字（列の一番手前なら
 * `columnTopCode`、列に無ければ `outsideColumnsCode`）を並べ、組札の枚数を足す。どの札も1つの列にしか無いので、
 * 上に重なる札をたどると、列の並びを問わず列の中身が決まる。1手で変わるのは高々3文字なので、次の局面の符号は差分で作る。
 */
const keyLength = SOLITAIRE_CARD_COUNT + solitaireSuits.length;
const columnTopCode = cardCodeOffset + SOLITAIRE_CARD_COUNT;
const outsideColumnsCode = columnTopCode + 1;
const keyDecoder = new TextDecoder("latin1");

function writeSearchKeyCodes(
  { columns, foundations }: SearchNode,
  codes: Uint8Array,
): void {
  codes.fill(outsideColumnsCode, 0, SOLITAIRE_CARD_COUNT);
  for (const column of columns) {
    for (let index = 0; index < column.length; index += 1) {
      codes[decodeCard(column, index)] =
        index + 1 < column.length
          ? column.charCodeAt(index + 1)
          : columnTopCode;
    }
  }
  for (let suitIndex = 0; suitIndex < foundations.length; suitIndex += 1) {
    codes[SOLITAIRE_CARD_COUNT + suitIndex] =
      cardCodeOffset + foundations[suitIndex]!;
  }
}

function sumFoundations(foundations: readonly number[]): number {
  return foundations[0]! + foundations[1]! + foundations[2]! + foundations[3]!;
}

function findRunStart(column: string): number {
  let start = column.length - 1;
  while (
    start > 0 &&
    stacksOnto[decodeCard(column, start)]![decodeCard(column, start - 1)]
  ) {
    start -= 1;
  }
  return start;
}

/**
 * 1つの局面から、規則の手をすべて1手ずつ打った次の局面を探す。次の局面は鍵を先に作り、まだ調べていない局面だけを作って積む。
 * 空いた列は列の並びを問わず同じなので、空いた列へ置く手は最初の空いた列への1つにまとめる。
 * 一番奥から K で始まる並びを空いた列へ動かす手は、列を入れ替えるだけなので打たない。
 */
class FoundationCountSearch {
  readonly seenKeys = new Set<string>();
  readonly stack: { node: SearchNode; key: string }[] = [];
  private readonly parentCodes = new Uint8Array(keyLength);
  private readonly childCodes = new Uint8Array(keyLength);
  private readonly inPool = new Uint8Array(SOLITAIRE_CARD_COUNT);
  private parentFoundationCount = 0;

  constructor(private readonly targetCount: number) {}

  pushStart(node: SearchNode): void {
    writeSearchKeyCodes(node, this.parentCodes);
    this.stack.push({ node, key: keyDecoder.decode(this.parentCodes) });
  }

  /** 子の符号を親の符号から写す。続けて差分を書き込み、`offer` で鍵にする。 */
  private beginChild(): Uint8Array {
    this.childCodes.set(this.parentCodes);
    return this.childCodes;
  }

  /**
   * 子の符号の局面がまだ調べていない局面なら、その局面を作って積む。組札の枚数が目標に届いたら `true`。
   * 子の局面は、`sourceColumnIndex` の列（−1 なら無し）の `cutIndex` から手前の札を取り除き、`destinationIndex` の列
   * （−1 なら無し）の手前へ、取り除いた札か、列からでなければ `placedCard` を足し、`foundationSuitIndex` の組札を
   * `foundationDelta` 枚増やした局面。
   */
  private offer(
    parent: SearchNode,
    foundationSuitIndex: number,
    foundationDelta: number,
    sourceColumnIndex: number,
    cutIndex: number,
    destinationIndex: number,
    placedCard: number,
  ): boolean {
    if (this.parentFoundationCount + foundationDelta >= this.targetCount) {
      return true;
    }
    const key = keyDecoder.decode(this.childCodes);
    if (this.seenKeys.has(key)) {
      return false;
    }
    let { columns, foundations } = parent;
    if (sourceColumnIndex >= 0 || destinationIndex >= 0) {
      const nextColumns = columns.slice();
      let placed = encodeCard(placedCard);
      if (sourceColumnIndex >= 0) {
        const source = columns[sourceColumnIndex]!;
        nextColumns[sourceColumnIndex] = source.slice(0, cutIndex);
        placed = source.slice(cutIndex);
      }
      if (destinationIndex >= 0) {
        nextColumns[destinationIndex] = columns[destinationIndex]! + placed;
      }
      columns = nextColumns;
    }
    if (foundationDelta !== 0) {
      const nextFoundations = foundations.slice();
      nextFoundations[foundationSuitIndex]! += foundationDelta;
      foundations = nextFoundations;
    }
    this.stack.push({ node: { columns, foundations }, key });
    return false;
  }

  /** 次の局面を積む。目標に届く手があれば `true` を返して、そこでやめる。 */
  expand(node: SearchNode): boolean {
    const { columns, foundations } = node;
    writeSearchKeyCodes(node, this.parentCodes);
    this.parentFoundationCount = sumFoundations(foundations);
    const inPool = this.inPool;
    inPool.fill(1);
    let firstEmptyColumnIndex = -1;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]!;
      if (column.length === 0 && firstEmptyColumnIndex < 0) {
        firstEmptyColumnIndex = columnIndex;
      }
      for (let index = 0; index < column.length; index += 1) {
        inPool[decodeCard(column, index)] = 0;
      }
    }
    for (let suitIndex = 0; suitIndex < foundations.length; suitIndex += 1) {
      for (let rank = 1; rank <= foundations[suitIndex]!; rank += 1) {
        inPool[suitIndex * SOLITAIRE_RANK_COUNT + rank - 1] = 0;
      }
    }

    return (
      this.expandTopsToFoundations(node) ||
      this.expandPoolToFoundations(node) ||
      this.expandRunsToColumns(node, firstEmptyColumnIndex) ||
      this.expandPoolToColumns(node, firstEmptyColumnIndex) ||
      this.expandFoundationsToColumns(node, firstEmptyColumnIndex)
    );
  }

  /** 列の一番手前の札を組札へ。 */
  private expandTopsToFoundations(node: SearchNode): boolean {
    const { columns, foundations } = node;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]!;
      if (column.length === 0) {
        continue;
      }
      const card = decodeCard(column, column.length - 1);
      const suitIndex = Math.floor(card / SOLITAIRE_RANK_COUNT);
      if (foundations[suitIndex] !== card % SOLITAIRE_RANK_COUNT) {
        continue;
      }
      const codes = this.beginChild();
      codes[card] = outsideColumnsCode;
      if (column.length > 1) {
        codes[decodeCard(column, column.length - 2)] = columnTopCode;
      }
      codes[SOLITAIRE_CARD_COUNT + suitIndex]! += 1;
      if (
        this.offer(node, suitIndex, 1, columnIndex, column.length - 1, -1, 0)
      ) {
        return true;
      }
    }
    return false;
  }

  /** 山札・捨て札の札を組札へ。 */
  private expandPoolToFoundations(node: SearchNode): boolean {
    const { foundations } = node;
    for (let suitIndex = 0; suitIndex < foundations.length; suitIndex += 1) {
      const rank = foundations[suitIndex]!;
      if (
        rank === SOLITAIRE_RANK_COUNT ||
        this.inPool[suitIndex * SOLITAIRE_RANK_COUNT + rank] === 0
      ) {
        continue;
      }
      const codes = this.beginChild();
      codes[SOLITAIRE_CARD_COUNT + suitIndex]! += 1;
      if (this.offer(node, suitIndex, 1, -1, 0, -1, 0)) {
        return true;
      }
    }
    return false;
  }

  /** 列の並びの途中から上を、別の列へ。 */
  private expandRunsToColumns(
    node: SearchNode,
    firstEmptyColumnIndex: number,
  ): boolean {
    const { columns } = node;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]!;
      if (column.length === 0) {
        continue;
      }
      for (
        let index = findRunStart(column);
        index < column.length;
        index += 1
      ) {
        const card = decodeCard(column, index);
        for (
          let destinationIndex = 0;
          destinationIndex < columns.length;
          destinationIndex += 1
        ) {
          const destination = columns[destinationIndex]!;
          const fits =
            destination.length === 0
              ? index > 0 &&
                destinationIndex === firstEmptyColumnIndex &&
                getSolitaireCardRank(card) === SOLITAIRE_KING_RANK
              : destinationIndex !== columnIndex &&
                stacksOnto[card]![
                  decodeCard(destination, destination.length - 1)
                ]!;
          if (!fits) {
            continue;
          }
          const codes = this.beginChild();
          if (index > 0) {
            codes[decodeCard(column, index - 1)] = columnTopCode;
          }
          if (destination.length > 0) {
            codes[decodeCard(destination, destination.length - 1)] =
              column.charCodeAt(index);
          }
          if (this.offer(node, 0, 0, columnIndex, index, destinationIndex, 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** 1枚の札を列の手前へ足した子の符号を書く。 */
  private writePlacedCard(card: number, destination: string): Uint8Array {
    const codes = this.beginChild();
    if (destination.length > 0) {
      codes[decodeCard(destination, destination.length - 1)] =
        card + cardCodeOffset;
    }
    codes[card] = columnTopCode;
    return codes;
  }

  /** 山札・捨て札の札を列へ。札の番号の順、同じ札なら列の順に打つ。 */
  private expandPoolToColumns(
    node: SearchNode,
    firstEmptyColumnIndex: number,
  ): boolean {
    const { columns } = node;
    const placements: number[] = [];
    for (
      let destinationIndex = 0;
      destinationIndex < columns.length;
      destinationIndex += 1
    ) {
      const destination = columns[destinationIndex]!;
      const candidates =
        destination.length > 0
          ? cardsStackableOn[decodeCard(destination, destination.length - 1)]!
          : destinationIndex === firstEmptyColumnIndex
            ? kings
            : [];
      for (const card of candidates) {
        if (this.inPool[card] === 1) {
          placements.push(card * columns.length + destinationIndex);
        }
      }
    }
    placements.sort((left, right) => left - right);
    for (const placement of placements) {
      const card = Math.floor(placement / columns.length);
      const destinationIndex = placement % columns.length;
      this.writePlacedCard(card, columns[destinationIndex]!);
      if (this.offer(node, 0, 0, -1, 0, destinationIndex, card)) {
        return true;
      }
    }
    return false;
  }

  /** 組札の一番上の札を列へ。 */
  private expandFoundationsToColumns(
    node: SearchNode,
    firstEmptyColumnIndex: number,
  ): boolean {
    const { columns, foundations } = node;
    for (let suitIndex = 0; suitIndex < foundations.length; suitIndex += 1) {
      const rank = foundations[suitIndex]!;
      if (rank === 0) {
        continue;
      }
      const card = suitIndex * SOLITAIRE_RANK_COUNT + rank - 1;
      for (
        let destinationIndex = 0;
        destinationIndex < columns.length;
        destinationIndex += 1
      ) {
        const destination = columns[destinationIndex]!;
        const fits =
          destination.length === 0
            ? destinationIndex === firstEmptyColumnIndex &&
              rank === SOLITAIRE_KING_RANK
            : stacksOnto[card]![
                decodeCard(destination, destination.length - 1)
              ]!;
        if (!fits) {
          continue;
        }
        const codes = this.writePlacedCard(card, destination);
        codes[SOLITAIRE_CARD_COUNT + suitIndex]! -= 1;
        if (this.offer(node, suitIndex, -1, -1, 0, destinationIndex, card)) {
          return true;
        }
      }
    }
    return false;
  }
}

export type SolitaireFoundationCountSearch = {
  outcome: "reached" | "unreachable" | "unknown";
  /** 調べた局面の数。列の並び替えで同じになる局面は1つと数える。 */
  visitedStateCount: number;
};

/**
 * 組札に `targetCount` 枚以上を置いた局面へ、規則の手順で行けるかを、枝刈りをせずに深さ優先で探す。
 * 調べた局面の数が `maxVisitedStates` を超えたら探すのをやめ、`unknown` を返す。
 */
function searchSolitaireFoundationCount(
  state: SolitaireState,
  targetCount: number,
  maxVisitedStates: number,
): SolitaireFoundationCountSearch {
  const start = createSearchNode(state);
  if (sumFoundations(start.foundations) >= targetCount) {
    return { outcome: "reached", visitedStateCount: 0 };
  }

  const search = new FoundationCountSearch(targetCount);
  const { seenKeys, stack } = search;
  search.pushStart(start);
  while (stack.length > 0) {
    const { node, key } = stack.pop()!;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    if (seenKeys.size > maxVisitedStates) {
      return { outcome: "unknown", visitedStateCount: seenKeys.size };
    }
    if (search.expand(node)) {
      return { outcome: "reached", visitedStateCount: seenKeys.size };
    }
  }
  return { outcome: "unreachable", visitedStateCount: seenKeys.size };
}

/**
 * 状態の知らせの判定。クリアした盤面は `reachable` とし、知らせない。
 * 組札から列へ戻して置き直すだけの手は札を増やさないので、そうした手が残っていても `unreachable` になる。
 */
export function findSolitaireFoundationProgress(
  state: SolitaireState,
  maxVisitedStates = SOLITAIRE_FOUNDATION_PROGRESS_STATE_LIMIT,
): SolitaireFoundationProgress {
  if (isSolitaireCleared(state)) {
    return "reachable";
  }
  const { outcome } = searchSolitaireFoundationCount(
    state,
    countSolitaireFoundationCards(state.foundations) + 1,
    maxVisitedStates,
  );
  return outcome === "reached" ? "reachable" : outcome;
}

/** 探すときに1手で行く次の局面の、列と組札。山札と捨て札の札は列にも組札にも無い札なので持たない。 */
function listPooledNextStates(
  state: SolitaireState,
): Pick<SolitaireState, "columns" | "foundations">[] {
  const search = new FoundationCountSearch(Number.POSITIVE_INFINITY);
  search.expand(createSearchNode(state));
  return search.stack.map(({ node }) => ({
    columns: node.columns.map((column) =>
      Array.from(column, (_, index) => decodeCard(column, index)),
    ),
    foundations: Object.fromEntries(
      solitaireSuits.map((suit, suitIndex) => [
        suit,
        node.foundations[suitIndex]!,
      ]),
    ) as SolitaireState["foundations"],
  }));
}

export const _private = {
  listPooledNextStates,
  searchSolitaireFoundationCount,
};
