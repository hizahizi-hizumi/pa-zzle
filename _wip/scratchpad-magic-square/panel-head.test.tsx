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
  useReportHowToPlayExampleChange,
} from "@/components/HowToPlayExamplePanel";

const { findResetButtonPosition, findResetButtonSpot } = _private;

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
   * 面の内側。右端 300px、上端 0、下端 200px。ボタンは右端から 40px の列に置き、
   * 下の角では下端から上へ 28px・下へ 8px、上の角では上端から下へ 20px・上へ 16px に届く。
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

  describe("例が2つある面の場合", () => {
    const pair = [
      { left: 0, right: 140, top: 40, bottom: 200 },
      { left: 160, right: 250, top: 40, bottom: 200 },
    ];

    test("言葉の行の右が空いていても、最後の例の横ではなく右上の角を選ぶこと", () => {
      const result = findResetButtonPosition(content, pair, 2).placement;

      expect(result).toBe("top-corner");
    });

    test("右上の角に例が届けば、例の下を選び、ボタンの列の外の言葉も数えて、どの言葉より下に置くこと", () => {
      const result = findResetButtonPosition(
        content,
        [
          { left: 0, right: 300, top: 0, bottom: 90 },
          { left: 100, right: 200, top: 100, bottom: 200 },
          { left: 120, right: 180, top: 200, bottom: 220 },
        ],
        2,
      );

      expect(result).toEqual({ placement: "below-examples", inkBelowPx: 20 });
    });
  });
});

describe("findResetButtonSpot", () => {
  /** 面の内側。左右 0〜300px、上下 0〜400px。面の上下の余白は 32px。 */
  const content = { left: 0, right: 300, top: 0, bottom: 400 };
  const upper = { left: 60, right: 240, top: 0, bottom: 150 };
  const upperCaption = { left: 60, right: 240, top: 126, bottom: 150 };
  const lower = { left: 60, right: 240, top: 190, bottom: 400 };
  const lowerCaption = { left: 60, right: 240, top: 376, bottom: 400 };
  const stacked = [
    upper,
    { left: 120, right: 180, top: 130, bottom: 146 },
    lower,
    { left: 120, right: 180, top: 380, bottom: 396 },
  ];

  test("縦に積んだ上の例は、その例の言葉の1行目の横の、面の右の縁に置くこと", () => {
    const spot = findResetButtonSpot(content, upper, upperCaption, stacked);

    // 言葉の1行目（126〜150px）の中央 138px にボタン（36px）の中央をそろえ、面の上端（-32px）から測る。
    expect(spot).toEqual({ side: "right", top: 152 });
  });

  test("縦に積んだ下の例は、その例の言葉の横に置き、上の例の横には置かないこと", () => {
    const spot = findResetButtonSpot(content, lower, lowerCaption, stacked);

    expect(spot).toEqual({ side: "right", top: 402 });
  });

  test("面の左寄りの例は、面の左の縁に置くこと", () => {
    const left = { left: 0, right: 130, top: 0, bottom: 150 };

    const spot = findResetButtonSpot(content, left, null, [
      { left: 40, right: 130, top: 0, bottom: 150 },
    ]);

    expect(spot?.side).toBe("left");
  });

  test("言葉の横が例に届けば、例の上端の横に置くこと", () => {
    const wideCaption = { left: 0, right: 300, top: 126, bottom: 150 };

    const spot = findResetButtonSpot(content, upper, wideCaption, [
      upper,
      wideCaption,
    ]);

    expect(spot).toEqual({ side: "right", top: 16 });
  });

  test("言葉の横にも上端の横にも例が届けば、置かないこと", () => {
    const wide = { left: 0, right: 300, top: 0, bottom: 150 };

    const spot = findResetButtonSpot(content, wide, upperCaption, [
      wide,
      { left: 0, right: 300, top: 126, bottom: 150 },
    ]);

    expect(spot).toBeNull();
  });
});

/** 押すと、例の下に面の幅いっぱいの言葉を出す例。例は面の中央の 60〜240px・0〜176px、言葉は 176〜200px に出る。 */
function ExampleWithLateCaption() {
  const [captioned, setCaptioned] = useState(false);
  return (
    <figure data-rect="60,0,240,200">
      <button
        type="button"
        data-rect="60,0,240,176"
        onClick={() => setCaptioned(true)}
      >
        例
      </button>
      {captioned ? (
        <figcaption data-rect="60,176,240,200">
          <span data-rect="0,180,300,200">ほかの車がある</span>
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

/**
 * 要素の `data-rect`（左,上,右,下）を、その要素の矩形として返す。面の内側（コンテナ）は `content` の矩形にし、
 * ほかは大きさの無い矩形にする。
 */
function mockRects(content: string) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function getRect(this: Element) {
      const rect = this.classList.contains("@container")
        ? content
        : this.getAttribute("data-rect");
      if (rect === null) {
        return new DOMRect(0, 0, 0, 0);
      }
      const [left = 0, top = 0, right = 0, bottom = 0] = rect
        .split(",")
        .map(Number);
      return new DOMRect(left, top, right - left, bottom - top);
    },
  );
}

/** 押すと、面に変わったことを知らせる例。 */
function TouchableFigure({ name, rect }: { name: string; rect: string }) {
  const report = useReportHowToPlayExampleChange();
  return (
    <figure data-rect={rect}>
      <button type="button" data-rect={rect} onClick={() => report(true)}>
        {name}
      </button>
    </figure>
  );
}

function readButtonSpot() {
  const holder = screen
    .getByRole("button", { name: "例を元に戻す" })
    .closest("[data-reset-button-side]");
  return {
    side: holder?.getAttribute("data-reset-button-side"),
    top: (holder as HTMLElement | null)?.style.top,
  };
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

    test("例の横にボタンを置いて高さを取らないこと", () => {
      const placement = readPlacement();

      expect(placement).toBe("beside-example");
    });
  });

  describe("縦に積んだ2つの例の場合", () => {
    beforeEach(() => {
      // 面の内側は 0〜300px・0〜400px。上の例は 0〜150px、下の例は 250〜400px で、どちらも面の中央に寄せる。
      mockRects("0,0,300,400");
      render(
        <HowToPlayExamplePanel resettable arrangement="stacked">
          <TouchableFigure name="上の例" rect="60,0,240,150" />
          <TouchableFigure name="下の例" rect="60,250,240,400" />
        </HowToPlayExamplePanel>,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test.each([
      ["上の例", "146px"],
      ["下の例", "396px"],
    ])(
      "%sを触ると、その例の下端の横の右の縁にボタンを出すこと",
      async (name, top) => {
        fireEvent.click(screen.getByRole("button", { name }));

        await waitFor(() => {
          expect(readButtonSpot()).toEqual({ side: "right", top });
        });
      },
    );
  });

  describe("触った後に、ボタンに届く言葉が出る場合", () => {
    beforeEach(() => {
      // 面の内側は 0〜300px・0〜200px。後から出る言葉だけが、面の右下の角まで届く。
      mockRects("0,0,300,200");
      render(
        <HowToPlayExamplePanel resettable>
          <ExampleWithLateCaption />
        </HowToPlayExamplePanel>,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("出た言葉を測り直して、言葉に重ならない例の上端の横へボタンを移すこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "例" }));

      await waitFor(() => {
        expect(readButtonSpot()).toEqual({ side: "right", top: "16px" });
      });
    });
  });
});
