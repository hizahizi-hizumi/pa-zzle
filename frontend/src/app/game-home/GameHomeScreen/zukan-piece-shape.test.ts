import { describe, expect, test } from "vitest";

import { findZukanPieceShape } from "@/app/game-home/GameHomeScreen/zukan-piece-shape";

type Edges = { top: number; right: number; bottom: number; left: number };

function findEdges(
  position: number,
  matchedCount: number,
  problemCount: number,
  columnCount: number,
): Edges {
  const [top = 0, right = 0, bottom = 0, left = 0] = findZukanPieceShape(
    position,
    matchedCount,
    problemCount,
    columnCount,
  )
    .split(",")
    .map(Number);
  return { top, right, bottom, left };
}

describe("findZukanPieceShape", () => {
  const problemCount = 47;
  const columnCount = 9;
  const positions = Array.from({ length: problemCount }, (_, i) => i);

  describe("左右に隣り合うピース", () => {
    const pairs = positions.filter(
      (position) =>
        position % columnCount < columnCount - 1 && position + 1 < problemCount,
    );

    test.each(pairs)(
      "左のピースの右の辺が凸か凹で、右のピースの左の辺がその逆であること: %i",
      (position) => {
        const left = findEdges(
          position,
          problemCount,
          problemCount,
          columnCount,
        );
        const right = findEdges(
          position + 1,
          problemCount,
          problemCount,
          columnCount,
        );

        expect(Math.abs(left.right)).toBe(1);
        expect(right.left).toBe(-left.right);
      },
    );
  });

  describe("上下に隣り合うピース", () => {
    const pairs = positions.filter(
      (position) => position + columnCount < problemCount,
    );

    test.each(pairs)(
      "上のピースの下の辺が凸か凹で、下のピースの上の辺がその逆であること: %i",
      (position) => {
        const upper = findEdges(
          position,
          problemCount,
          problemCount,
          columnCount,
        );
        const lower = findEdges(
          position + columnCount,
          problemCount,
          problemCount,
          columnCount,
        );

        expect(Math.abs(upper.bottom)).toBe(1);
        expect(lower.top).toBe(-upper.bottom);
      },
    );
  });

  describe("台紙の外周のピース", () => {
    const cases = [
      ["左上の角", 0, { top: 0, left: 0 }],
      ["右上の角", columnCount - 1, { top: 0, right: 0 }],
      ["最後のピース", problemCount - 1, { right: 0, bottom: 0 }],
      ["短い最後の行の上で、下にピースが無い位置", 40, { bottom: 0 }],
    ] as const;

    test.each(cases)(
      "隣にピースが無い辺を平らにすること: %s",
      (_, position, expected) => {
        const edges = findEdges(
          position,
          problemCount,
          problemCount,
          columnCount,
        );

        expect(edges).toMatchObject(expected);
      },
    );
  });

  describe("絞り込みで分けた区切り", () => {
    const matchedCount = 12;
    const cases = [
      ["当たった問題の最後", matchedCount - 1, { right: 0, bottom: 0 }],
      ["当たらなかった問題の最初", matchedCount, { top: 0, left: 0 }],
    ] as const;

    test.each(cases)(
      "区切りごとに外周を平らにした別のジグソーとして組むこと: %s",
      (_, position, expected) => {
        const edges = findEdges(
          position,
          matchedCount,
          problemCount,
          columnCount,
        );

        expect(edges).toMatchObject(expected);
      },
    );
  });
});
