import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import {
  parseTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  type TsumeShogiHand,
} from "@/games/tsume-shogi/puzzle/position";
import type { TsumeShogiSelection } from "@/games/tsume-shogi/session/session";

/**
 * 盤の右上の隅から切り出して見せる範囲。1筋から `files` 筋まで、一段目から `ranks` 段目まで。
 * 切り出した左と下の端は、盤が続くことが分かるよう、升を半分だけ淡く消えていく形で見せる（`HowToPlayBoard`）。
 */
export type TsumeShogiFigureCrop = { files: number; ranks: number };

/**
 * 例の下に添える言葉。
 * - `candidates`: 選んでいる駒の行き先ごとに、升の上に ✓ / ✕ の札を置き、下に凡例を添える。`judge` は札の決め方で、
 *   `check` は王手になるか、`mate` は残りの手数のうちに詰むか。
 * - `remaining`: 詰ませるまでに残っている手数。
 * - `interposition`: 王手に、玉方が持駒を間に打って防ぐこと。
 * - `drop`: 手がかりで示す持駒の打ちを打てるか。`rule` は例が教える、打てない手のルールで、打てないときはわけを添える。
 * - `forced-promotion`: 成らなければ行き所の無い升へ動く駒が、成って指されること。
 * - `none`: 操作の例。言葉を添えない。
 */
export type TsumeShogiExampleCaption =
  | { kind: "candidates"; judge: "check" | "mate" }
  | { kind: "remaining" }
  | { kind: "interposition" }
  | { kind: "drop"; rule: "double-pawn" | "pawn-drop-mate" | "dead-piece" }
  | { kind: "forced-promotion" }
  | { kind: "none" };

/**
 * 触れる例。どの例も本番と同じ詰将棋の1問で、本番の session の遷移で動く。
 * - `preludeTurns`: 例を始める前に、作意の頭から指しておく攻方と玉方の手の組の数。
 * - `selection`: 最初から選んでおく駒。選んだ駒の行き先に札を付ける例で使う。
 * - `shownAttacks`: 手がかりで順に示す攻方の手。指せない手も含む。
 * - `showsPieceBox`: 盤の上に、玉方の持駒の札を本番と同じに出す。
 * - `showsStatus`: 盤の下に、本番と同じ直前の手と、この手数では詰まないという知らせの行を出す。
 */
export type TsumeShogiHowToPlayExample = {
  problem: TsumeShogiProblem;
  crop: TsumeShogiFigureCrop;
  preludeTurns: number;
  selection: TsumeShogiSelection | null;
  shownAttacks: readonly TsumeShogiMove[];
  showsPieceBox: boolean;
  showsStatus: boolean;
  caption: TsumeShogiExampleCaption;
};

type ProblemSource = {
  /** 盤面の SFEN。 */
  board: string;
  attackerHand: Partial<TsumeShogiHand>;
  mainLine: readonly string[];
};

function createProblem({
  board,
  attackerHand,
  mainLine,
}: ProblemSource): TsumeShogiProblem {
  return {
    initialPosition: createTsumeShogiPosition(board, attackerHand),
    plies: mainLine.length,
    mainLine: mainLine.map(parseTsumeShogiMoveUsi),
  };
}

type ExampleSource = ProblemSource &
  Partial<
    Pick<
      TsumeShogiHowToPlayExample,
      "preludeTurns" | "selection" | "showsPieceBox" | "showsStatus"
    >
  > & {
    crop?: TsumeShogiFigureCrop;
    shownAttacks: readonly string[];
    caption: TsumeShogiExampleCaption;
  };

const cornerCrop: TsumeShogiFigureCrop = { files: 4, ranks: 4 };

/** 対で並べる例の範囲。2つの盤面を横に並べられるよう、3筋に切り出す。 */
const pairCrop: TsumeShogiFigureCrop = { files: 3, ranks: 4 };

function createExample({
  crop = cornerCrop,
  preludeTurns = 0,
  selection = null,
  showsPieceBox = false,
  showsStatus = false,
  shownAttacks,
  caption,
  ...problem
}: ExampleSource): TsumeShogiHowToPlayExample {
  return {
    problem: createProblem(problem),
    crop,
    preludeTurns,
    selection,
    shownAttacks: shownAttacks.map(parseTsumeShogiMoveUsi),
    showsPieceBox,
    showsStatus,
    caption,
  };
}

