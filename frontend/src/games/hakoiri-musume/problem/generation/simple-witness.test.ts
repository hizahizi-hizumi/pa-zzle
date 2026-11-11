import {
  findHakoiriMusumeSimplePreparationPath,
  keepsHakoiriMusumePreparationWhenMerged,
  measureHakoiriMusumePathPreparation,
  mergeHakoiriMusumeDaughterMoves,
} from "@/games/hakoiri-musume/problem/generation/simple-witness";
import {
  createHakoiriMusumeComponentGraph,
  measureHakoiriMusumeStateGraph,
} from "@/games/hakoiri-musume/problem/generation/state-space";

function findWitness(board: string) {
  const graph = createHakoiriMusumeComponentGraph(board);
  const measures = measureHakoiriMusumeStateGraph(graph);
  const index = graph.indexByBoard.get(board)!;
  const path = findHakoiriMusumeSimplePreparationPath(
    graph,
    measures,
    index,
    measures.preparation[index]!,
    measures.detour[index]!,
  );
  return {
    preparation: measures.preparation[index]!,
    detour: measures.detour[index]!,
    boards: path?.map((board) => graph.boards[board]!) ?? null,
  };
}

describe("findHakoiriMusumeSimplePreparationPath", () => {
  describe("同じ盤面を2度通る解でしか準備の長さが出ない盤面の場合", () => {
    // 独立の確かめ（A4）の反例。娘の手を続けない全局面の最小は 29 だが、同じ盤面を2度通らない解の最小は 34。
    const { preparation, boards } = findWitness("ssAAhiAA..hivvhiwwhi");

    test("輪の無い解が見つからず、問題集に採らない側になること", () => {
      expect(preparation).toBe(29);
      expect(boards).toBeNull();
    });
  });

  describe("輪の無い解で準備の長さが出る盤面の場合", () => {
    const cases = [
      ["合意の易しい例", "vAAvwAAwv..vwhiws..s"],
      ["横刀立馬", "vAAvwAAwvhivwssws..s"],
    ] as const;

    describe.each(cases)("%s の場合", (_, board) => {
      // 全局面をたどる分析は数秒かかるので、試験の時間の上限に掛からないよう、準備の段で済ませる。
      const { preparation, detour, boards } = findWitness(board);

      test("同じ盤面を2度通らず、道の上だけで数え直しても同じ準備の長さと遠回りになる解を返すこと", () => {
        const recounted = measureHakoiriMusumePathPreparation(boards ?? []);

        expect(boards?.[0]).toBe(board);
        expect(recounted.simple).toBe(true);
        expect(recounted.separateDaughterMoves).toBe(true);
        expect(recounted.preparation).toBe(preparation);
        expect(Math.min(recounted.detour, 3)).toBe(detour);
      });
    });
  });
});

describe("measureHakoiriMusumePathPreparation", () => {
  const { boards } = findWitness("vAAvwAAwv..vwhiws..s");
  const witness = boards ?? [];
  // 1手目を動かして戻してから、同じ解を続ける。
  const looped = [witness[0]!, witness[1]!, ...witness];

  test("同じ盤面を2度通る道を、輪の無い道と見分けること", () => {
    const measured = measureHakoiriMusumePathPreparation(looped);

    expect(measured.simple).toBe(false);
  });
});

describe("娘の1手をグラフの2辺に分けると準備の長さが下がる盤面の場合", () => {
  // 反例探し（2回目）の盤面。娘を続けて動かす2辺を別の手と数えると、2つ目の辺が前進になって準備の長さが 8 に下がる。
  // 娘の続けての移動は同じ1手なので、娘の辺を続けて使わない解で数えると 9。
  const { preparation, boards } = findWitness("hihisAAsvAAvwhiw....");

  test("娘の辺を続けて使わずに準備の長さを数え、その値の解を返すこと", () => {
    const recounted = measureHakoiriMusumePathPreparation(boards ?? []);

    expect(preparation).toBe(9);
    expect(recounted.separateDaughterMoves).toBe(true);
    expect(recounted.preparation).toBe(9);
  });
});

describe("keepsHakoiriMusumePreparationWhenMerged", () => {
  describe("娘の1手を、入れ替えられるほかの駒の手を挟んで2つに分けた解でしか準備の長さが出ない盤面の場合", () => {
    // 反例探し（3回目）の盤面。娘の手・小駒の手・娘の手を入れ替えて娘の1手にまとめると、準備の長さは 9 で提供範囲外。
    const { preparation, boards } = findWitness("sAAsvAAvwhiwv..vw..w");
    const merged = measureHakoiriMusumePathPreparation(
      mergeHakoiriMusumeDaughterMoves(boards ?? []),
    );

    test("まとめた解で数え直すと準備の長さが上がり、値を保たないと見分けること", () => {
      const keeps = keepsHakoiriMusumePreparationWhenMerged(boards ?? []);

      expect(preparation).toBe(8);
      expect(merged.preparation).toBe(9);
      expect(keeps).toBe(false);
    });
  });

  describe("まとめても値が変わらない解の場合", () => {
    const { preparation, boards } = findWitness("vAAvwAAwvhivwssws..s");

    test("値を保つと見分けること", () => {
      const keeps = keepsHakoiriMusumePreparationWhenMerged(boards ?? []);

      expect(
        measureHakoiriMusumePathPreparation(boards ?? []).preparation,
      ).toBe(preparation);
      expect(keeps).toBe(true);
    });
  });
});
