import {
  listWaterSortPourRejections,
  selectWaterSortBottle,
} from "@/games/water-sort/puzzle/bottle-selection";
import { applyWaterSortMove } from "@/games/water-sort/puzzle/rules";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import {
  completeRuleExamples,
  pourDestinationExample,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import {
  createWaterSortExampleBoard,
  getWaterSortExampleHintBottleIndex,
  judgeWaterSortExampleDestinations,
  judgeWaterSortExampleSelection,
  listWaterSortExampleDestinationRejections,
  tapWaterSortExampleBottle,
  type WaterSortExampleBoard,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample/example-board";

/** 例を、`taps` のボトル（0から）を順に押した姿にする。 */
function tapAll(
  board: WaterSortExampleBoard,
  taps: readonly number[],
): WaterSortExampleBoard {
  return taps.reduce(
    (current, bottleIndex) =>
      tapWaterSortExampleBottle(current, bottleIndex).board,
    board,
  );
}

/** 本番の盤面で、`sourceBottleIndex` を選んだまま各ボトルを押したときに注ぐか。選んだボトル自身は `null`。 */
function answerByProduction(
  bottles: WaterSortState,
  sourceBottleIndex: number,
): (boolean | null)[] {
  return bottles.map((_, bottleIndex) =>
    bottleIndex === sourceBottleIndex
      ? null
      : selectWaterSortBottle(bottles, sourceBottleIndex, bottleIndex).type ===
        "pour",
  );
}

describe("createWaterSortExampleBoard", () => {
  describe("どこに注げるかの例の場合", () => {
    const { bottles, selectedBottleIndex } = pourDestinationExample;
    const productionSelection = selectWaterSortBottle(
      bottles,
      null,
      selectedBottleIndex,
    ).type;

    test("本番でも選べる左のボトルを、注ぐボトルに選んだ姿から始めること", () => {
      const board = createWaterSortExampleBoard(pourDestinationExample);

      expect(board.sourceBottleIndex).toBe(selectedBottleIndex);
      expect(productionSelection).toBe("source-selected");
    });
  });
});

describe("judgeWaterSortExampleDestinations", () => {
  const board = createWaterSortExampleBoard(pourDestinationExample);
  const pouredIntoEmpty = applyWaterSortMove(pourDestinationExample.bottles, {
    sourceBottleIndex: 0,
    destinationBottleIndex: 3,
  });

  const cases = [
    {
      title: "最初の姿では、選んでいる左のボトルから各ボトルへ注げるかを返す",
      taps: [],
      bottles: pourDestinationExample.bottles,
      sourceBottleIndex: 0,
      expected: [null, true, false, true, false],
    },
    {
      title: "注げないボトルを押して弾かれても、選んだままの答えを返す",
      taps: [2],
      bottles: pourDestinationExample.bottles,
      sourceBottleIndex: 0,
      expected: [null, true, false, true, false],
    },
    {
      title: "選び直したら、選んだボトルからの答えに替える",
      taps: [0, 1],
      bottles: pourDestinationExample.bottles,
      sourceBottleIndex: 1,
      expected: [true, null, false, true, false],
    },
    {
      title: "注いだ後に選んだら、注いだ後の盤面での答えにする",
      taps: [3, 1],
      bottles: pouredIntoEmpty ?? [],
      sourceBottleIndex: 1,
      expected: [false, null, false, true, false],
    },
  ] as const;

  test.each(cases)(
    "$titleこと",
    ({ taps, bottles, sourceBottleIndex, expected }) => {
      const answers = judgeWaterSortExampleDestinations(tapAll(board, taps));

      expect(answers).toEqual(answerByProduction(bottles, sourceBottleIndex));
      expect(answers).toEqual(expected);
    },
  );

  const unselectedCases = [
    ["選ぶのをやめたら", [0]],
    ["注いだら", [1]],
  ] as const;

  test.each(unselectedCases)("%s、答えを返さないこと", (_, taps) => {
    const answers = judgeWaterSortExampleDestinations(tapAll(board, taps));

    expect(answers).toBeNull();
  });
});

describe("tapWaterSortExampleBottle", () => {
  describe("どこに注げるかの例で、左のボトルを選んだまま候補を押した場合", () => {
    const { bottles } = pourDestinationExample;
    const selected = createWaterSortExampleBoard(pourDestinationExample);
    const cases = [1, 2, 3, 4].map((destination) => {
      const selection = selectWaterSortBottle(bottles, 0, destination);
      return [
        destination,
        selection.type,
        selection.type === "pour"
          ? applyWaterSortMove(bottles, selection.move)
          : bottles,
      ] as const;
    });

    test.each(cases)(
      "0から数えて %i 本目の候補を押すと、本番と同じ受け付け（%s）と盤面になること",
      (destination, expectedType, expectedBottles) => {
        const { board, selection } = tapWaterSortExampleBottle(
          selected,
          destination,
        );

        expect(selection.type).toBe(expectedType);
        expect(board.bottles).toEqual(expectedBottles);
        expect(board.sourceBottleIndex).toBe(
          expectedType === "pour" ? null : 0,
        );
      },
    );
  });
});

describe("getWaterSortExampleHintBottleIndex", () => {
  describe("何も選ばずに始める例の場合", () => {
    // 2本目はいっぱいなので、手がかりの注ぎ先を押すと弾かれる。
    const example = { bottles: [[1, 0], [2, 0, 0, 0], []] };
    const board = createWaterSortExampleBoard(example);

    const cases = [
      ["最初の形では、注ぐボトルに付ける", [], 0],
      ["注ぐボトルを選んだら、注ぎ先に付ける", [0], 1],
      ["手がかりの注ぎ先を押して弾かれたら、消す", [0, 1], null],
      ["手がかりの無い空のボトルを押して弾かれても、消す", [2], null],
      [
        "空のボトルで弾かれた後に注ぐボトルを選んだら、注ぎ先に付ける",
        [2, 0],
        1,
      ],
      ["弾かれた後に選び直したら、注ぎ先に戻す", [0, 1, 0, 0], 1],
      ["注いで形が変わったら、付けない", [0, 2], null],
    ] as const;

    test.each(cases)("%sこと", (_, taps, expected) => {
      const hinted = getWaterSortExampleHintBottleIndex(
        tapAll(board, taps),
        example,
      );

      expect(hinted).toBe(expected);
    });
  });

  describe("どこに注げるかの例の場合", () => {
    const board = createWaterSortExampleBoard(pourDestinationExample);

    const cases = [
      ["最初の姿では、✓ の候補に付ける", [], 1],
      ["✕ の候補を押して弾かれたら、消す", [2], null],
      ["✕ の候補で弾かれた後に選ぶのをやめたら、注ぐボトルに付ける", [2, 0], 0],
      ["✕ の候補で弾かれた後に選び直したら、✓ の候補に戻す", [2, 0, 0], 1],
      ["選ぶのをやめたら、注ぐボトルに付ける", [0], 0],
      ["選び直したら、✓ の候補に戻す", [0, 0], 1],
      ["注いで形が変わったら、付けない", [1], null],
    ] as const;

    test.each(cases)("%sこと", (_, taps, expected) => {
      const hinted = getWaterSortExampleHintBottleIndex(
        tapAll(board, taps),
        pourDestinationExample,
      );

      expect(hinted).toBe(expected);
    });
  });
});

describe("listWaterSortExampleDestinationRejections", () => {
  const { bottles } = pourDestinationExample;
  const board = createWaterSortExampleBoard(pourDestinationExample);

  test("押す前から、選んでいる左のボトルから各ボトルへ注げないわけを、本番の判定で返すこと", () => {
    const rejections = listWaterSortExampleDestinationRejections(board);

    expect(rejections).toEqual(
      bottles.map((_, destination) =>
        destination === 0
          ? null
          : listWaterSortPourRejections(bottles, {
              sourceBottleIndex: 0,
              destinationBottleIndex: destination,
            }),
      ),
    );
    expect(rejections).toEqual([null, [], ["different-color"], [], ["full"]]);
  });

  test("選び直したら、選んだボトルから注げないわけに替えること", () => {
    const rejections = listWaterSortExampleDestinationRejections(
      tapAll(board, [0, 2]),
    );

    expect(rejections).toEqual([
      ["different-color"],
      ["different-color"],
      null,
      [],
      ["full", "different-color"],
    ]);
  });

  test("選ぶのをやめたら、返さないこと", () => {
    const rejections = listWaterSortExampleDestinationRejections(
      tapAll(board, [0]),
    );

    expect(rejections).toBeNull();
  });
});

describe("judgeWaterSortExampleSelection", () => {
  const selectable = createWaterSortExampleBoard(completeRuleExamples[0]);
  const complete = createWaterSortExampleBoard(completeRuleExamples[1]);
  const selected = createWaterSortExampleBoard(pourDestinationExample);

  const cases = [
    [
      "試す前は、左のボトルを選べるかを判定する",
      complete,
      [],
      { allowed: false, rejections: ["complete"] },
    ],
    [
      "左のボトルを選んだら、選べたことを示す",
      selectable,
      [0],
      { allowed: true, rejections: [] },
    ],
    [
      "注いだ後も、選べたことを示す",
      selectable,
      [0, 1],
      { allowed: true, rejections: [] },
    ],
    [
      "空のボトルを押して弾かれたら、選べないわけを示す",
      selectable,
      [1],
      { allowed: false, rejections: ["empty"] },
    ],
    [
      "選んだまま注げないボトルを押して弾かれても、選べたことを示す",
      selected,
      [2],
      { allowed: true, rejections: [] },
    ],
    [
      "注いだ後に、選べないボトルを押して弾かれたら、選べないわけを示す",
      selectable,
      [0, 1, 1],
      { allowed: false, rejections: ["no-destination"] },
    ],
  ] as const;

  test.each(cases)("%sこと", (_, board, taps, expected) => {
    const verdict = judgeWaterSortExampleSelection(tapAll(board, taps));

    expect(verdict).toEqual(expected);
  });
});
