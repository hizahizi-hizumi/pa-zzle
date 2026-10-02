import { createTsumeShogiPlayAttemptProgress } from "@/games/tsume-shogi/play-attempt";
import { parseTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";
import { createTsumeShogiSession } from "@/games/tsume-shogi/session/session";

/** 3手詰: ▲2二銀打 △1二玉 ▲1三龍。 */
const problem = parseTsumeShogiProblemText({
  sfen: "7kS/9/5+R3/9/9/9/9/9/9 b Sr2b4g2s4n4l18p 1",
  mainLine: ["S*2b", "2a1b", "4c1c"],
});
const session = {
  ...createTsumeShogiSession(problem, 1_000),
  wrongCheckCount: 2,
  refutationViewCount: 3,
  returnCount: 2,
  undoCount: 4,
  restartCount: 1,
  illegalInputCount: 5,
  inputCount: 20,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createTsumeShogiPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    wrongCheckCount: 2,
    refutationViewCount: 3,
    returnCount: 2,
    undoCount: 4,
    restartCount: 1,
    illegalInputCount: 5,
    inputCount: 20,
  });
});
