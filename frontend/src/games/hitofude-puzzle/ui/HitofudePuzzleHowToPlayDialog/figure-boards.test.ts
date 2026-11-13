import { isHitofudePuzzleUniquelySolvable } from "@/games/hitofude-puzzle/problem/generation/solver";
import {
  getHitofudePuzzleNeighborCell,
  hitofudePuzzleDirections,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  isHitofudePuzzleDeadEnd,
  isHitofudePuzzleSolved,
} from "@/games/hitofude-puzzle/puzzle/rules";
import {
  extendHitofudePuzzle,
  type HitofudePuzzleExtension,
  rewindHitofudePuzzle,
} from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  allCellsRuleExamples,
  extendOperationExample,
  getHitofudePuzzleHowToPlayHintCell,
  goalFigure,
  type HitofudePuzzleHowToPlayExample,
  holeRuleExample,
  onceRuleExample,
  rewindOperationExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";

/** 触る前の道から、手がかりのマスを本番の遷移で順に押していった結果。弾かれたらそこで止める。 */
function pressHints({
  board,
  path,
  hints,
}: HitofudePuzzleHowToPlayExample): HitofudePuzzleExtension[] {
  const extensions: HitofudePuzzleExtension[] = [];
  let state = { path };
  for (const cell of hints.map(getHitofudePuzzleHowToPlayHintCell)) {
    const extension = extendHitofudePuzzle(board, state, cell);
    extensions.push(extension);
    if (extension.kind === "rejected") {
      break;
    }
    state = extension.state;
  }
  return extensions;
}

/** 先端から見た4つの向きの先が、来たマス・通れるマス・通れないマス（理由）・盤面の端のどれか。 */
function describeHeadSurroundings({
  board,
  path,
}: HitofudePuzzleHowToPlayExample): string[] {
  const head = path.at(-1)!;
  return hitofudePuzzleDirections.map((direction) => {
    const cell = getHitofudePuzzleNeighborCell(board.size, head, direction);
    if (cell === null) {
      return `${direction}: 端`;
    }
    if (cell === path.at(-2)) {
      return `${direction}: 来たマス`;
    }
    const extension = extendHitofudePuzzle(board, { path }, cell);
    return extension.kind === "extended"
      ? `${direction}: 通れる`
      : `${direction}: ${extension.reason}`;
  });
}

describe("goalFigure", () => {
  test("解の道が本番の判定で完成になること", () => {
    const solved = isHitofudePuzzleSolved(
      goalFigure.board,
      goalFigure.solution,
    );

    expect(solved).toBe(true);
  });

  test("始点からすべてのマスを通る道がただ1つの盤面であること", () => {
    const unique = isHitofudePuzzleUniquelySolvable(goalFigure.board);

    expect(unique).toBe(true);
  });
});

describe.each([
  [
    "onceRuleExample",
    onceRuleExample,
    ["up: 通れる", "right: 来たマス", "down: visited", "left: 通れる"],
  ],
  [
    "holeRuleExample",
    holeRuleExample,
    ["up: hole", "right: 来たマス", "down: 端", "left: 通れる"],
  ],
] as const)("%s", (_, example, expected) => {
  test("先端の隣に、来たマスと、例が教えるルールで通れないマスと、通れるマスがあること", () => {
    const surroundings = describeHeadSurroundings(example);

    expect(surroundings).toEqual(expected);
  });

  test("触る前は、本番の判定で行き止まりでも完成でもないこと", () => {
    const status = [
      isHitofudePuzzleDeadEnd(example.board, example.path),
      isHitofudePuzzleSolved(example.board, example.path),
    ];

    expect(status).toEqual([false, false]);
  });
});

describe("onceRuleExample", () => {
  test("手がかりは左の通れるマスに付き、本番の遷移で延びて、完成も行き止まりもしないこと（通ったマスは押すと戻るだけで弾かれないため）", () => {
    const extensions = pressHints(onceRuleExample);
    const last = extensions.at(-1);
    const path = last?.kind === "extended" ? last.state.path : [];

    expect(extensions.map(({ kind }) => kind)).toEqual(["extended"]);
    expect(onceRuleExample.hints).toEqual([3]);
    expect([
      isHitofudePuzzleDeadEnd(onceRuleExample.board, path),
      isHitofudePuzzleSolved(onceRuleExample.board, path),
    ]).toEqual([false, false]);
  });

  test("通れないマスは、道が曲がらずに左右へまっすぐ通り抜けたマスであること", () => {
    const { path } = onceRuleExample;
    const visited = 7;
    const index = path.indexOf(visited);

    const throughCells = [path[index - 1], path[index + 1]];

    expect(throughCells).toEqual([visited - 1, visited + 1]);
  });
});

