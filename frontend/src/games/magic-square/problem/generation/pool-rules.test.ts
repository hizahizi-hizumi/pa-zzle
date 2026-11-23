import { magicSquareExampleSquares } from "@/games/magic-square/problem/example-squares";
import {
  createMagicSquarePoolCandidate,
  isMagicSquareExampleAnswer,
  judgeMagicSquarePoolCandidate,
  listMagicSquareExampleSolutionKeys,
  MAGIC_SQUARE_NEAR_DISTANCE_LIMIT,
} from "@/games/magic-square/problem/generation/pool-rules";
import reference from "@/games/magic-square/problem/generation/research-reference.json";
import {
  listMagicSquareSymmetries,
  transformMagicSquareGrid,
} from "@/games/magic-square/problem/generation/symmetry";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_supply.expected.json の examples と near_pairs。
// 採否の規則は、供給実験の推奨の規則（近さ 4 以下を除く、4×4 の答えを回転・裏返しで同じとみなして1度だけ使う）。

const caseById = new Map(reference.cases.map((entry) => [entry.id, entry]));

function candidateOf(id: string) {
  const entry = caseById.get(id);
  return createMagicSquarePoolCandidate(
    entry?.givens ?? [],
    entry?.solution ?? [],
  );
}

/** 与える数を1つ、答えの数のまま別の空いたマスへ動かした問題。答えは同じで、近さは 2。 */
function moveOneGiven(id: string) {
  const entry = caseById.get(id);
  const givens = [...(entry?.givens ?? [])];
  const solution = entry?.solution ?? [];
  const from = givens.findIndex((value) => value !== 0);
  const to = givens.indexOf(0);
  givens[from] = 0;
  givens[to] = solution[to] ?? 0;
  return createMagicSquarePoolCandidate(givens, solution);
}

describe("例の魔方陣", () => {
  test("遊び方とチュートリアルの魔方陣と、その答えのキーが調査コードと同じこと", () => {
    expect({
      squares: magicSquareExampleSquares,
      keys: listMagicSquareExampleSolutionKeys(),
    }).toEqual({
      squares: reference.examples.squares,
      keys: [
        reference.examples.solution_keys["4"],
        reference.examples.solution_keys["5"],
      ],
    });
  });

  test("4×4 の例を列の構造の自己同型と補数で写した64通りを、調査コードと同じに除くこと", () => {
    const images = listMagicSquareSymmetries(4, "G").flatMap((map) =>
      [false, true].map((complement) =>
        transformMagicSquareGrid(magicSquareExampleSquares[4], map, complement),
      ),
    );
    const imageKeys = [...new Set(images.map((image) => image.join(",")))];

    expect({
      images: imageKeys.toSorted(),
      excluded: images.every(isMagicSquareExampleAnswer),
    }).toEqual({
      images: reference.examples.excluded_4x4_squares
        .map((square) => square.join(","))
        .toSorted(),
      excluded: true,
    });
  });

  test("例と別の類の答えは除かないこと", () => {
    const excluded = reference.cases.filter(({ solution }) =>
      isMagicSquareExampleAnswer(solution),
    );

    expect(excluded).toEqual([]);
  });
});

describe("judgeMagicSquarePoolCandidate", () => {
  const [first4, second4] = reference.cases
    .filter(({ n }) => n === 4)
    .map(({ id }) => id);
  const [first5] = reference.cases
    .filter(({ n }) => n === 5)
    .map(({ id }) => id);

  test("答えが例の魔方陣と同じ類の問題を採らないこと", () => {
    const example = createMagicSquarePoolCandidate(
      [14, 4, 5, 0, 9, 0, 0, 16, 0, 13, 12, 0, 3, 0, 0, 6],
      magicSquareExampleSquares[4],
    );

    expect(judgeMagicSquarePoolCandidate(example, [])).toEqual({
      kind: "example",
    });
  });

  test("先に採った問題を写しただけの問題を、重なりとして採らないこと", () => {
    const accepted = [candidateOf(first4 ?? ""), candidateOf(first5 ?? "")];
    const transformed = reference.transformed.find(({ of }) => of === first5);
    const candidate = createMagicSquarePoolCandidate(
      transformed?.givens ?? [],
      transformed?.solution ?? [],
    );

    expect(judgeMagicSquarePoolCandidate(candidate, accepted)).toEqual({
      kind: "duplicate",
      partner: 1,
    });
  });

  test("4×4 で、回転・裏返しで同じ答えの問題を採らないこと", () => {
    const accepted = [candidateOf(first4 ?? "")];
    const original = caseById.get(first4 ?? "");
    const rotation = listMagicSquareSymmetries(4, "D4")[1] ?? [];
    const candidate = moveOneGiven(first4 ?? "");
    const rotated = createMagicSquarePoolCandidate(
      transformMagicSquareGrid(candidate.givens, rotation),
      transformMagicSquareGrid(original?.solution ?? [], rotation),
    );

    expect(judgeMagicSquarePoolCandidate(rotated, accepted)).toEqual({
      kind: "same-answer-d4",
      partner: 0,
    });
  });

  test(`答えが同じ類で、近さが ${MAGIC_SQUARE_NEAR_DISTANCE_LIMIT} 以下の問題を採らないこと`, () => {
    const accepted = [candidateOf(first5 ?? "")];

    expect(
      judgeMagicSquarePoolCandidate(moveOneGiven(first5 ?? ""), accepted),
    ).toEqual({ kind: "near", partner: 0, distance: 2 });
  });

  test("答えが同じ類でも、近さが離れていれば採ること", () => {
    const pair = reference.near_pairs.find(
      ({ distance }) => distance > MAGIC_SQUARE_NEAR_DISTANCE_LIMIT,
    );
    const accepted = [
      createMagicSquarePoolCandidate(
        pair?.a_givens ?? [],
        pair?.a_solution ?? [],
      ),
    ];
    const candidate = createMagicSquarePoolCandidate(
      pair?.b_givens ?? [],
      pair?.b_solution ?? [],
    );

    expect(judgeMagicSquarePoolCandidate(candidate, accepted)).toEqual({
      kind: "accept",
    });
  });

  test("答えが別の類の問題は採ること", () => {
    expect(
      judgeMagicSquarePoolCandidate(candidateOf(second4 ?? ""), [
        candidateOf(first4 ?? ""),
      ]),
    ).toEqual({ kind: "accept" });
  });
});
