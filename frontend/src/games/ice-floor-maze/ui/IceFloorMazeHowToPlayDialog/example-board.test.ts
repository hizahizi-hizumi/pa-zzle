import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  applyIceFloorMazeSlide,
  getIceFloorMazeNeighbor,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import {
  createIceFloorMazeExampleBoard,
  describeIceFloorMazeExample,
  findIceFloorMazeExampleHint,
  type IceFloorMazeExampleBoard,
  type IceFloorMazeExampleCaption,
  isIceFloorMazeExampleChanged,
  isIceFloorMazeExampleCleared,
  listIceFloorMazeExampleCaptions,
  slideIceFloorMazeExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/example-board";
import {
  brittleRockRuleExamples,
  coveredGoalRuleExamples,
  floorRuleExample,
  goalRuleExamples,
  type IceFloorMazeHowToPlayExample,
  slideOperationExample,
  slideRuleExample,
  slidingBlockRuleExamples,
  snowRuleExamples,
  thinIceRuleExample,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";

function slideAll(
  example: IceFloorMazeHowToPlayExample,
  directions: readonly IceFloorMazeDirection[],
): IceFloorMazeExampleBoard {
  return directions.reduce(
    slideIceFloorMazeExample,
    createIceFloorMazeExampleBoard(example),
  );
}

function outcome(text: string): IceFloorMazeExampleCaption {
  return { mark: null, text };
}

function allowed(text: string): IceFloorMazeExampleCaption {
  return { mark: "allowed", text };
}

function disallowed(text: string): IceFloorMazeExampleCaption {
  return { mark: "disallowed", text };
}

/**
 * 例ごとに、手がかりの手を順に打ったときの言葉。最初は手を打つ前の言葉で、続いて手を打つごとの言葉。
 * 対で見比べる手のルールは、手の動詞で、試す前はできるかを、試した後は試した手の結果を ✓ / ✕ で言う。
 */
const hintedCaptionCases = [
  [
    "駒は岩の手前で止まる",
    slideRuleExample,
    [outcome("岩の手前で止まる"), outcome("岩の手前で止まる")],
  ],
  [
    "床で止まり、床からまた滑り出す",
    floorRuleExample,
    [outcome("床で止まる"), outcome("床で止まる"), outcome("壁の手前で止まる")],
  ],
  [
    "薄い氷を割り、割れてできた水面の手前で止まる",
    thinIceRuleExample,
    [
      outcome("薄い氷が割れる"),
      outcome("薄い氷が割れる"),
      outcome("水面の手前で止まる"),
    ],
  ],
  [
    "離れた所から滑ってきてもろい岩を崩し、崩れた跡を通り抜ける",
    brittleRockRuleExamples[0],
    [allowed("崩せる"), allowed("崩せた"), outcome("崩れた跡を通り抜ける")],
  ],
  [
    "すぐ隣からはもろい岩を崩せない",
    brittleRockRuleExamples[1],
    [disallowed("崩せない"), disallowed("崩せない")],
  ],
  [
    "雪を押し出し、押し出した雪山へ向けても押し出せない",
    snowRuleExamples[0],
    [allowed("押し出せる"), allowed("押し出せた"), disallowed("押し出せない")],
  ],
  [
    "先に岩がある雪は押し出せず、手前で止まる",
    snowRuleExamples[1],
    [disallowed("押し出せない"), disallowed("押し出せない")],
  ],
  [
    "離れた所から滑ってきて塊を押す",
    slidingBlockRuleExamples[0],
    [allowed("押せる"), allowed("押せた")],
  ],
  [
    "すぐ隣からは塊を押せない",
    slidingBlockRuleExamples[1],
    [disallowed("押せない"), disallowed("押せない")],
  ],
  [
    "雪をゴールへ押し出して雪山を載せると、もうゴールに止まれない",
    coveredGoalRuleExamples[0],
    [outcome("雪山がゴールに載る"), disallowed("ゴールに止まれない")],
  ],
  [
    "塊をゴールへ押して載せると、ゴールに止まれない",
    coveredGoalRuleExamples[1],
    [outcome("塊がゴールに載る"), disallowed("ゴールに止まれない")],
  ],
] as const;

/** 最初の姿から、手がかりの手を順に打った盤面の並び。最初が最初の姿。 */
function listHintedBoards(
  example: IceFloorMazeHowToPlayExample,
): IceFloorMazeExampleBoard[] {
  const boards = [createIceFloorMazeExampleBoard(example)];
  for (const direction of example.hints) {
    boards.push(slideIceFloorMazeExample(boards.at(-1)!, direction));
  }
  return boards;
}

describe("describeIceFloorMazeExample", () => {
  const hintedBoardCases = hintedCaptionCases.map(
    ([name, example, expected]) =>
      [name, listHintedBoards(example), expected] as const,
  );

  test.each(hintedBoardCases)(
    "手がかりの手を順に打つと、その手で起きることを言うこと: %s",
    (_, boards, expected) => {
      const captions = boards.map(describeIceFloorMazeExample);

      expect(captions).toEqual(expected);
    },
  );

  describe("ゴールのルールの例", () => {
    const [stopping, passing] = goalRuleExamples;
    const boards = [
      createIceFloorMazeExampleBoard(stopping),
      slideAll(stopping, ["right"]),
      createIceFloorMazeExampleBoard(passing),
      slideAll(passing, ["right"]),
      slideAll(passing, ["up"]),
    ];

    test("試す前は手がかりの手がゴールで止まるか通り過ぎるかを言い、試した後は完成か通り過ぎたかを言い、ゴールに関わらない手ではその手で起きることを言うこと", () => {
      const captions = boards.map(describeIceFloorMazeExample);

      expect(captions).toEqual([
        { mark: "allowed", text: "ゴールで止まる" },
        { mark: "allowed", text: "完成" },
        { mark: "disallowed", text: "通り過ぎる" },
        { mark: "disallowed", text: "通り過ぎた" },
        outcome("壁の手前で止まる"),
      ]);
    });
  });

  describe("操作の例", () => {
    const board = createIceFloorMazeExampleBoard(slideOperationExample);

    test("言葉を添えないこと", () => {
      const caption = describeIceFloorMazeExample(board);

      expect(caption).toBeNull();
    });
  });
});

describe("listIceFloorMazeExampleCaptions", () => {
  const examples = [
    slideRuleExample,
    ...goalRuleExamples,
    floorRuleExample,
    thinIceRuleExample,
    ...brittleRockRuleExamples,
    ...snowRuleExamples,
    ...slidingBlockRuleExamples,
    ...coveredGoalRuleExamples,
  ];
  const directionSequences: readonly (readonly IceFloorMazeDirection[])[] = [
    ["right"],
    ["right", "right"],
    ["right", "left"],
    ["up", "right", "down", "left"],
    ["down", "right", "up", "left", "left"],
    ["left", "up", "right", "right", "down"],
  ];

  const shownCases = examples.map(
    (example, index) =>
      [
        index,
        example,
        directionSequences.flatMap((directions) =>
          directions.map((__, step) =>
            describeIceFloorMazeExample(
              slideAll(example, directions.slice(0, step + 1)),
            ),
          ),
        ),
      ] as const,
  );

  test.each(shownCases)(
    "どう滑らせても、出る言葉を出しうる言葉に含めること: 例 %i",
    (_, example, shown) => {
      const listed = listIceFloorMazeExampleCaptions(example);

      expect(listed).toEqual(expect.arrayContaining(shown));
    },
  );
});

describe("slideIceFloorMazeExample", () => {
  describe("成立する向きの場合", () => {
    const example = snowRuleExamples[0];
    const before = createIceFloorMazeInitialState(example.board, example.start);
    const slide = slideIceFloorMazePiece(example.board, before, "right");

    test("本番の滑りの関数と同じ状態に移ること", () => {
      const board = slideAll(example, ["right"]);

      expect(slide.status).toBe("slid");
      expect(board.state).toEqual(
        slide.status === "slid" ? applyIceFloorMazeSlide(before, slide) : null,
      );
    });
  });

  describe("1マスも動けない向きの場合", () => {
    const example = brittleRockRuleExamples[1];
    const initial = createIceFloorMazeExampleBoard(example);

    test("盤面を変えずに、動けなかった手として残すこと", () => {
      const board = slideIceFloorMazeExample(initial, "right");

      expect(board.state).toBe(initial.state);
      expect(board.lastInput?.kind).toBe("blocked");
      expect(isIceFloorMazeExampleChanged(board)).toBe(false);
    });
  });

  describe("ゴールで止まった後の場合", () => {
    const cleared = slideAll(goalRuleExamples[0], ["right"]);

    test("受け付けないこと", () => {
      const board = slideIceFloorMazeExample(cleared, "left");

      expect(isIceFloorMazeExampleCleared(cleared)).toBe(true);
      expect(board).toBe(cleared);
    });
  });
});

describe("findIceFloorMazeExampleHint", () => {
  describe("手がかりが2つの手の例", () => {
    const boards = [
      createIceFloorMazeExampleBoard(floorRuleExample),
      slideAll(floorRuleExample, ["right"]),
      slideAll(floorRuleExample, ["right", "right"]),
    ];

    test("手を打つたびに次の向きへ移し、打ち終えたら消すこと", () => {
      const hints = boards.map(findIceFloorMazeExampleHint);

      expect(hints).toEqual(["right", "right", null]);
    });
  });

  describe("手がかりと違う手を打った場合", () => {
    const deviated = slideAll(floorRuleExample, ["down"]);
    const returned = slideAll(floorRuleExample, ["right", "left"]);

    test("消し、手がかりの途中の姿に戻ったらまた出すこと", () => {
      const hints = [deviated, returned].map(findIceFloorMazeExampleHint);

      expect(hints).toEqual([null, "right"]);
    });
  });

  describe("動けなかった手の後の場合", () => {
    const blocked = slideAll(brittleRockRuleExamples[1], ["right"]);
    const moved = slideAll(brittleRockRuleExamples[1], ["right", "left"]);

    test("盤面が変わるまで出さないこと", () => {
      const hints = [blocked, moved].map(findIceFloorMazeExampleHint);

      expect(hints).toEqual([null, null]);
    });
  });

  describe("ゴールで止まった後の場合", () => {
    const cleared = slideAll(goalRuleExamples[0], ["right"]);

    test("出さないこと", () => {
      const hint = findIceFloorMazeExampleHint(cleared);

      expect(hint).toBeNull();
    });
  });
});

describe("手がかりの指の置き場所", () => {
  const examples = [
    slideRuleExample,
    ...goalRuleExamples,
    floorRuleExample,
    thinIceRuleExample,
    ...brittleRockRuleExamples,
    ...snowRuleExamples,
    ...slidingBlockRuleExamples,
    ...coveredGoalRuleExamples,
    slideOperationExample,
  ];
  /** 指を置く角の縦と横の向き。SwipeHint と同じく、矢印と反対の側の角。 */
  const pointerCornerSides = {
    up: ["down", "right"],
    right: ["down", "left"],
    down: ["up", "right"],
    left: ["down", "right"],
  } as const satisfies Record<
    IceFloorMazeDirection,
    readonly [IceFloorMazeDirection, IceFloorMazeDirection]
  >;
  const hintedStates = examples.flatMap((example, index) =>
    example.hints.map((direction, step) => {
      const board = slideAll(example, example.hints.slice(0, step));
      const [vertical, horizontal] = pointerCornerSides[direction];
      const { position } = board.state;
      const sideCells = [vertical, horizontal].map((side) =>
        getIceFloorMazeNeighbor(example.board, position, side),
      );
      const verticalCell = sideCells[0] ?? null;
      const diagonal =
        verticalCell === null
          ? null
          : getIceFloorMazeNeighbor(example.board, verticalCell, horizontal);
      return [
        `${index}-${step}`,
        example,
        board.state,
        [...sideCells, diagonal].filter((cell) => cell !== null),
      ] as const;
    }),
  );

  test.each(hintedStates)(
    "外の角に半分を出した指がかかるマスに、岩・雪・塊・ゴールなどの物が無いこと: 例 %s",
    (_, example, state, cornerCells) => {
      const things = cornerCells.filter(
        (cell) =>
          state.cells[cell] !== "ice" ||
          state.blocks.includes(cell) ||
          cell === example.goal,
      );

      expect(things).toEqual([]);
    },
  );
});
