import { describe, expect, test } from "vitest";
import { orderFromSelected } from "@/views/PuzzleSelectionView/carousel-order";

describe("orderFromSelected", () => {
  const items = ["a", "b", "c", "d", "e", "f"];

  test("選んでいるものから、両隣、その隣と、輪の上で近い順に並べること", () => {
    const ordered = orderFromSelected(items, 0);

    expect(ordered).toEqual(["a", "b", "f", "c", "e", "d"]);
  });
});
