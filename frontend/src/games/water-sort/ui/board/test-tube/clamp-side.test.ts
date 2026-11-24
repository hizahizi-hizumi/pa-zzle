import { _private } from "@/games/water-sort/ui/board/test-tube/clamp-side";

const { getHeldClampSide } = _private;

describe("getHeldClampSide", () => {
  // iPhone の幅に14本を2段に並べた盤面の、盤面を置いた場所と試験管の幅。
  const area = { left: 8, right: 382 };
  const width = 46.6;

  test("柄の先が盤面を置いた場所に収まる列では、右に柄を出すこと", () => {
    const side = getHeldClampSide({ left: 280, width }, area);

    expect(side).toBe("right");
  });

  test("右に出すと柄の先が盤面を置いた場所の右の端を越える列では、左に柄を出すこと", () => {
    const side = getHeldClampSide({ left: 335.4, width }, area);

    expect(side).toBe("left");
  });

  test("右の端の列でも、盤面を置いた場所の右に柄の入る余りがあれば、右に柄を出すこと", () => {
    const side = getHeldClampSide(
      { left: 335.4, width },
      { left: 0, right: 1280 },
    );

    expect(side).toBe("right");
  });

  test("左に出しても柄の先が盤面を置いた場所を越えるなら、右に柄を出すこと", () => {
    const side = getHeldClampSide({ left: 8, width }, { left: 8, right: 54.6 });

    expect(side).toBe("right");
  });
});
