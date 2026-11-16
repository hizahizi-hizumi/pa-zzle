import {
  createTsumeShogiExampleBoard,
  performTsumeShogiExampleAction,
  replyTsumeShogiExampleDefender,
  type TsumeShogiExampleAction,
  type TsumeShogiExampleBoard,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import {
  checkRuleExample,
  doublePawnRuleExamples,
  forcedPromotionRuleExamples,
  interpositionExample,
  mateCountExample,
  mateRuleExample,
  pawnDropMateRuleExamples,
  type TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { describeTsumeShogiExampleCaption } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample/example-caption";

/** 操作を順に行い、玉方の応手を待つ手は応手まで進める。 */
function performAll(
  example: TsumeShogiHowToPlayExample,
  actions: readonly TsumeShogiExampleAction[],
): TsumeShogiExampleBoard {
  return actions.reduce(
    (board, action) =>
      replyTsumeShogiExampleDefender(
        performTsumeShogiExampleAction(board, action).board,
      ).board,
    createTsumeShogiExampleBoard(example),
  );
}

function square(file: number, rank: number) {
  return { type: "square", square: { file, rank } } as const;
}

const dropLabels = { allowed: "打てる", disallowed: "打てない" };
const boardLabels = { allowed: "指せる", disallowed: "指せない" };

describe("describeTsumeShogiExampleCaption", () => {
  const cases = [
    [
      "王手だけを指せるルールの最初の姿では、札の凡例",
      checkRuleExample,
      [],
      {
        type: "legend",
        labels: boardLabels,
        shownMarks: { allowed: true, disallowed: true },
      },
    ],
    [
      "王手にならない升で弾かれた姿では、教えるルールで盤面から読めるのでわけを添えない判定",
      checkRuleExample,
      [square(3, 4)],
      {
        type: "verdict",
        allowed: false,
        labels: boardLabels,
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "金が動けない升で弾かれた姿では、別のルールのわけを添えた判定",
      checkRuleExample,
      [square(1, 4)],
      {
        type: "verdict",
        allowed: false,
        labels: boardLabels,
        reason: "動けない升",
        ruleReason: null,
      },
    ],
    [
      "王手を指した後は、試した手の結果",
      checkRuleExample,
      [square(2, 2)],
      {
        type: "verdict",
        allowed: true,
        labels: { allowed: "指せた", disallowed: "指せない" },
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "詰ませるルールの最初の姿では、札の凡例",
      mateRuleExample,
      [],
      {
        type: "legend",
        labels: { allowed: "詰む", disallowed: "詰まない" },
        shownMarks: { allowed: true, disallowed: true },
      },
    ],
    [
      "詰む升に打った後は、詰んだこと",
      mateRuleExample,
      [square(3, 2)],
      {
        type: "verdict",
        allowed: true,
        labels: { allowed: "詰んだ", disallowed: "詰まなかった" },
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "詰まない升に打った後は、詰まなかったこと",
      mateRuleExample,
      [square(2, 2)],
      {
        type: "verdict",
        allowed: false,
        labels: { allowed: "詰んだ", disallowed: "詰まなかった" },
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "王手にならない升に打った後は、別のルールのわけを添えた判定",
      mateRuleExample,
      [square(4, 4)],
      {
        type: "verdict",
        allowed: false,
        labels: dropLabels,
        reason: "王手にならない",
        ruleReason: null,
      },
    ],
    [
      "手数のルールの最初の姿では、残りの手数",
      mateCountExample,
      [],
      { type: "text", text: "あと3手" },
    ],
    [
      "手数のルールで1組指した後は、残りの手数",
      mateCountExample,
      [{ type: "hand", pieceType: "silver" }, square(2, 3)],
      { type: "text", text: "あと1手" },
    ],
    [
      "手数のルールで詰ませた後は、手数",
      mateCountExample,
      [
        { type: "hand", pieceType: "silver" },
        square(2, 3),
        { type: "hand", pieceType: "silver" },
        square(2, 2),
      ],
      { type: "text", text: "3手で詰んだ" },
    ],
    [
      "玉方の持駒のルールの最初の姿では、玉方が間に打てること",
      interpositionExample,
      [],
      { type: "text", text: "間に打って防ぐ" },
    ],
    [
      "香車を打った後は、玉方が間に打った駒",
      interpositionExample,
      [{ type: "hand", pieceType: "lance" }, square(1, 3)],
      { type: "text", text: "飛車を間に打って防いだ" },
    ],
    [
      "二歩のルールの左の最初の姿では、打てること",
      doublePawnRuleExamples[0],
      [],
      {
        type: "verdict",
        allowed: true,
        labels: dropLabels,
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "二歩のルールの右の最初の姿では、盤面から読み取りにくいわけを添えて打てないこと",
      doublePawnRuleExamples[1],
      [],
      {
        type: "verdict",
        allowed: false,
        labels: dropLabels,
        reason: null,
        ruleReason: "同じ列に歩がある",
      },
    ],
    [
      "二歩のルールの右で歩を打った後も、同じわけを添えて打てないこと",
      doublePawnRuleExamples[1],
      [{ type: "hand", pieceType: "pawn" }, square(1, 2)],
      {
        type: "verdict",
        allowed: false,
        labels: dropLabels,
        reason: null,
        ruleReason: "同じ列に歩がある",
      },
    ],
    [
      "打歩詰のルールの左の最初の姿では、打てること",
      pawnDropMateRuleExamples[0],
      [],
      {
        type: "verdict",
        allowed: true,
        labels: dropLabels,
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "打歩詰のルールの右の最初の姿では、わけを添えて打てないこと",
      pawnDropMateRuleExamples[1],
      [],
      {
        type: "verdict",
        allowed: false,
        labels: dropLabels,
        reason: null,
        ruleReason: "打つと詰む",
      },
    ],
    [
      "打歩詰のルールの左で歩を打った後は、打てたこと",
      pawnDropMateRuleExamples[0],
      [{ type: "hand", pieceType: "pawn" }, square(1, 2)],
      {
        type: "verdict",
        allowed: true,
        labels: { allowed: "打てた", disallowed: "打てない" },
        reason: null,
        ruleReason: null,
      },
    ],
    [
      "行き所の無い駒のルールの左で桂馬を跳ばした後は、成って指したこと",
      forcedPromotionRuleExamples[0],
      [square(2, 4), square(1, 2)],
      { type: "text", text: "成って指した" },
    ],
    [
      "行き所の無い駒のルールの右の最初の姿では、わけを添えて打てないこと",
      forcedPromotionRuleExamples[1],
      [],
      {
        type: "verdict",
        allowed: false,
        labels: dropLabels,
        reason: null,
        ruleReason: "行き所が無い",
      },
    ],
  ] as const satisfies readonly (readonly [
    string,
    TsumeShogiHowToPlayExample,
    readonly TsumeShogiExampleAction[],
    unknown,
  ])[];

  test.each(cases)("%sを返すこと", (_, example, actions, expected) => {
    const board = performAll(example, actions);

    const caption = describeTsumeShogiExampleCaption(board, example);

    expect(caption).toEqual(expected);
  });

  describe("詰まない筋で手数が尽きた場合", () => {
    const board = performAll(mateCountExample, [
      { type: "hand", pieceType: "silver" },
      square(1, 3),
      { type: "hand", pieceType: "silver" },
      square(2, 2),
    ]);

    test("盤の下の知らせに任せ、言葉を添えないこと", () => {
      const caption = describeTsumeShogiExampleCaption(board, mateCountExample);

      expect(caption).toBeNull();
    });
  });
});
