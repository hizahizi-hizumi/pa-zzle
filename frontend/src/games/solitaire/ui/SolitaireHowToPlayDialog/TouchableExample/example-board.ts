import {
  getSolitaireCardRank,
  isRedSolitaireCard,
  SOLITAIRE_KING_RANK,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import {
  isSameSolitairePile,
  type SolitairePile,
  type SolitairePileSelection,
  selectSolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
import {
  applySolitaireMove,
  type SolitaireSource,
  type SolitaireTransfer,
} from "@/games/solitaire/puzzle/rules";
import {
  findSolitaireRunStart,
  getSolitaireFoundationTop,
  isSameSolitaireState,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import type { SolitaireHowToPlayExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";

/**
 * 触れる例の今の姿。
 * - `selectedSource`: 選んでいる置き元。
 * - `lastTransfer`: 最後に打った、札を動かす手。山札を押した手は残さない。
 * - `rejectedPile`: 最後に押して受け付けなかった山。盤面が変わるか、選び直す・選ぶのをやめるまで残す。
 */
export type SolitaireExampleBoard = {
  state: SolitaireState;
  selectedSource: SolitaireSource | null;
  lastTransfer: SolitaireTransfer | null;
  rejectedPile: SolitairePile | null;
};

export function createSolitaireExampleBoard(
  example: SolitaireHowToPlayExample,
): SolitaireExampleBoard {
  return {
    state: example.state,
    selectedSource: example.selectedSource ?? null,
    lastTransfer: null,
    rejectedPile: null,
  };
}

/**
 * 山を押す。本番のプレイと同じく、置き元を選び、選ぶのをやめ、手を打ち、受け付けない押し方は盤面も選びも変えない。
 * 盤面が受け付けたことも返し、本番と同じ動きと音に使う。
 */
export function pressSolitaireExamplePile(
  board: SolitaireExampleBoard,
  pile: SolitairePile,
): { board: SolitaireExampleBoard; selection: SolitairePileSelection } {
  const selection = selectSolitairePile(
    board.state,
    board.selectedSource,
    pile,
  );
  switch (selection.type) {
    case "source-selected":
      return {
        board: {
          ...board,
          selectedSource: selection.source,
          rejectedPile: null,
        },
        selection,
      };
    case "source-deselected":
      return {
        board: { ...board, selectedSource: null, rejectedPile: null },
        selection,
      };
    case "invalid":
      return { board: { ...board, rejectedPile: pile }, selection };
    case "move": {
      const { move } = selection;
      return {
        board: {
          state: applySolitaireMove(board.state, move) ?? board.state,
          selectedSource: null,
          lastTransfer: move.kind === "transfer" ? move : board.lastTransfer,
          rejectedPile: null,
        },
        selection,
      };
    }
  }
}

type ExampleCheckpoint = {
  state: SolitaireState;
  selectedSource: SolitaireSource | null;
  next: SolitairePile;
};

/**
 * 例が見せる手を押していく途中の姿と、その次に押す山。最初から選んでいる例は、選ぶのをやめた姿から置き元を選び直す所も含める。
 */
function listCheckpoints(
  example: SolitaireHowToPlayExample,
): ExampleCheckpoint[] {
  const checkpoints: ExampleCheckpoint[] = [];
  let board = createSolitaireExampleBoard(example);
  if (example.selectedSource !== undefined) {
    checkpoints.push({
      state: example.state,
      selectedSource: null,
      next: example.selectedSource,
    });
  }
  for (const pile of example.presses) {
    checkpoints.push({
      state: board.state,
      selectedSource: board.selectedSource,
      next: pile,
    });
    board = pressSolitaireExamplePile(board, pile).board;
  }
  return checkpoints;
}

function isSameSource(
  left: SolitaireSource | null,
  right: SolitaireSource | null,
): boolean {
  return left === null || right === null
    ? left === right
    : isSameSolitairePile(left, right);
}

/**
 * 押す所の手がかりを付ける山。例が見せる手を押していく途中の姿なら、次に押す山に付ける。
 * 受け付けない山を押した後は、盤面が変わるか選び直すまで付けない。手がかりが残ると、弾かれた山と別の所を指したまま、
 * 押せば通るように読めるため。押し終えた後と、例が見せる手から外れた姿でも付けない。元の形に戻ればまた付ける。
 */
export function getSolitaireExampleHintPile(
  board: SolitaireExampleBoard,
  example: SolitaireHowToPlayExample,
): SolitairePile | null {
  if (board.rejectedPile !== null) {
    return null;
  }
  const checkpoint = listCheckpoints(example).findLast(
    ({ state, selectedSource }) =>
      isSameSolitaireState(state, board.state) &&
      isSameSource(selectedSource, board.selectedSource),
  );
  return checkpoint?.next ?? null;
}

/** 例が見せる手の置き元と置き先。最初から選んでいる置き元か最初に押す山から、最後に押す山へ動かす。 */
function getExampleTrial(example: SolitaireHowToPlayExample): {
  source: SolitaireSource;
  destination: SolitairePile;
} {
  const [first, ...rest] = example.presses;
  const source = example.selectedSource ?? first;
  const destination = rest.at(-1) ?? first;
  if (
    source === undefined ||
    destination === undefined ||
    source.pile === "stock"
  ) {
    throw new Error("例が見せる手に、置き元と置き先がありません。");
  }
  return { source, destination };
}

/** 今の盤面で、例が見せる手（置き元から置き先へ）を打てるか。本番で置き元を選んで置き先を押したときに手を打つかで決める。 */
export function canPlayExampleTrial(
  board: SolitaireExampleBoard,
  example: SolitaireHowToPlayExample,
): boolean {
  const { source, destination } = getExampleTrial(example);
  return selectSolitairePile(board.state, source, destination).type === "move";
}

/** 例が見せる手で動く札の枚数。今の盤面で打てなければ 0。 */
export function countExampleTrialCards(
  board: SolitaireExampleBoard,
  example: SolitaireHowToPlayExample,
): number {
  const { source, destination } = getExampleTrial(example);
  const selection = selectSolitairePile(board.state, source, destination);
  return selection.type === "move" && selection.move.kind === "transfer"
    ? selection.move.cardCount
    : 0;
}

/** 最後に試した手が、札を動かした手か。選んでいる間と、受け付けずに弾いた後は、試した手は動かした手ではない。 */
export function hasMovedSinceTry(board: SolitaireExampleBoard): boolean {
  return (
    board.selectedSource === null &&
    board.rejectedPile === null &&
    board.lastTransfer !== null
  );
}

/**
 * 列へ置けないわけ。置く札と列のいちばん手前の札を比べ、本番の判定が置けないとしたときに、どちらで外れたかを言う。
 * - `not-king`: 空いた列へ K でない札を置こうとした。
 * - `same-color`: 色が同じ。
 * - `rank`: 数が1つ小さくない。
 * 置き元の動かせる並びのどの札も置けないときは、並びの奥の札（置こうとした札のうち最初に重ねる札）で比べる。
 */
export type SolitaireColumnRejection = "not-king" | "same-color" | "rank";

function getSourceCards(
  state: SolitaireState,
  source: SolitaireSource,
): readonly SolitaireCard[] {
  switch (source.pile) {
    case "column": {
      const cards = state.columns[source.columnIndex] ?? [];
      return cards.slice(findSolitaireRunStart(cards));
    }
    case "waste": {
      const top = state.waste.at(-1);
      return top === undefined ? [] : [top];
    }
    case "foundation": {
      const top = getSolitaireFoundationTop(state.foundations, source.suit);
      return top === null ? [] : [top];
    }
  }
}

function findColumnRejection(
  card: SolitaireCard,
  base: SolitaireCard | undefined,
): SolitaireColumnRejection | null {
  if (base === undefined) {
    return getSolitaireCardRank(card) === SOLITAIRE_KING_RANK
      ? null
      : "not-king";
  }
  if (isRedSolitaireCard(card) === isRedSolitaireCard(base)) {
    return "same-color";
  }
  return getSolitaireCardRank(card) + 1 === getSolitaireCardRank(base)
    ? null
    : "rank";
}

/**
 * 今の盤面で、選んでいる置き元から各列へ置けるか。本番で置き先を押したときに手を打つかで決め、置けない列には置けないわけを添える。
 * 選んでいる列自身は `null`。置き元を選んでいなければ、答えは無いので `null` を返す。
 */
export function judgeSolitaireExampleColumns(
  board: SolitaireExampleBoard,
  columnIndexes: readonly number[],
):
  | (
      | { allowed: true }
      | { allowed: false; rejection: SolitaireColumnRejection | null }
      | null
    )[]
  | null {
  const { state, selectedSource } = board;
  if (selectedSource === null) {
    return null;
  }
  const sourceCards = getSourceCards(state, selectedSource);
  return columnIndexes.map((columnIndex) => {
    const pile: SolitairePile = { pile: "column", columnIndex };
    if (isSameSolitairePile(selectedSource, pile)) {
      return null;
    }
    if (selectSolitairePile(state, selectedSource, pile).type === "move") {
      return { allowed: true };
    }
    const first = sourceCards[0];
    return {
      allowed: false,
      rejection:
        first === undefined
          ? null
          : findColumnRejection(first, state.columns[columnIndex]?.at(-1)),
    };
  });
}

/** 最初の盤面から変わったか。選んだ・選ぶのをやめただけでは変わったとみなさない。同じ山をもう一度押せば戻せるため。 */
export function hasExampleBoardChanged(
  board: SolitaireExampleBoard,
  example: SolitaireHowToPlayExample,
): boolean {
  return !isSameSolitaireState(board.state, example.state);
}
