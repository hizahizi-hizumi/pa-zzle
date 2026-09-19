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
