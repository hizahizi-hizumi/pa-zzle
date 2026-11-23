import {
  _private,
  getLipReachingTiltDeg,
  getTiltedLiquid,
  getTiltedLiquidRuns,
  type TubePoint,
  type TubeSegment,
} from "@/games/water-sort/ui/board/pour/tilted-liquid";
import {
  getSurfaceRatio,
  TUBE_INNER,
  TUBE_MOUTH_RATIO,
  TUBE_SLOT_HEIGHT,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const { getVolume, areaOf } = _private;

function getDown(tiltDeg: number): TubePoint {
  const radian = (tiltDeg * Math.PI) / 180;
  return [Math.sin(radian), Math.cos(radian)];
}

/** 線の向きと、下（重力）の向きの内積。水平なら 0。 */
function getVerticalComponent(
  [[x1, y1], [x2, y2]]: TubeSegment,
  tiltDeg: number,
) {
  const [downX, downY] = getDown(tiltDeg);
  const length = Math.hypot(x2 - x1, y2 - y1);
  return ((x2 - x1) * downX + (y2 - y1) * downY) / length;
}

describe("getTiltedLiquidRuns", () => {
  const contents = [0, 0, 3, 0];

  test("同じ試薬が続く段をひとつの層にまとめること", () => {
    const runs = getTiltedLiquidRuns(contents);

    expect(runs).toEqual([
      { colorIndex: 0, fromSlot: 0, toSlot: 2 },
      { colorIndex: 3, fromSlot: 2, toSlot: 3 },
      { colorIndex: 0, fromSlot: 3, toSlot: 4 },
    ]);
  });
});

describe("getTiltedLiquid", () => {
  const runs = getTiltedLiquidRuns([1, 2, 2, 5]);

  describe("立てた試験管の場合", () => {
    test("液面を、立てた試験管の液面と同じ高さにすること", () => {
      const liquid = getTiltedLiquid(runs, 4, 0);

      expect(liquid.surface?.[0][1]).toBeCloseTo(getSurfaceRatio(4) * 100);
    });
  });

  const tilts = [30, 60, 85, -60] as const;

  describe.each(tilts)("%i度傾けた場合", (tiltDeg) => {
    test("液面と層の境目を水平に保つこと", () => {
      const liquid = getTiltedLiquid(runs, 4, tiltDeg);
      const lines = [liquid.surface, ...liquid.boundaries].filter(
        (line): line is TubeSegment => line !== null,
      );

      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(getVerticalComponent(line, tiltDeg)).toBeCloseTo(0, 6);
      }
    });

    test("傾けても、層ごとの液の量を変えないこと", () => {
      const liquid = getTiltedLiquid(runs, 3.5, tiltDeg);
      const areas = liquid.layers.map((layer) => areaOf(layer.points));

      expect(areas[0]).toBeCloseTo(getVolume(1), 1);
      expect(areas[1]).toBeCloseTo(getVolume(3) - getVolume(1), 1);
      expect(areas[2]).toBeCloseTo(getVolume(3.5) - getVolume(3), 1);
    });
  });

  describe.each([1, 2, 3])("%i段を残して注いでいる場合", (slots) => {
    const pouringRuns = getTiltedLiquidRuns([1, 2, 3, 4].slice(0, slots));
    const tiltDeg = getLipReachingTiltDeg(slots) + 4;

    test("傾けた液の量の合計を、残っている段の数の液の量にすること", () => {
      const liquid = getTiltedLiquid(pouringRuns, slots, tiltDeg);
      const total = liquid.layers.reduce(
        (sum, layer) => sum + areaOf(layer.points),
        0,
      );

      expect(total).toBeCloseTo(getVolume(slots), 1);
    });

    test("段ごとの色を、下から順に1段ずつの量で残すこと", () => {
      const liquid = getTiltedLiquid(pouringRuns, slots, tiltDeg);

      expect(liquid.layers.map((layer) => layer.colorIndex)).toEqual(
        [1, 2, 3].slice(0, slots),
      );
      liquid.layers.forEach((layer, index) => {
        expect(areaOf(layer.points)).toBeCloseTo(
          getVolume(index + 1) - getVolume(index),
          1,
        );
      });
    });
  });

  describe("注ぎ出して上の層が無くなった場合", () => {
    test("無くなった層は形を持たず、残りの層の上を液面にすること", () => {
      const liquid = getTiltedLiquid(runs, 3, 70);

      expect(liquid.layers.map((layer) => layer.points.length > 0)).toEqual([
        true,
        true,
        false,
      ]);
      expect(liquid.boundaries).toHaveLength(1);
    });
  });
});

describe("getVolume", () => {
  const slotArea = (TUBE_INNER.right - TUBE_INNER.left) * TUBE_SLOT_HEIGHT;

  test("2段目から上は、1段ごとに立てた液の箱の1段分の量を足すこと", () => {
    for (const slots of [2, 3, 4]) {
      expect(getVolume(slots) - getVolume(slots - 1)).toBeCloseTo(slotArea, 6);
    }
  });

  test("いちばん下の段は、底の丸みの外の分だけ1段分より少ないこと", () => {
    const radiusX = (TUBE_INNER.right - TUBE_INNER.left) / 2;
    const cornerArea =
      2 * radiusX * TUBE_INNER.bottomDepth -
      (Math.PI * radiusX * TUBE_INNER.bottomDepth) / 2;

    // 底の丸みは折れ線で囲むので、楕円の面積とは 0.5% までの差を許す。
    expect(getVolume(1) / (slotArea - cornerArea)).toBeCloseTo(1, 2);
  });
});

describe("getLipReachingTiltDeg", () => {
  const amounts = [4, 3, 2, 1, 0.25] as const;

  test("満ちているほど浅く、残りが少ないほど深く傾けること", () => {
    const tilts = amounts.map(getLipReachingTiltDeg);

    for (let index = 1; index < tilts.length; index += 1) {
      expect(tilts[index]).toBeGreaterThan(tilts[index - 1] ?? 0);
    }
  });

  test("液が無ければ、試験管を水平にすること", () => {
    const tilt = getLipReachingTiltDeg(0);

    expect(tilt).toBeCloseTo(90);
  });

  describe("残りの液がちょうど口に届く角度の場合", () => {
    const tiltDeg = getLipReachingTiltDeg(2.5);
    const sameReagentRuns = getTiltedLiquidRuns([0, 0, 0]);

    test("液面が口の縁を通ること", () => {
      const liquid = getTiltedLiquid(sameReagentRuns, 2.5, tiltDeg);
      const surfaceEnd = liquid.surface?.[1];

      expect(surfaceEnd?.[0]).toBeCloseTo(TUBE_INNER.right, 1);
      expect(surfaceEnd?.[1]).toBeCloseTo(TUBE_MOUTH_RATIO * 100, 1);
    });
  });
});