/**
 * 玉を1二に置き、3三の金を選んだ盤。金の行き先のうち、玉の隣の2つ（2二・2三）は王手になり、
 * ほかの4つ（4二・3二・4三・3四）は王手にならない。王手の升は4四の角と2四の飛が守るので、玉は金を取らずに逃げる。
 * 手がかりは、王手にならない後ろの升で弾かれるところを見せる。
 */
export const checkRuleExample = createExample({
  board: "9/8k/6G2/5B1R1/9/9/9/9/9",
  attackerHand: { gold: 1 },
  mainLine: ["3c2b", "1b1c", "2b2c"],
  selection: { type: "board", square: { file: 3, rank: 3 } },
  shownAttacks: ["3c3d"],
  caption: { kind: "candidates", judge: "check" },
});

/** 銀2枚で詰ませる3手詰。銀を打ち（▲2三銀）、玉が上へ逃げ（△2一玉）、2二に銀を打って詰む。 */
export const mateCountExample = createExample({
  board: "9/8k/9/7G1/9/9/9/9/9",
  attackerHand: { silver: 2 },
  mainLine: ["S*2c", "1b2a", "S*2b"],
  shownAttacks: ["S*2c", "S*2b"],
  showsStatus: true,
  caption: { kind: "remaining" },
});

/**
 * 3手詰の最後の1手（▲2三金打 △3一玉 の後）。持駒の金を選んだ姿から始め、打てる升ごとに、詰むか（3二）、
 * 逃げ道が残って詰まないか（4一・2一・4二・2二）の札を付ける。
 */
export const mateRuleExample = createExample({
  board: "9/7k1/9/8G/9/9/9/9/9",
  attackerHand: { gold: 2 },
  mainLine: ["G*2c", "2b3a", "G*3b"],
  preludeTurns: 1,
  selection: { type: "hand", pieceType: "gold" },
  shownAttacks: ["G*3b"],
  showsStatus: true,
  caption: { kind: "candidates", judge: "mate" },
});

/** 1筋に香を打つ王手に、玉方が持駒（駒箱）の飛を間に打って防ぐ。 */
export const interpositionExample = createExample({
  board: "6s1k/6+B2/9/9/9/9/9/9/9",
  attackerHand: { gold: 1, lance: 1 },
  mainLine: ["L*1c", "R*1b", "G*2a"],
  shownAttacks: ["L*1c"],
  showsPieceBox: true,
  caption: { kind: "interposition" },
});

/** 1一の玉の頭に歩を打つ王手。2三の銀が歩を守り、玉は2一へ逃げられる。 */
const pawnDropSource = {
  crop: pairCrop,
  board: "8k/9/7S1/9/9/9/9/9/9",
  attackerHand: { pawn: 1, gold: 1 },
  mainLine: ["P*1b", "1a2a", "G*2b"],
  shownAttacks: ["P*1b"],
} as const satisfies Omit<ExampleSource, "caption">;

const doublePawnCaption = {
  kind: "drop",
  rule: "double-pawn",
} as const satisfies TsumeShogiExampleCaption;

const pawnDropMateCaption = {
  kind: "drop",
  rule: "pawn-drop-mate",
} as const satisfies TsumeShogiExampleCaption;

/** 左は1筋に歩が無く打てる。右は1筋の四段目に歩があり、同じ筋に打てない（二歩）。 */
export const doublePawnRuleExamples = [
  createExample({ ...pawnDropSource, caption: doublePawnCaption }),
  createExample({
    ...pawnDropSource,
    caption: doublePawnCaption,
    board: "8k/9/7S1/8P/9/9/9/9/9",
    mainLine: ["G*2b"],
  }),
] as const;

/** 左は玉が2一へ逃げられ打てる。右は3二の銀が2一もふさぎ、歩を打つと詰むので打てない（打歩詰）。 */
export const pawnDropMateRuleExamples = [
  createExample({ ...pawnDropSource, caption: pawnDropMateCaption }),
  createExample({
    ...pawnDropSource,
    caption: pawnDropMateCaption,
    board: "8k/6S2/7S1/9/9/9/9/9/9",
    mainLine: ["G*2b"],
  }),
] as const;

