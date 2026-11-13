import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  isSolvableSlidePuzzleBoard,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import {
  _private,
  findSlidePuzzleTutorialHintTile,
  getSlidePuzzleTutorialProgressRatio,
  getSlidePuzzleTutorialStepTile,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  type SlidePuzzleTutorialSituation,
  slidePuzzleTutorial,
} from "@/games/slide-puzzle/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialProgress,
} from "@/games/tutorial";

const { startBoard, goalBoard, guidedTiles, guidedBoards } = _private;

type Progress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

const { steps } = slidePuzzleTutorial;

const topRowTiles = [1, 2, 3] as const;
const leftColumnTiles = [4, 7] as const;

/** 上の行が揃った、手を離した後の盤面。 */
const releasedBoard = guidedBoards.at(-1) ?? startBoard;

function toBoardKey(board: SlidePuzzleBoard): string {
  return board.join(",");
}

function isAtGoal(board: SlidePuzzleBoard, tile: SlidePuzzleTile): boolean {
  return board[tile - 1] === tile;
}

/** 空白の隣のタイルを1枚スライドさせた盤面と、そのタイル。`fixedTiles` は動かさない。 */
function listSingleSlides(
  board: SlidePuzzleBoard,
  fixedTiles: readonly SlidePuzzleTile[],
): { tile: SlidePuzzleTile; board: SlidePuzzleBoard }[] {
  return listSlidePuzzleSingleMoves(board).flatMap((cellIndex) => {
    const tile = board[cellIndex];
    const slide = getSlidePuzzleSlide(board, cellIndex);
    return tile === undefined || !slide || fixedTiles.includes(tile)
      ? []
      : [{ tile, board: applySlidePuzzleSlide(board, slide) }];
  });
}

/**
 * `start` から `fixedTiles` を動かさずに、`isTarget` の盤面へ1枚ずつ最短でスライドさせる道すべて。道はスライドさせたタイルの並び。
 * 届かなければ空。3×3 の盤面なので、届く盤面をすべてたどる。
 */
function listShortestPaths(
  start: SlidePuzzleBoard,
  isTarget: (board: SlidePuzzleBoard) => boolean,
  fixedTiles: readonly SlidePuzzleTile[],
): SlidePuzzleTile[][] {
  const reachable: SlidePuzzleBoard[] = [start];
  const seen = new Set([toBoardKey(start)]);
  for (let index = 0; index < reachable.length; index += 1) {
    for (const next of listSingleSlides(reachable[index] ?? [], fixedTiles)) {
      const key = toBoardKey(next.board);
      if (!seen.has(key)) {
        seen.add(key);
        reachable.push(next.board);
      }
    }
  }
  const distanceByKey = new Map<string, number>();
  let frontier = reachable.filter(isTarget);
  for (const board of frontier) {
    distanceByKey.set(toBoardKey(board), 0);
  }
  for (let distance = 1; frontier.length > 0; distance += 1) {
    const next: SlidePuzzleBoard[] = [];
    for (const board of frontier) {
      for (const previous of listSingleSlides(board, fixedTiles)) {
        const key = toBoardKey(previous.board);
        if (!distanceByKey.has(key)) {
          distanceByKey.set(key, distance);
          next.push(previous.board);
        }
      }
    }
    frontier = next;
  }

  function follow(board: SlidePuzzleBoard): SlidePuzzleTile[][] {
    const distance = distanceByKey.get(toBoardKey(board));
    if (distance === undefined) {
      return [];
    }
    if (distance === 0) {
      return [[]];
    }
    return listSingleSlides(board, fixedTiles)
      .filter(
        (next) => distanceByKey.get(toBoardKey(next.board)) === distance - 1,
      )
      .flatMap((next) =>
        follow(next.board).map((rest) => [next.tile, ...rest]),
      );
  }
  return follow(start);
}

function hasTopRow(board: SlidePuzzleBoard): boolean {
  return topRowTiles.every((tile) => isAtGoal(board, tile));
}

function hasLeftColumn(board: SlidePuzzleBoard): boolean {
  return (
    hasTopRow(board) && leftColumnTiles.every((tile) => isAtGoal(board, tile))
  );
}

