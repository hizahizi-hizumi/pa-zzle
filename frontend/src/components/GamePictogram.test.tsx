import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { GamePictogram } from "@/components/GamePictogram";

afterEach(cleanup);

const svg =
  '<svg viewBox="0 0 120 120" data-pictogram="test"><path d="M0 0" /></svg>';

test("SVGをDOMとして描画すること", () => {
  const { container } = render(<GamePictogram svg={svg} />);

  const pictogram = container.querySelector('svg[data-pictogram="test"]');

  expect(pictogram).toBeTruthy();
});

test("結果表示では文脈色を濃淡2色へ注入すること", () => {
  const { container } = render(<GamePictogram svg={svg} variant="result" />);

  const wrapper = container.firstElementChild;

  expect(wrapper?.className).toContain(
    "[--game-pictogram-strong:currentColor]",
  );
  expect(wrapper?.className).toContain(
    "[--game-pictogram-soft:color-mix(in_oklab,currentColor_55%,transparent)]",
  );
});
