import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import {
  _private,
  HowToPlayExamplePanel,
} from "@/components/HowToPlayExamplePanel";

const { findResetButtonPosition } = _private;

afterEach(cleanup);

describe("findResetButtonPosition", () => {
  describe("どちらの角にも例が届き、ボタンの列にわけの行が下端より下に描かれる場合", () => {
    const content = { left: 0, right: 300, top: 0, bottom: 200 };
    const examples = [
      { left: 0, right: 300, top: 0, bottom: 176 },
      { left: 100, right: 290, top: 180, bottom: 200 },
      { left: 120, right: 280, top: 200, bottom: 220 },
      { left: 0, right: 60, top: 200, bottom: 240 },
    ];

    test("ボタンの列に描かれる言葉の下端までの高さを返し、列の外の言葉は数えないこと", () => {
      const result = findResetButtonPosition(content, examples);

      expect(result).toEqual({ placement: "below-examples", inkBelowPx: 20 });
    });
  });

  /**
   * 面の内側。右端 300px、上端 0、下端 200px。ボタンは右端から 44px の列に置き、
   * 下の角では下端から上へ 30px・下へ 6px、上の角では上端から下へ 30px・上へ 6px に届く。
   */
  const content = { left: 0, right: 300, top: 0, bottom: 200 };
  const cases = [
    {
      name: "例が中央に収まり、ボタンの列に届かない",
      examples: [{ left: 60, right: 240, top: 0, bottom: 200 }],
      placement: "beside-caption",
    },
    {
      name: "幅いっぱいの例が、下の角より上で終わる",
      examples: [{ left: 0, right: 300, top: 0, bottom: 150 }],
      placement: "beside-caption",
    },
    {
      name: "右の例の言葉が下の角に届き、盤面は上の角に届かない",
      examples: [
        { left: 0, right: 140, top: 40, bottom: 200 },
        { left: 160, right: 250, top: 40, bottom: 170 },
        { left: 160, right: 300, top: 176, bottom: 200 },
      ],
      placement: "top-corner",
    },
    {
      name: "幅いっぱいの盤面が上の角にも下の角にも届く",
      examples: [{ left: 0, right: 300, top: 0, bottom: 200 }],
      placement: "below-examples",
    },
    {
      name: "測れない（大きさの無い）例だけがある",
      examples: [{ left: 0, right: 0, top: 0, bottom: 0 }],
      placement: "beside-caption",
    },
  ] as const;

  test.each(cases)(
    "高さを取らない角のうち例に重ならない所を選び、無ければ例の下を選ぶこと: $name",
    ({ examples, placement }) => {
      const result = findResetButtonPosition(content, examples).placement;

      expect(result).toBe(placement);
    },
  );
});

/** 押すと、例の下に面の幅いっぱいの言葉を出す例。 */
function ExampleWithLateCaption() {
  const [captioned, setCaptioned] = useState(false);
  return (
    <figure>
      <button type="button" onClick={() => setCaptioned(true)}>
        例
      </button>
      {captioned ? (
        <figcaption>
          <span data-wide-caption="">ほかの車がある</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

function readPlacement(): string | null | undefined {
  return screen
    .getByRole("figure")
    .closest("[data-reset-button-placement]")
    ?.getAttribute("data-reset-button-placement");
}

describe("HowToPlayExamplePanel", () => {
  describe("例と言葉がボタンに届かない場合", () => {
    beforeEach(() => {
      render(
        <HowToPlayExamplePanel resettable>
          <figure>例</figure>
        </HowToPlayExamplePanel>,
      );
    });

    test("言葉の行の右にボタンを置いて高さを取らないこと", () => {
      const placement = readPlacement();

      expect(placement).toBe("beside-caption");
    });
  });

  describe("触った後に、ボタンに届く言葉が出る場合", () => {
    beforeEach(() => {
      // 面の内側は右端 300px・下端 200px。後から出る言葉だけが、面の右下の角まで届く。
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function getRect(this: Element) {
          if (this.hasAttribute("data-wide-caption")) {
            return new DOMRect(0, 180, 300, 20);
          }
          if (this.classList.contains("@container")) {
            return new DOMRect(0, 0, 300, 200);
          }
          return new DOMRect(0, 0, 0, 0);
        },
      );
      render(
        <HowToPlayExamplePanel resettable>
          <ExampleWithLateCaption />
        </HowToPlayExamplePanel>,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("出た言葉を測り直して、言葉に重ならない右上の角へボタンを移すこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "例" }));

      await waitFor(() => {
        expect(readPlacement()).toBe("top-corner");
      });
    });
  });
});