function endsWithPair(
  path: readonly SlidePuzzleTile[],
  pair: readonly [SlidePuzzleTile, SlidePuzzleTile],
): boolean {
  return [...path.slice(-2)].sort().join(",") === [...pair].sort().join(",");
}

function isInLineWithBlank(board: SlidePuzzleBoard, tile: SlidePuzzleTile) {
  return getSlidePuzzleSlide(board, board.indexOf(tile)) !== null;
}

function boardState(board: SlidePuzzleBoard): SlidePuzzleTutorialBoardState {
  return { ...slidePuzzleTutorial.start(), board };
}

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(slidePuzzleTutorial));
}

function tap(progress: Progress, tile: SlidePuzzleTile): Progress {
  return performTutorialAction(slidePuzzleTutorial, progress, {
    cellIndex: progress.boardState.board.indexOf(tile),
  });
}

function tapAll(progress: Progress, tiles: readonly SlidePuzzleTile[]) {
  return tiles.reduce(tap, progress);
}

function listMessages(): TutorialMessage[] {
  const violation = slidePuzzleTutorial.describeViolation(
    { step: null, earnedRuleIds: ["line", "pair"] },
    {
      ...boardState(releasedBoard),
      lastMove: { type: "rejected", tile: 8, cellIndex: 6 },
    },
  );
  return [
    ...steps.map((step) => step.message),
    slidePuzzleTutorial.freePlay,
    slidePuzzleTutorial.completion.home,
    slidePuzzleTutorial.completion.play,
    violation,
    { headline: slidePuzzleTutorial.intro.purpose, detail: null },
    { headline: slidePuzzleTutorial.intro.goalCaption, detail: null },
  ];
}

describe("盤面", () => {
  test("始めの盤面が、ゴールへ届く 3×3 の盤面であること", () => {
    const solvable = isSolvableSlidePuzzleBoard(startBoard);

    expect(solvable).toBe(true);
    expect(isSlidePuzzleSolved(goalBoard)).toBe(true);
  });

  test("手を引く道が、空白の隣のタイルを1枚ずつスライドさせた盤面の並びで、上の行が揃って終わること", () => {
    const lastBoard = guidedBoards.at(-1) ?? startBoard;

    expect(guidedBoards).toHaveLength(guidedTiles.length + 1);
    expect(hasTopRow(lastBoard)).toBe(true);
  });

  test("手順が手を引く道を隙間なく区切り、道の終わりで手を離すこと", () => {
    const ranges = steps.map((step) => [
      step.startMoveIndex,
      step.endMoveIndex,
    ]);

    expect(ranges[0]?.[0]).toBe(0);
    for (const [index, [start]] of ranges.entries()) {
      expect(start).toBe(index === 0 ? 0 : ranges[index - 1]?.[1]);
    }
    expect(ranges.at(-1)?.[1]).toBe(guidedTiles.length);
  });
});

