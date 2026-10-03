import { createTsumeShogiProblemFingerprint } from "@/games/tsume-shogi/problem/generation/fingerprint";
import { parseTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";

/** 3手詰: ▲3三銀打 △3一玉 ▲2二龍。 */
const problem = parseTsumeShogiProblemText({
  sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
  mainLine: ["S*3c", "3b3a", "2d2b"],
});

/** 同じ問題を左右反転したもの。 */
const mirrored = parseTsumeShogiProblemText({
  sfen: "3s5/2k6/9/1+R1P5/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
  mainLine: ["S*7c", "7b7a", "8d8b"],
});

/** 同じ問題を1筋左へ平行移動したもの。 */
const shifted = parseTsumeShogiProblemText({
  sfen: "4s4/5k3/9/4P1+R2/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
  mainLine: ["S*4c", "4b4a", "3d3b"],
});

describe("createTsumeShogiProblemFingerprint", () => {
  test("左右反転した問題に同じ指紋を返すこと", () => {
    const original = createTsumeShogiProblemFingerprint(problem);
    const reflected = createTsumeShogiProblemFingerprint(mirrored);

    expect(reflected).toEqual(original);
  });

  test("平行移動した問題に、局面は違い作意と手筋は同じ指紋を返すこと", () => {
    const original = createTsumeShogiProblemFingerprint(problem);
    const moved = createTsumeShogiProblemFingerprint(shifted);

    expect(moved.position).not.toBe(original.position);
    expect(moved.solution).toBe(original.solution);
    expect(moved.motif).toBe(original.motif);
  });

  test("作意の各手の手筋を並べること", () => {
    const fingerprint = createTsumeShogiProblemFingerprint(problem);

    expect(fingerprint.motif).toBe("打 玉 動");
  });
});