/**
 * 左は、2四の桂が二段目の1二へ跳ぶと、成らなければ行き所が無いので成桂で指され、2三の金が守って詰む。
 * 右は、同じ盤面で持駒の桂を二段目の1二に打とうとして、行き所が無いので打てない。
 */
export const forcedPromotionRuleExamples = [
  createExample({
    crop: pairCrop,
    board: "8k/9/7G1/7N1/9/9/9/9/9",
    attackerHand: {},
    mainLine: ["2d1b+"],
    shownAttacks: ["2d1b+"],
    caption: { kind: "forced-promotion" },
  }),
  createExample({
    crop: pairCrop,
    board: "8k/9/7G1/7N1/9/9/9/9/9",
    attackerHand: { knight: 1 },
    mainLine: ["2d1b+"],
    shownAttacks: ["N*1b"],
    caption: { kind: "drop", rule: "dead-piece" },
  }),
] as const;

/** 1四の金を2三へ動かす王手。玉は2一へ逃げる。 */
export const moveOperationExample = createExample({
  board: "9/8k/9/7LG/9/9/9/9/9",
  attackerHand: {},
  mainLine: ["1d2c", "1b2a", "2c2b"],
  shownAttacks: ["1d2c"],
  showsStatus: true,
  caption: { kind: "none" },
});

/** 持駒の金を2三に打つ王手。玉は3一へ逃げる。 */
export const dropOperationExample = createExample({
  board: "9/7k1/9/8+R/9/9/9/9/9",
  attackerHand: { gold: 2 },
  mainLine: ["G*2c", "2b3a", "G*3b"],
  shownAttacks: ["G*2c"],
  showsStatus: true,
  caption: { kind: "none" },
});

/**
 * 3三の飛を1三へ動かす王手。成っても成らなくても王手になるので、成るかを選ぶ。成るかの選択肢は2二・1二に出て、1一の玉を隠さない。
 * 龍に成って玉を2一へ追い、2二に金を打って詰む（入口のゴールの盤面と同じ詰み方）。
 */
export const promotionOperationExample = createExample({
  board: "8k/9/6R2/9/9/9/9/9/9",
  attackerHand: { gold: 1 },
  mainLine: ["3c1c+", "1a2a", "G*2b"],
  shownAttacks: ["3c1c+"],
  showsStatus: true,
  caption: { kind: "none" },
});

/**
 * 入口のゴールの盤面。5三の飛を龍に成って王手し（▲1三飛成）、玉が2一へ逃げ、2二に金を打って詰む。
 * 始まりの盤面から作意を1手ずつ指し、詰ませて本番の詰みの演出で終える。
 */
export const goalFigure = {
  problem: createProblem({
    board: "8k/9/4R4/9/9/9/9/9/9",
    attackerHand: { gold: 1 },
    mainLine: ["5c1c+", "1a2a", "G*2b"],
  }),
  crop: { files: 5, ranks: 4 },
} as const;
/**
 * 採点の誤王手の数え方の流れ。1一の玉を3三の龍と持駒の銀2枚で攻める3手詰（▲2二銀打 △1二玉 …）の、始まりの盤面から始める。
 * どの王手も龍を動かす手にし、王手した龍が盤に残り、玉と龍が3筋×3段に収まって、どこへ王手して玉がどこへ逃れたかを盤面で読めるようにする。
 * - `wrongCheck`: 誤王手（▲3一龍 △1二玉）。
 * - `continuedCheck`: 誤王手の筋で続けた王手（▲1一龍）。
 * - `otherWrongCheck`: 待ったで戻した盤面からの、別の誤王手（▲1三龍 △2一玉）。
 */
export const wrongCheckFlowFigure = {
  problem: createProblem({
    board: "8k/9/6+R2/9/9/9/9/9/9",
    attackerHand: { silver: 2 },
    mainLine: ["S*2b", "1a1b", "S*2a"],
  }),
  crop: { files: 3, ranks: 3 },
  wrongCheck: parseTsumeShogiMoveUsi("3c3a"),
  continuedCheck: parseTsumeShogiMoveUsi("3a1a"),
  otherWrongCheck: parseTsumeShogiMoveUsi("3c1c"),
} as const;
