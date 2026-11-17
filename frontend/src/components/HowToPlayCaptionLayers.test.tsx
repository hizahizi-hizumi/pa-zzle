import { cleanup, render, screen } from "@testing-library/react";

import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";

afterEach(cleanup);

describe("HowToPlayCaptionLayers", () => {
  const layers = [
    { id: "legend", shown: false, content: "✓ 通れる" },
    { id: "rejected", shown: true, content: "✕ 通れない" },
    { id: "rewound", shown: false, content: "押したマスまで道が戻った" },
  ] as const;

  beforeEach(() => {
    render(<HowToPlayCaptionLayers layers={layers} />);
  });

  test("出しうる言葉をすべて同じ場所に重ねて、場所をいちばん大きい言葉で取ること", () => {
    const placed = layers.map(
      ({ content }) => screen.getByText(content).className,
    );

    expect(placed).toEqual(
      layers.map(() => expect.stringContaining("col-start-1 row-start-1")),
    );
  });

  test("見せる言葉だけを見せて、ほかの言葉は場所を取ったまま隠し読み上げから外すこと", () => {
    const shown = layers.map(({ content }) => {
      const layer = screen.getByText(content);
      return {
        hidden: layer.getAttribute("aria-hidden"),
        invisible: layer.className.includes("invisible"),
      };
    });

    expect(shown).toEqual([
      { hidden: "true", invisible: true },
      { hidden: "false", invisible: false },
      { hidden: "true", invisible: true },
    ]);
  });
});
