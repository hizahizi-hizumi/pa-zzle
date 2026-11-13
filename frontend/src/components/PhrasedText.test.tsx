import { cleanup, render } from "@testing-library/react";

import { PhrasedText } from "@/components/PhrasedText";

afterEach(cleanup);

describe("PhrasedText", () => {
  describe("文節がいくつかある文を渡した場合", () => {
    const text = "空のボトルだけでなく同じ色の上にも注げます";
    let container: HTMLElement;

    beforeEach(() => {
      container = render(
        <p>
          <PhrasedText text={text} />
        </p>,
      ).container;
    });

    test("文字は元の文のまま読めること", () => {
      const shown = container.querySelector("p")?.textContent;

      expect(shown).toBe(text);
    });

    test("語の途中で折り返さないよう、文節の間にだけ折り返せる所を置くこと", () => {
      const phrases = Array.from(
        container.querySelector("p")?.childNodes ?? [],
      ).map((node) => (node.nodeName === "WBR" ? "|" : node.textContent));

      expect(phrases.join("")).toBe(
        "空の|ボトルだけでなく|同じ|色の|上にも|注げます",
      );
    });
  });
});
