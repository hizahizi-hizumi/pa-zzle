import { cleanup, render } from "@testing-library/react";

import { HowToPlayTransition } from "@/components/HowToPlayTransition";

afterEach(cleanup);

describe("HowToPlayTransition", () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(
      <HowToPlayTransition>
        <span>前</span>
        {null}
        <span>途中</span>
        <span>後</span>
      </HowToPlayTransition>,
    ));
  });

  test("図の間にだけ矢印を置いて変化の順に並べること", () => {
    const sequence = Array.from(
      container.firstElementChild?.children ?? [],
      (element) =>
        element.tagName === "svg" ? "→" : (element.textContent ?? ""),
    );

    expect(sequence).toEqual(["前", "→", "途中", "→", "後"]);
  });
});
