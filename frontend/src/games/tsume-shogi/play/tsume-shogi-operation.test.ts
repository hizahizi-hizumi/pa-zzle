import { describeTsumeShogiOperation } from "@/games/tsume-shogi/play/tsume-shogi-operation";
import { parseTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import {
  createTsumeShogiSession,
  playTsumeShogiSessionDefenderReply,
  restartTsumeShogiSession,
  type TsumeShogiSession,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";

/** 3手詰: ▲2二銀打 △1二玉 ▲1三龍。2一玉・1一銀（攻方）・4三龍、攻方の持駒は銀。 */
const threePly = parseTsumeShogiProblemText({
  sfen: "7kS/9/5+R3/9/9/9/9/9/9 b Sr2b4g2s4n4l18p 1",
  mainLine: ["S*2b", "2a1b", "4c1c"],
});

const operatedAt = 2_000;

function square(file: number, rank: number): TsumeShogiSquare {
  return { file, rank };
}

function tap(session: TsumeShogiSession, file: number, rank: number) {
  return tapTsumeShogiSessionSquare(session, square(file, rank), operatedAt);
}

const initial = createTsumeShogiSession(threePly, 1_000);
const silverSelected = tapTsumeShogiSessionHand(initial, "silver");
const afterCorrectCheck = tap(silverSelected, 2, 2);
const afterCorrectReply = playTsumeShogiSessionDefenderReply(afterCorrectCheck);
const dragonSelected = tap(afterCorrectReply, 4, 3);
const afterMate = tap(dragonSelected, 1, 3);
const afterWrongCheck = tap(tap(initial, 4, 3), 4, 1);
const afterRefutation = playTsumeShogiSessionDefenderReply(afterWrongCheck);
const afterRejection = tap(silverSelected, 5, 5);

describe("describeTsumeShogiOperation", () => {
  const notifiedCases = [
    [
      "攻方が王手を打つと、指したこと",
      silverSelected,
      afterCorrectCheck,
      "moved",
    ],
    [
      "攻方が詰ませる手を指すと、指したこと",
      dragonSelected,
      afterMate,
      "moved",
    ],
    [
      "玉方が作意の応手を盤面に指すと、応じたこと",
      afterCorrectCheck,
      afterCorrectReply,
      "replied",
    ],
    [
      "誤王手に玉方が反証を盤面に指すと、反証",
      afterWrongCheck,
      afterRefutation,
      "refuted",
    ],
    [
      "指せない升を押すと、着手させなかったこと",
      silverSelected,
      afterRejection,
      "rejected",
    ],
  ] as const;

  test.each(notifiedCases)(
    "%sを知らせること",
    (_, previous, next, expected) => {
      const operation = describeTsumeShogiOperation(previous, next);

      expect(operation).toBe(expected);
    },
  );

  const silentCases = [
    ["持駒を選ぶ", initial, silverSelected],
    ["盤上の駒を選ぶ", afterCorrectReply, dragonSelected],
    [
      "着手させなかった後に駒を選び直す",
      afterRejection,
      tap(afterRejection, 1, 1),
    ],
    ["待った", afterRefutation, undoTsumeShogiSession(afterRefutation)],
    [
      "盤面を戻す",
      afterCorrectReply,
      restartTsumeShogiSession(afterCorrectReply),
    ],
  ] as const;

  test.each(silentCases)("%s操作は知らせないこと", (_, previous, next) => {
    const operation = describeTsumeShogiOperation(previous, next);

    expect(operation).toBeNull();
  });
});
