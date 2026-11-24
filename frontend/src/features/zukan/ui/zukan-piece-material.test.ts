import { describe, expect, test } from "vitest";
import {
  _private,
  listZukanPieceLayers,
  listZukanSheetPieceFaceStops,
  listZukanSheetPieceGrooveStops,
} from "@/features/zukan/ui/zukan-piece-material";

const { translatePath } = _private;

describe("translatePath", () => {
  const path = "M0,0 L1,0 C1,0.5 0.5,1 0,1 Z";

  test("輪郭のすべての点を同じだけずらすこと", () => {
    const moved = translatePath(path, 0.1, -0.2);

    expect(moved).toBe("M0.1,-0.2 L1.1,-0.2 C1.1,0.3 0.6,0.8 0.1,0.8 Z");
  });
});

describe("listZukanPieceLayers", () => {
  const path = "M0,0 L1,0 L1,1 L0,1 Z";

  test("面・階調・稜線・陰の順に層を重ねること", () => {
    const layers = listZukanPieceLayers(path);

    expect(layers.map(({ kind }) => kind)).toEqual([
      "face",
      "light",
      "bevel-light",
      "bevel-shade",
    ]);
  });
});

describe("listZukanSheetPieceFaceStops", () => {
  const color = "#808080";

  test("光の側で白を、中ほどで素の色を、反対の側で黒を混ぜること", () => {
    const stops = listZukanSheetPieceFaceStops(color);

    expect(stops).toEqual([
      { offset: 0, color: "color-mix(in srgb, #808080, #fff 6%)" },
      { offset: 0.5, color: "#808080" },
      { offset: 1, color: "color-mix(in srgb, #808080, #000 4%)" },
    ]);
  });
});

describe("listZukanSheetPieceGrooveStops", () => {
  const grooveColor = "#fff";

  test("光の側で窪みの縁の陰を混ぜ、反対の側は溝の色のままにすること", () => {
    const stops = listZukanSheetPieceGrooveStops(grooveColor);

    expect(stops.map(({ color }) => color)).toEqual([
      "color-mix(in srgb, #fff, #000 13%)",
      "#fff",
    ]);
  });
});
