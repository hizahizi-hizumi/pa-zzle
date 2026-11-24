import { countFukumenzanSplits } from "@/games/fukumenzan/problem/generation/case-splitting";
import { createFukumenzanColumnModel } from "@/games/fukumenzan/problem/generation/column-model";
import {
  createFukumenzanReader,
  type FukumenzanReaderSettings,
} from "@/games/fukumenzan/problem/generation/column-readers";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

/** 場合分けの土台の読み手（1桁ずつの弱い端に、隣の2桁のまとめをつないだ組8まで足す）。 */
const splitBaseSettings: FukumenzanReaderSettings = {
  column: { kind: "bounds-when-many", tupleLimit: 4 },
  hiddenSingles: false,
  nakedSubsets: false,
  adjacentPairs: { kind: "joined", cap: 8 },
  adjacentTriples: null,
  sharedLetterPairs: null,
  separatedTriples: null,
  pairProductLimit: null,
  equations: null,
};

function countSplits(equation: string, frontierLimit: number) {
  const model = createFukumenzanColumnModel(parseFukumenzanEquation(equation)!);
  return countFukumenzanSplits({
    reader: createFukumenzanReader(model, splitBaseSettings),
    branch: { kind: "closure" },
    splitLimit: 2,
    frontierLimit,
  });
}

describe("countFukumenzanSplits", () => {
  // 2回の場合分けで解ける L5 の式。
  const twoSplits = "YWUFW+YHFHD+HEFLH=DHUEFY";

  test("2回で解ける式の回数を2と数えること", () => {
    expect(countSplits(twoSplits, 300)).toBe(2);
  });

  test("最後の回より前に調べる盤面が上限を超えたら打ち切ること", () => {
    expect(countSplits(twoSplits, 0)).toBe("frontier-cap");
  });

  test("許した場合分けがどれも何も消さない式を、進めないと返すこと", () => {
    expect(countSplits("PHVPN+XUCXP+VCBH=JBNPUP", 300)).toBe("stalled");
  });
});
