import { cleanup, render } from "@testing-library/react";

import { GamePictogram } from "@/components/GamePictogram";

afterEach(cleanup);

const svg =
  '<svg viewBox="0 0 120 120" data-pictogram="test"><path d="M0 0" /></svg>';

test("渡されたSVGをDOMとして描画すること", () => {
  const { container } = render(<GamePictogram svg={svg} />);

  const pictogram = container.querySelector('svg[data-pictogram="test"]');

  expect(pictogram).toBeTruthy();
});

test("動きを再生するときだけ再生中であることを包む要素に示すこと", () => {
  const { container, rerender } = render(<GamePictogram svg={svg} />);
  const wrapper = container.firstElementChild;

  expect(wrapper?.getAttribute("data-pictogram-motion")).toBeNull();

  rerender(<GamePictogram svg={svg} motion="play" />);

  expect(wrapper?.getAttribute("data-pictogram-motion")).toBe("play");
});
