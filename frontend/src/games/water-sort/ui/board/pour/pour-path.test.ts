import {
  _private,
  getSourcePose,
  type PourPathInput,
  planPourPath,
} from "@/games/water-sort/ui/board/pour/pour-path";
import { getPourTiming } from "@/games/water-sort/ui/board/pour/pour-timing";

const { getOverflow, getRimLip } = _private;

// iPhone の幅に7本並べた盤面の試験管の大きさ。
const tubeSize = { width: 38, height: 105 };
const bounds = { top: 80, left: 4, right: 386 };

function rectAt(left: number, top: number) {
  return { left, top, ...tubeSize };
}

function input(overrides: Partial<PourPathInput>): PourPathInput {
  return {
    source: rectAt(30, 200),
    liftY: -20,
    destination: rectAt(140, 200),
    bounds,
    sourceSlotsBefore: 4,
    sourceSlotsAfter: 1,
    timing: getPourTiming(3),
    occupiedDirection: null,
    ...overrides,
  };
}

/** 姿 `pose` のときの、注ぎ元の口の縁の viewport の位置。 */
function getRimLipPosition(pathInput: PourPathInput, elapsedMs: number) {
  const path = planPourPath(pathInput);
  const pose = getSourcePose(path, elapsedMs);
  const unit = path.source.width / 36;
  const rimLip = getRimLip(path.direction);
  const offsetX = rimLip.x * unit - path.source.width / 2;
  const offsetY = rimLip.y * unit;
  const radian = (pose.tiltDeg * Math.PI) / 180;
  return {
    x:
      path.source.left +
      path.source.width / 2 +
      pose.x +
      offsetX * Math.cos(radian) -
      offsetY * Math.sin(radian),
    y:
      path.source.top +
      pose.y +
      offsetX * Math.sin(radian) +
      offsetY * Math.cos(radian),
    lip: path.lip,
  };
}

describe("getSourcePose", () => {
  const pathInput = input({});
  const timing = pathInput.timing;
  const pouringTimes = [0, 0.25, 0.5, 0.75, 0.99].map(
    (ratio) => timing.touchMs + (timing.flowEndMs - timing.touchMs) * ratio,
  );

  test.each(pouringTimes)(
    "注いでいる間、口の縁を注ぎ先の口に当てたままにすること: %d ms",
    (elapsedMs) => {
      const position = getRimLipPosition(pathInput, elapsedMs);

      expect(position.x).toBeCloseTo(position.lip.x, 6);
      expect(position.y).toBeCloseTo(position.lip.y, 6);
    },
  );

  test("液が出ていくほど、深く傾けること", () => {
    const path = planPourPath(pathInput);
    const tilts = pouringTimes.map(
      (elapsedMs) => getSourcePose(path, elapsedMs).tiltDeg,
    );

    for (let index = 1; index < tilts.length; index += 1) {
      expect(tilts[index]).toBeGreaterThan(tilts[index - 1] ?? 0);
    }
  });

  test("注ぎ始めは持ち上げた所から、注ぎ終えたら置かれていた所へ戻すこと", () => {
    const path = planPourPath(pathInput);
    const start = getSourcePose(path, 0);
    const end = getSourcePose(path, timing.durationMs);

    expect(start).toMatchObject({ x: 0, y: -20, amount: 4 });
    expect(start.tiltDeg).toBeCloseTo(0, 6);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(0, 6);
    expect(end.tiltDeg).toBeCloseTo(0, 6);
    expect(end.amount).toBe(1);
  });
});

describe("planPourPath", () => {
  describe("注ぎ先が注ぎ元の右にある場合", () => {
    const pathInput = input({});

    test("右へ口を倒して注ぐこと", () => {
      const path = planPourPath(pathInput);

      expect(path.direction).toBe(1);
    });
  });

  describe("右端の試験管から、その左の試験管へ注ぐ場合", () => {
    const pathInput = input({
      source: rectAt(340, 200),
      destination: rectAt(286, 200),
    });

    test("右の画面の端からはみ出さないよう、左の側から注ぐこと", () => {
      const path = planPourPath(pathInput);

      expect(path.direction).toBe(1);
      expect(getOverflow(path, bounds)).toEqual({ side: 0, top: 0 });
    });
  });

  describe("左端の試験管へ注ぐ場合", () => {
    const pathInput = input({
      source: rectAt(140, 360),
      destination: rectAt(10, 200),
    });

    test("画面の端からも見出しからもはみ出さないこと", () => {
      const path = planPourPath(pathInput);

      expect(getOverflow(path, bounds)).toEqual({ side: 0, top: 0 });
    });
  });

  describe("同じ注ぎ先へ、左から注いでいる途中の試験管がある場合", () => {
    const pathInput = input({
      source: rectAt(30, 360),
      destination: rectAt(140, 200),
      occupiedDirection: 1,
    });

    test("重ならないよう、右の側から注ぐこと", () => {
      const path = planPourPath(pathInput);

      expect(path.direction).toBe(-1);
    });
  });

  describe("iPhone の幅に6本を2段に並べた盤面の、上の段どうしで注ぐ場合", () => {
    // 見出しの下端と、持ち上げと試験管ばさみの柄の分を上に取った上の段の試験管。
    const headerBounds = { top: 104, left: 4, right: 386 };
    const topRowTube = { width: 59, height: 165 };
    const cases = [
      ["隣へ1段", 242, 165, 4, 3],
      ["隣へ3段", 88, 165, 4, 1],
      ["2本先へ空になるまで2段", 88, 242, 2, 0],
      ["2本先へ空になるまで4段", 242, 88, 4, 0],
    ] as const;

    test.each(cases)(
      "持ってから戻すまで、試験管ばさみの柄も見出しにかからないこと: %s",
      (_label, sourceLeft, destinationLeft, before, after) => {
        const path = planPourPath(
          input({
            source: { left: sourceLeft, top: 158, ...topRowTube },
            destination: { left: destinationLeft, top: 158, ...topRowTube },
            bounds: headerBounds,
            sourceSlotsBefore: before,
            sourceSlotsAfter: after,
            timing: getPourTiming(before - after),
          }),
        );

        const overflow = getOverflow(path, headerBounds);

        expect(overflow.top).toBeLessThanOrEqual(0.5);
      },
    );
  });
});
