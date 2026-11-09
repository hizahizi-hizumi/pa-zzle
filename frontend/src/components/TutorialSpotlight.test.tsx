import { cleanup, render } from "@testing-library/react";

import {
  TUTORIAL_SPOTLIGHT_ATTRIBUTE,
  TutorialSpotlight,
} from "@/components/TutorialSpotlight";

afterEach(cleanup);

function querySpotlights(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`),
  );
}

describe("TutorialSpotlight", () => {
  describe("抜く場合", () => {
    beforeEach(() => {
      render(
        <TutorialSpotlight active={true} className="inset-0 rounded-md" />,
      );
    });

    test("覆いが探す印を付けた、見えない要素を、渡した位置と角丸で置くこと", () => {
      const spotlights = querySpotlights();

      expect(spotlights).toHaveLength(1);
      expect(spotlights[0]?.getAttribute("aria-hidden")).toBe("true");
      expect(spotlights[0]?.className).toContain("absolute");
      expect(spotlights[0]?.className).toContain("inset-0 rounded-md");
    });
  });

  describe("抜かない場合", () => {
    beforeEach(() => {
      render(<TutorialSpotlight active={false} className="inset-0" />);
    });

    test("覆いが探す要素を置かないこと", () => {
      const spotlights = querySpotlights();

      expect(spotlights).toHaveLength(0);
    });
  });
});
