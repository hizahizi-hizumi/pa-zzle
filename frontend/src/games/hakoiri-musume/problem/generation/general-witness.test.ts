import {
  createHakoiriMusumeGeneralGraph,
  measureHakoiriMusumeGeneralGraph,
} from "@/games/hakoiri-musume/problem/generation/general-measure";
import { createHakoiriMusumeProblemSpace } from "@/games/hakoiri-musume/problem/generation/general-space";
import {
  confirmHakoiriMusumeNormalForm,
  measureHakoiriMusumeGeneralPath,
  normalizeHakoiriMusumeGeneralPath,
} from "@/games/hakoiri-musume/problem/generation/general-witness";
import {
  hakoiriMusumeClassicLayout,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";

function spaceOf(board: string) {
  return createHakoiriMusumeProblemSpace(
    hakoiriMusumeClassicLayout,
    parseHakoiriMusumeClassicBoard(board)!,
  );
}

function confirm(board: string) {
  const { space, start } = spaceOf(board);
  const graph = createHakoiriMusumeGeneralGraph(space, [start])!;
  const measures = measureHakoiriMusumeGeneralGraph(graph);
  return {
    preparation: measures.preparation[0],
    normal: confirmHakoiriMusumeNormalForm(graph, measures, 0),
  };
}

describe("confirmHakoiriMusumeNormalForm", () => {
  describe("娘の1手を、入れ替えられるほかの駒の手を挟んで2つに分けた解でしか準備の長さが出ない盤面の場合", () => {
    // 反例探し（3回目）の盤面。まとめると準備の長さは 9 になる。
    const { preparation, normal } = confirm("sAAsvAAvwhiwv..vw..w");

    test("正規形の解で確かめられないこと", () => {
      expect(preparation).toBe(8);
      expect(normal).toBeNull();
    });
  });

  describe("横刀立馬の場合", () => {
    const { preparation, normal } = confirm("vAAvwAAwvhivwssws..s");

    test("正規形の解で準備の長さ 40 を確かめられること", () => {
      expect(preparation).toBe(40);
      expect(normal).not.toBeNull();
    });
  });
});

describe("normalizeHakoiriMusumeGeneralPath", () => {
  describe("前進に関係の無い手を前進の前に置いて区間を割った解の場合", () => {
    // 下の2段の横長の入れ替え（後の区間のための手）を、娘を1つ左へ出す前進の前に置き、区間を 9 / 10 に割った解。
    const boards = [
      ".vAA.wAAhihihihis.s.",
      "v.AAw.AAhihihihis.s.",
      "v.AAw.AAhihihihis..s",
      "v.AAw.AAhihihihi..ss",
      "v.AAw.AAhihi..hihiss",
      "v.AAw.AAhihihi..hiss",
      "v.AAw.AAhihihis.hi.s",
      "v.AAw.AAhihihisshi..",
      "v.AAw.AAhihihiss..hi",
      "v.AAw.AAhihi..sshihi",
      "vAA.wAA.hihi..sshihi",
      "vAA.wAA...hihisshihi",
      "vAA.wAA..hi.hisshihi",
      "vAAswAA..hi.his.hihi",
      "vAAswAAs.hi.hi..hihi",
      "vAAswAAs....hihihihi",
      "vAAswAA.s...hihihihi",
      "v..sw.AAs.AAhihihihi",
      "v..swsAA..AAhihihihi",
      "v..swsAAhiAA..hihihi",
      "v..swsAAhiAAhi..hihi",
      "v..sws..hiAAhiAAhihi",
      "v..sw..shiAAhiAAhihi",
      "..vs..wshiAAhiAAhihi",
      "..vshiws..AAhiAAhihi",
      "..vshiwshiAA..AAhihi",
      "..vshiwshiAAhiAA..hi",
      "..vshiwshiAAhiAAhi..",
      "..vshiwshi..hiAAhiAA",
      "hivs..wshi..hiAAhiAA",
      "hivshiws....hiAAhiAA",
      "hivshiws..hi..AAhiAA",
      "hivshiwshihi..AA..AA",
      "hivshiwshihi.AA..AA.",
    ];
    const { space } = spaceOf(boards[0]!);
    const keys = boards.map((board) => spaceOf(board).start);

    test("前進をできるだけ早くすると、区間が割れなくなり準備の長さが上がること", () => {
      const before = measureHakoiriMusumeGeneralPath(space, keys);
      const normalized = normalizeHakoiriMusumeGeneralPath(space, keys);

      const after = measureHakoiriMusumeGeneralPath(space, normalized);

      expect(before.preparation).toBe(10);
      expect(after.preparation).toBe(18);
    });
  });
});
