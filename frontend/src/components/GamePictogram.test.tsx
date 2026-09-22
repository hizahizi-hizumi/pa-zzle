import { cleanup, render } from "@testing-library/react";

import { GamePictogram } from "@/components/GamePictogram";

afterEach(cleanup);

describe("GamePictogram", () => {
  const svg =
    '<svg viewBox="0 0 120 120" data-pictogram="test"><path d="M0 0" /></svg>';
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(<GamePictogram svg={svg} />));
  });

  test("渡されたSVGをDOMとして描画すること", () => {
    const pictogram = container.querySelector('svg[data-pictogram="test"]');

    expect(pictogram).toBeTruthy();
  });
});
