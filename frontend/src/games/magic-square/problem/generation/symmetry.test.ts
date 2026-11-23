import reference from "@/games/magic-square/problem/generation/research-reference.json";
import {
  createMagicSquareProblemKeys,
  listMagicSquareSymmetries,
  measureMagicSquareNearDistance,
  transformMagicSquareGrid,
} from "@/games/magic-square/problem/generation/symmetry";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_supply.expected.json の group_sizes・cases・transformed・near_pairs。

const caseById = new Map(reference.cases.map((entry) => [entry.id, entry]));

function compose(
  first: readonly number[],
  second: readonly number[],
): number[] {
  return first.map((cellIndex) => second[cellIndex]!);
}

describe("listMagicSquareSymmetries", () => {
  test.each([4, 5, 6])(
    "%i×%i の列の構造の自己同型が、調査コードと同じ数で、回転・裏返しを含み、合成で閉じること",
    (size) => {
      const group = listMagicSquareSymmetries(size, "G");
      const keys = new Set(group.map((map) => map.join(",")));

      expect({
        size: group.length,
        includesD4: listMagicSquareSymmetries(size, "D4").every((map) =>
          keys.has(map.join(",")),
        ),
        closed: group.every((first) =>
          group.every((second) => keys.has(compose(first, second).join(","))),
        ),
      }).toEqual({
        size: reference.group_sizes[String(size) as "4" | "5" | "6"],
        includesD4: true,
        closed: true,
      });
    },
  );
});

describe("createMagicSquareProblemKeys", () => {
  test.each(reference.cases.map((entry) => [entry.id, entry] as const))(
    "%s の問題・答え・置き場所のキーが調査コードと同じこと",
    (_, entry) => {
      const keys = createMagicSquareProblemKeys(entry.givens, entry.solution);

      expect(keys).toEqual({
        problem: entry.problem_key,
        problemD4: entry.problem_key_d4,
        solution: entry.solution_key,
        solutionD4: entry.solution_key_d4,
        layout: entry.layout_key,
      });
    },
  );

  test.each(
    reference.transformed.map((entry, index) => [index, entry] as const),
  )(
    "写した盤面 %i が調査コードと同じ盤面になり、写す前と同じキーになること",
    (_, entry) => {
      const original = caseById.get(entry.of);
      const givens = transformMagicSquareGrid(
        original?.givens ?? [],
        entry.map,
        entry.complement,
      );
      const solution = transformMagicSquareGrid(
        original?.solution ?? [],
        entry.map,
        entry.complement,
      );
      const keys = createMagicSquareProblemKeys(givens, solution);

      expect({
        givens,
        solution,
        problem: keys.problem,
        solutionKey: keys.solution,
      }).toEqual({
        givens: entry.givens,
        solution: entry.solution,
        problem: entry.problem_key,
        solutionKey: entry.solution_key,
      });
    },
  );
});

describe("measureMagicSquareNearDistance", () => {
  test.each(
    reference.near_pairs.map((pair) => [pair.a, pair.b, pair] as const),
  )("%s と %s の近さが調査コードと同じこと", (_, __, pair) => {
    const distance = measureMagicSquareNearDistance(
      { givens: pair.a_givens, solution: pair.a_solution },
      { givens: pair.b_givens, solution: pair.b_solution },
    );

    expect(distance).toBe(pair.distance);
  });

  test("答えが別の類の2問には近さが無いこと", () => {
    const [first, second] = reference.cases.filter(({ n }) => n === 4);

    expect(
      measureMagicSquareNearDistance(
        { givens: first?.givens ?? [], solution: first?.solution ?? [] },
        { givens: second?.givens ?? [], solution: second?.solution ?? [] },
      ),
    ).toBeNull();
  });
});
