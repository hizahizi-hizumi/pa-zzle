import {
  animateBoardGeometry,
  animateBoardPaint,
} from "@/lib/board-visual-motion";

describe("board-visual-motion", () => {
  let anchor: HTMLButtonElement;
  let visual: HTMLElement;
  let animate: ReturnType<typeof vi.fn>;
  const motionKeyframes: Keyframe[] = [
    { transform: "scale(1)" },
    { transform: "scale(1.1)" },
  ];
  const paintKeyframes: Keyframe[] = [
    { opacity: 0 },
    { opacity: 1, offset: 0.5 },
    { opacity: 0 },
  ];
  const timing: KeyframeAnimationOptions = { duration: 200 };

  beforeEach(() => {
    anchor = document.createElement("button");
    visual = document.createElement("span");
    anchor.append(visual);
    animate = vi.fn().mockReturnValue({ cancel: vi.fn() });
    Object.defineProperty(visual, "animate", {
      configurable: true,
      value: animate,
    });
  });

  test("配置要素を残したまま着手の子要素を動かせること", () => {
    const result = animateBoardGeometry(
      anchor,
      visual,
      motionKeyframes,
      timing,
    );

    expect(animate).toHaveBeenCalledExactlyOnceWith(motionKeyframes, timing);
    expect(result).not.toBeNull();
  });

  test("照りの演出では内容の配置を動かさないこと", () => {
    const result = animateBoardPaint(anchor, visual, paintKeyframes, timing);

    expect(animate).toHaveBeenCalledExactlyOnceWith(paintKeyframes, timing);
    expect(result).not.toBeNull();
  });

  test("照りの演出では拡大や移動を拒否すること", () => {
    const act = () =>
      animateBoardPaint(anchor, visual, motionKeyframes, timing);

    expect(act).toThrow("Board paint animation cannot change geometry");
    expect(animate).not.toHaveBeenCalled();
  });

  test("配置要素自身を演出対象にはできないこと", () => {
    const act = () =>
      animateBoardGeometry(anchor, anchor, motionKeyframes, timing);

    expect(act).toThrow("Board animation target must be a descendant");
  });

  test("別の盤面に属する要素を動かせないこと", () => {
    const other = document.createElement("span");
    const act = () => animateBoardPaint(anchor, other, paintKeyframes, timing);

    expect(act).toThrow("Board animation target must be a descendant");
  });

  test("SVGの光路を位置を変えずに描画できること", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.append(path);
    Object.defineProperty(path, "animate", {
      configurable: true,
      value: animate,
    });
    const keyframes: Keyframe[] = [
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0 },
    ];

    const result = animateBoardPaint(svg, path, keyframes, timing);

    expect(animate).toHaveBeenCalledExactlyOnceWith(keyframes, timing);
    expect(result).not.toBeNull();
  });

  test("対象が消えている間は演出を実行しないこと", () => {
    const result = animateBoardPaint(anchor, null, paintKeyframes, timing);

    expect(result).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });
});
