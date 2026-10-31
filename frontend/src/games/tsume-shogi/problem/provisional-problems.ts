import {
  createTsumeShogiProblemIdentity,
  parseTsumeShogiProblemText,
  type TsumeShogiIdentifiedProblem,
  type TsumeShogiProblemText,
} from "@/games/tsume-shogi/problem/problem";

/**
 * 問題集ができるまで出題する仮の問題。生成器（版 1）がその identity から作る問題を文字列の形で固定した。
 * 実行時に生成器を走らせないため、生成結果をそのまま持つ。難易度は分析していない。
 * 問題集から出題できるようになったら、問題集に置き換えて消す。
 */
const provisionalProblemTexts: readonly {
  plies: 3 | 5;
  candidateIndex: number;
  text: TsumeShogiProblemText;
}[] = [
  {
    plies: 3,
    candidateIndex: 5,
    text: {
      sfen: "3ks1+R2/2n6/4G4/9/9/9/9/9/9 b r2b3g3s3n4l18p 1",
      mainLine: ["3a5a", "6a5a", "S*5b"],
    },
  },
  {
    plies: 3,
    candidateIndex: 14,
    text: {
      sfen: "7kS/9/5+R3/9/9/9/9/9/9 b Sr2b4g2s4n4l18p 1",
      mainLine: ["S*2b", "2a1b", "4c1c"],
    },
  },
  {
    plies: 3,
    candidateIndex: 22,
    text: {
      sfen: "9/5S1L1/7kS/9/9/9/9/9/9 b G2r2b3g2s4n3l18p 1",
      mainLine: ["G*2d", "2c3b", "2d3c"],
    },
  },
  {
    plies: 5,
    candidateIndex: 3,
    text: {
      sfen: "1g7/RS7/1k7/9/+B8/9/9/9/9 b rb3g3s4n4l18p 1",
      mainLine: ["9e7c", "8c9b", "8b8a", "9b8a", "G*8b"],
    },
  },
  {
    plies: 5,
    candidateIndex: 7,
    text: {
      sfen: "1k7/1g7/L1B6/2R6/2G6/9/9/9/9 b rb2g4s4n3l18p 1",
      mainLine: ["7c8b+", "8a8b", "G*9b", "8b8c", "7e8d"],
    },
  },
  {
    plies: 5,
    candidateIndex: 23,
    text: {
      sfen: "7B1/7+P1/5gk2/9/9/2+B6/9/9/9 b 2r3g4s4n4l17p 1",
      mainLine: ["7f4c", "3c2d", "G*2e", "2d1c", "2a1b+"],
    },
  },
];

export function listTsumeShogiProvisionalProblems(): TsumeShogiIdentifiedProblem[] {
  return provisionalProblemTexts.map(({ plies, candidateIndex, text }) => ({
    problem: parseTsumeShogiProblemText(text),
    identity: createTsumeShogiProblemIdentity(plies, candidateIndex),
  }));
}