describe("手を引く間の場合", () => {
  const [operationStep, lineStep, pairStep, pairFinishStep] = steps;

  test("操作を教える手が、空白の隣のタイルを、ゴールでそのタイルがある場所へスライドさせること", () => {
    const tile = guidedTiles[0] ?? 0;
    const after = guidedBoards[1] ?? [];

    expect(operationStep?.introducedRuleId).toBeNull();
    expect(after.indexOf(tile)).toBe(goalBoard.indexOf(tile));
  });

  test("行・列のルールを示す手順で、印のタイルを考えずに1回押すと、空白と同じ行・列にないのでルールの違反になること", () => {
    const board = guidedBoards[lineStep?.startMoveIndex ?? 0] ?? [];
    const lure = lineStep?.lureTile ?? 0;

    const inLine = isInLineWithBlank(board, lure);

    expect(lineStep?.introducedRuleId).toBe("line");
    expect(inLine).toBe(false);
  });

  test("行・列のルールを示す手順の手が、空白を印のタイルと同じ行へ動かしてから、印のタイルを自分の場所へ入れる手であること", () => {
    const start = lineStep?.startMoveIndex ?? 0;
    const lure = lineStep?.lureTile ?? 0;
    const beforeLastMove = guidedBoards[start + 1] ?? [];
    const after = guidedBoards[lineStep?.endMoveIndex ?? 0] ?? [];

    const inLine = isInLineWithBlank(beforeLastMove, lure);

    expect(guidedTiles.slice(start + 1, lineStep?.endMoveIndex)).toEqual([
      lure,
    ]);
    expect(inLine).toBe(true);
    expect(isAtGoal(after, lure)).toBe(true);
  });

  test("行・列のルールを示す手順の手が、1を崩さずに2を自分の場所へ入れる最短の道の1通りであること", () => {
    const start = guidedBoards[lineStep?.startMoveIndex ?? 0] ?? [];

    const paths = listShortestPaths(start, (board) => isAtGoal(board, 2), [1]);

    expect(paths).toEqual([
      guidedTiles.slice(lineStep?.startMoveIndex, lineStep?.endMoveIndex),
    ]);
  });

  describe("組にして入れる読みの手順", () => {
    const start = guidedBoards[pairStep?.startMoveIndex ?? 0] ?? [];
    const guidedReading = guidedTiles.slice(
      pairStep?.startMoveIndex,
      pairFinishStep?.endMoveIndex,
    );

    test("1と2が入っていて、上の行を崩さずには3が入らない盤面から始めること", () => {
      const pathsKeepingTwo = listShortestPaths(start, hasTopRow, [1, 2]);

      expect(isAtGoal(start, 1)).toBe(true);
      expect(isAtGoal(start, 2)).toBe(true);
      expect(pathsKeepingTwo).toEqual([]);
    });

    test("1を崩さずに上の行を揃える最短の道が1通りで、手を引く道と同じく、最後に2と3を続けて入れること", () => {
      const paths = listShortestPaths(start, hasTopRow, [1]);

      expect(paths).toEqual([guidedReading]);
      expect(endsWithPair(guidedReading, [2, 3])).toBe(true);
      expect(pairStep?.introducedRuleId).toBe("pair");
    });

    test("2と3を組に並べたところで、空白を回して入れる手順に替わること", () => {
      const arranged = guidedBoards[pairStep?.endMoveIndex ?? 0] ?? [];

      expect(arranged.indexOf(2)).toBe(goalBoard.indexOf(3));
      expect(arranged.indexOf(3)).toBe(goalBoard.indexOf(3) + 3);
    });

    test("自分で探させる手順の始まりに、スライドできるタイルが2枚以上あること", () => {
      const choices = listSingleSlides(start, [1]);

      expect(pairStep?.cue).toBe("search");
      expect(choices.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("手を離した後の場合", () => {
  describe("スライドの戻し方", () => {
    const slides = listSingleSlides(releasedBoard, []);

    test("どのスライドも、動いたタイルをもう一度タップすると元の盤面へ戻るので、どう進めても手を離した盤面から完成へ届くこと", () => {
      const restored = slides.map(({ tile, board }) => {
        const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
        return slide ? applySlidePuzzleSlide(board, slide) : board;
      });
      const paths = listShortestPaths(
        releasedBoard,
        isSlidePuzzleSolved,
        topRowTiles,
      );

      expect(restored).toEqual(slides.map(() => releasedBoard));
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  test("4は入っているが、4を崩さずには7が入らない、組にして入れる読みがもう一度要る盤面であること", () => {
    const pathsKeepingFour = listShortestPaths(releasedBoard, hasLeftColumn, [
      ...topRowTiles,
      4,
    ]);
    const paths = listShortestPaths(releasedBoard, hasLeftColumn, topRowTiles);

    expect(isAtGoal(releasedBoard, 4)).toBe(true);
    expect(isAtGoal(releasedBoard, 7)).toBe(false);
    expect(pathsKeepingFour).toEqual([]);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => endsWithPair(path, [4, 7]))).toBe(true);
  });
});

describe("slidePuzzleTutorial.perform", () => {
  describe("操作を教える手順の場合", () => {
    const progress = startPlaying();

    test("印のタイルをタップすると、スライドして次の手順へ進み、行・列のルールを伝えること", () => {
      const next = tap(progress, guidedTiles[0] ?? 0);

      expect(next.stepIndex).toBe(1);
      expect(next.earnedRuleIds).toEqual(["line"]);
    });

    test("空白の隣でも手順に無いタイルや、空白と同じ行・列にないタイルを押しても、何も起きないこと", () => {
      const results = [8, 6].map((tile) => tap(progress, tile));

      expect(results).toEqual([progress, progress]);
    });
  });

  describe("行・列のルールを示す手順の場合", () => {
    const progress = tap(startPlaying(), guidedTiles[0] ?? 0);

    test("空白と同じ行・列にない印のタイルをタップすると、ルールに合わない手として返し、盤面を変えないこと", () => {
      const next = tap(progress, 2);

      expect(next.violated).toBe(true);
      expect(next.boardState.board).toEqual(progress.boardState.board);
      expect(next.boardState.lastMove).toEqual({
        type: "rejected",
        tile: 2,
        cellIndex: progress.boardState.board.indexOf(2),
      });
    });

    test("空白と同じ行・列でも、手を引く道に無いタイルは、スライドさせないこと", () => {
      const next = tap(progress, 5);

      expect(next).toBe(progress);
    });

    test("空白を動かしてから印のタイルをタップすると、自分の場所へ入れて次の手順へ進むこと", () => {
      const next = tapAll(progress, [2, 7, 2]);

      expect(next.stepIndex).toBe(2);
      expect(isAtGoal(next.boardState.board, 2)).toBe(true);
      expect(next.earnedRuleIds).toEqual(["line", "pair"]);
    });
  });

  describe("組にして入れる読みの手順の場合", () => {
    const progress = tapAll(startPlaying(), guidedTiles.slice(0, 7));

    test("離れたタイルをタップして手を引く道の2手分をまとめて進めても、道に沿っていれば受け付けること", () => {
      const next = tapAll(progress, [6, 7]);

      expect(next.boardState.board).toEqual(guidedBoards[10]);
      expect(next.boardState.guidedMoveIndex).toBe(10);
    });

    test("手を引く道を最後まで進めると、上の行が揃って手を離すこと", () => {
      const next = tapAll(progress, guidedTiles.slice(7));
      const situation = getTutorialSituation(slidePuzzleTutorial, next);

      expect(situation.step).toBeNull();
      expect(next.boardState.board).toEqual(releasedBoard);
    });
  });

  describe("手を離した後の場合", () => {
    const progress = tapAll(startPlaying(), guidedTiles);

    test("本番と同じく、空白と同じ行・列の離れたタイルは、間のタイルとまとめてスライドすること", () => {
      const next = tap(progress, 4);

      expect(next.boardState.board).toEqual([1, 2, 3, 0, 4, 7, 8, 5, 6]);
    });

    test("空白と同じ行・列にないタイルは、ルールに合わない手として返すこと", () => {
      const next = tap(progress, 8);

      expect(next.violated).toBe(true);
      expect(next.boardState.board).toEqual(progress.boardState.board);
    });
  });
});

describe("getSlidePuzzleTutorialStepTile", () => {
  const lineStepProgress = tap(startPlaying(), guidedTiles[0] ?? 0);
  const violated = tap(lineStepProgress, 2);

  function getStepTile(progress: Progress): SlidePuzzleTile | null {
    return getSlidePuzzleTutorialStepTile(
      getTutorialSituation(slidePuzzleTutorial, progress),
      progress.boardState,
    );
  }

  test("行・列のルールを示す手順では、違反を見せるまで印のタイルを、見せた後は空白を動かすタイルを返すこと", () => {
    const before = getStepTile(lineStepProgress);
    const after = getStepTile(violated);
    const fixed = getStepTile(tap(violated, 7));

    expect(before).toBe(2);
    expect(after).toBe(7);
    expect(fixed).toBe(2);
  });

  test("空白を回して入れる手順では、道の2手を1回でまとめて進められる離れたタイルに印を付けること", () => {
    const progress = tapAll(startPlaying(), guidedTiles.slice(0, 8));

    const tile = getStepTile(progress);
    const next = tap(progress, tile ?? 0);

    expect(tile).toBe(7);
    expect(next.boardState.board).toEqual(guidedBoards[10]);
  });

  test("手を離した後は印を付けないこと", () => {
    const tile = getStepTile(tapAll(startPlaying(), guidedTiles));

    expect(tile).toBeNull();
  });
});

describe("findSlidePuzzleTutorialHintTile", () => {
  function followHints(board: SlidePuzzleBoard): SlidePuzzleTile[] {
    const tiles: SlidePuzzleTile[] = [];
    let current = board;
    for (
      let tile = findSlidePuzzleTutorialHintTile(boardState(current));
      tile !== null;
      tile = findSlidePuzzleTutorialHintTile(boardState(current))
    ) {
      tiles.push(tile);
      const slide = getSlidePuzzleSlide(current, current.indexOf(tile));
      if (!slide || tiles.length > 40) {
        break;
      }
      current = applySlidePuzzleSlide(current, slide);
    }
    return tiles;
  }

  test("手を離した後の盤面から手がかりをたどると、上の行を崩さずに最短の13手で完成すること", () => {
    const tiles = followHints(releasedBoard);

    expect(tiles).toHaveLength(13);
    expect(tiles.some((tile) => topRowTiles.includes(tile as 1 | 2 | 3))).toBe(
      false,
    );
  });

  test("完成した盤面では、手がかりを示さないこと", () => {
    const tile = findSlidePuzzleTutorialHintTile(boardState(goalBoard));

    expect(tile).toBeNull();
  });
});

describe("getSlidePuzzleTutorialProgressRatio", () => {
  const solvingTiles = followSolution();

  function followSolution(): SlidePuzzleTile[] {
    const [path = []] = listShortestPaths(
      releasedBoard,
      isSlidePuzzleSolved,
      topRowTiles,
    );
    return [...guidedTiles, ...path];
  }

  test("始めは0で、手順どおりに解く間に後戻りせず、解き終える直前は1未満で、解き終えると1になること", () => {
    const ratios = solvingTiles.reduce<{
      progress: Progress;
      ratios: number[];
    }>(
      ({ progress, ratios }, tile) => {
        const next = tap(progress, tile);
        return {
          progress: next,
          ratios: [
            ...ratios,
            getSlidePuzzleTutorialProgressRatio(
              next.stepIndex,
              next.boardState,
            ),
          ],
        };
      },
      { progress: startPlaying(), ratios: [] },
    ).ratios;

    expect(
      getSlidePuzzleTutorialProgressRatio(0, slidePuzzleTutorial.start()),
    ).toBe(0);
    for (const [index, ratio] of ratios.entries()) {
      expect(ratio).toBeGreaterThanOrEqual(ratios[index - 1] ?? 0);
    }
    expect(ratios.at(-2)).toBeLessThan(1);
    expect(ratios.at(-1)).toBe(1);
  });
});

describe("slidePuzzleTutorial.describeViolation", () => {
  const situation: SlidePuzzleTutorialSituation = {
    step: null,
    earnedRuleIds: ["line"],
  };
  const state: SlidePuzzleTutorialBoardState = {
    ...boardState(releasedBoard),
    lastMove: { type: "rejected", tile: 8, cellIndex: 6 },
  };

  test("押したタイルが空白と同じ行にも列にもないことと、空白を先に動かすことを言うこと", () => {
    const message = slidePuzzleTutorial.describeViolation(situation, state);

    expect(message).toEqual({
      headline: "8は空白と同じ行にも\n列にもありません",
      detail: "空白を8と同じ行か列へ動かします",
    });
  });
});

describe("一言", () => {
  const messages = listMessages();

  test("どの一言も、全角45字まで3行までで、読点と句点を打たないこと", () => {
    const lines = messages.flatMap(({ headline, detail }) =>
      [headline, detail].flatMap((text) => (text === null ? [] : [text])),
    );

    for (const text of lines) {
      expect(text.split("\n").length).toBeLessThanOrEqual(3);
      expect(text.replaceAll("\n", "").length).toBeLessThanOrEqual(45);
      expect(text).not.toMatch(/[、。]/);
    }
  });
});