describe("holeRuleExample", () => {
  test("手がかりは穴に付き、本番の遷移で穴に弾かれること", () => {
    const extensions = pressHints(holeRuleExample);

    expect(extensions).toEqual([{ kind: "rejected", reason: "hole" }]);
  });

  test("通れないマスは、縁の欠けでなく内側の穴であること", () => {
    const hole = getHitofudePuzzleHowToPlayHintCell(holeRuleExample.hints[0]!);

    const surrounded = hitofudePuzzleDirections.every((direction) => {
      const cell = getHitofudePuzzleNeighborCell(
        holeRuleExample.board.size,
        hole,
        direction,
      );
      return cell !== null && !holeRuleExample.board.holes.includes(cell);
    });

    expect(surrounded).toBe(true);
  });
});

describe("allCellsRuleExamples", () => {
  const [allowedExample, disallowedExample] = allCellsRuleExamples;

  test("できる形は、本番の判定で完成していること", () => {
    const solved = isHitofudePuzzleSolved(
      allowedExample.board,
      allowedExample.path,
    );

    expect(solved).toBe(true);
  });

  test("見せない右の列は、どちらの盤面もすべて穴であること", () => {
    const hidden = allCellsRuleExamples.map(({ board, visibleColumns }) =>
      Array.from({ length: board.size }, (_, row) =>
        Array.from(
          { length: board.size - (visibleColumns ?? board.size) },
          (_, offset) =>
            board.holes.includes(
              row * board.size + (visibleColumns ?? board.size) + offset,
            ),
        ),
      )
        .flat()
        .every(Boolean),
    );

    expect(hidden).toEqual([true, true]);
    expect(
      allCellsRuleExamples.map(({ visibleColumns }) => visibleColumns),
    ).toEqual([2, 2]);
  });

  test("できない形は、本番の判定で行き止まりで、1マスを残すこと", () => {
    const status = {
      deadEnd: isHitofudePuzzleDeadEnd(
        disallowedExample.board,
        disallowedExample.path,
      ),
      remaining:
        listHitofudePuzzleOpenCells(disallowedExample.board).length -
        disallowedExample.path.length,
    };

    expect(status).toEqual({ deadEnd: true, remaining: 1 });
  });

  test("どちらも触る前は動かさないので、手がかりを付けないこと", () => {
    const hints = allCellsRuleExamples.map(({ hints }) => hints);

    expect(hints).toEqual([[], []]);
  });
});

/** 触る前の道から、手がかりのマスを本番の指の操作と同じく順に押していった道（道のマスなら戻し、それ以外は延ばす）。 */
function listPressedPaths({
  board,
  path,
  hints,
}: HitofudePuzzleHowToPlayExample): (readonly number[])[] {
  const paths: (readonly number[])[] = [];
  let current = path;
  for (const cell of hints.map(getHitofudePuzzleHowToPlayHintCell)) {
    const state = { path: current };
    if (current.includes(cell)) {
      current = rewindHitofudePuzzle(state, cell).path;
    } else {
      const extension = extendHitofudePuzzle(board, state, cell);
      current = extension.kind === "extended" ? extension.state.path : current;
    }
    paths.push(current);
  }
  return paths;
}

describe("extendOperationExample", () => {
  test("手がかりを順に打つと、3マス延びてから、来た道を1マス戻って縮むこと", () => {
    const paths = listPressedPaths(extendOperationExample);

    expect(paths).toEqual([
      [4, 1],
      [4, 1, 0],
      [4, 1, 0, 3],
      [4, 1, 0],
    ]);
  });
});

describe("rewindOperationExample", () => {
  test("手がかりを順に押すと、道の途中まで縮んでから、前と違う道を引き直して本番の判定で完成すること", () => {
    const paths = listPressedPaths(rewindOperationExample);
    const last = paths.at(-1)!;

    expect(paths[0]).toEqual([0, 1]);
    expect(last.slice(0, 3)).not.toEqual(
      rewindOperationExample.path.slice(0, 3),
    );
    expect(isHitofudePuzzleSolved(rewindOperationExample.board, last)).toBe(
      true,
    );
  });
});
