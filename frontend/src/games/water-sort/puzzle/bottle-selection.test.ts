import {
  listWaterSortPourRejections,
  listWaterSortSourceRejections,
  selectWaterSortBottle,
} from "@/games/water-sort/puzzle/bottle-selection";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";

describe("selectWaterSortBottle", () => {
  const state: WaterSortState = [
    [0, 1],
    [2, 1],
    [0, 2],
  ];

  const cases = [
    [
      "選んでいない盤面で選べるボトルを押すと、注ぐボトルに選ぶ",
      null,
      0,
      { type: "source-selected", bottleIndex: 0 },
    ],
    [
      "選んでいない盤面で注げる先が無いボトルを押すと、受け付けない",
      null,
      2,
      { type: "invalid", bottleIndex: 2 },
    ],
    [
      "選んだボトルをもう一度押すと、選ぶのをやめる",
      0,
      0,
      { type: "source-deselected", bottleIndex: 0 },
    ],
    [
      "注げる注ぎ先を押すと、注ぐ",
      0,
      1,
      {
        type: "pour",
        move: { sourceBottleIndex: 0, destinationBottleIndex: 1 },
      },
    ],
    [
      "上の色が違う注ぎ先を押すと、受け付けない",
      0,
      2,
      { type: "invalid", bottleIndex: 2 },
    ],
  ] as const;

  test.each(cases)("%sこと", (_, sourceBottleIndex, bottleIndex, expected) => {
    const selection = selectWaterSortBottle(
      state,
      sourceBottleIndex,
      bottleIndex,
    );

    expect(selection).toEqual(expected);
  });
});

describe("listWaterSortSourceRejections", () => {
  const cases: [string, WaterSortState, number, string[]][] = [
    ["注げる先があるボトル", [[0, 1], [1]], 0, []],
    ["空のボトル", [[0, 1], []], 1, ["empty"]],
    ["1色で満杯のボトル", [[0, 0, 0, 0], []], 0, ["complete"]],
    ["注げる先が無いボトル", [[0, 1], [0]], 0, ["no-destination"]],
  ];

  test.each(cases)(
    "%s を選べないわけを返すこと",
    (_, state, bottleIndex, expected) => {
      const rejections = listWaterSortSourceRejections(state, bottleIndex);

      expect(rejections).toEqual(expected);
    },
  );
});

describe("listWaterSortPourRejections", () => {
  const cases: [string, WaterSortState, string[]][] = [
    ["上が同じ色で空きのある注ぎ先", [[0, 1], [1]], []],
    ["空の注ぎ先", [[0, 1], []], []],
    ["上の色が違う注ぎ先", [[0, 1], [0]], ["different-color"]],
    [
      "満杯で上が同じ色の注ぎ先",
      [
        [0, 1],
        [1, 1, 1, 1],
      ],
      ["full"],
    ],
    [
      "満杯で上の色も違う注ぎ先",
      [
        [0, 1],
        [0, 0, 0, 0],
      ],
      ["full", "different-color"],
    ],
    ["空のボトルから注ぐ手", [[], [0]], ["empty"]],
  ];

  test.each(cases)("%s へ注げないわけを返すこと", (_, state, expected) => {
    const rejections = listWaterSortPourRejections(state, {
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
    });

    expect(rejections).toEqual(expected);
  });
});
