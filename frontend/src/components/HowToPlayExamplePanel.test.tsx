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
    const examples = {
      boards: [{ left: 0, right: 300, top: 0, bottom: 176 }],
      captions: [
        { left: 100, right: 290, top: 180, bottom: 200 },
        { left: 120, right: 280, top: 200, bottom: 220 },
        { left: 0, right: 60, top: 200, bottom: 240 },
      ],
    };

    test("ボタンの列に描かれる言葉の下端までの高さを返し、列の外の言葉は数えないこと", () => {
      const result = findResetButtonPosition(content, examples);

      expect(result).toEqual({
        placement: "below-examples",
        spaceBelowPx: 20,
        belowBoard: false,
      });
    });
  });

  describe("どちらの角にも例が届き、ボタンの列の下端に盤面がある場合", () => {
    const content = { left: 0, right: 300, top: 0, bottom: 200 };

    test("盤面の下端からボタンを押せる範囲で 16px 離す高さを返し、ボタンの真上が盤面とすること", () => {
      const result = findResetButtonPosition(content, {
        boards: [{ left: 0, right: 300, top: 0, bottom: 200 }],
        captions: [{ left: 100, right: 200, top: 120, bottom: 140 }],
      });

      // ボタンは空ける高さの下に 4px 空けて置くので、盤面の下端から 20px 下になる。
      expect(result).toEqual({
        placement: "below-examples",
        spaceBelowPx: 16,
        belowBoard: true,
      });
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
      examples: {
        boards: [{ left: 60, right: 240, top: 0, bottom: 176 }],
        captions: [{ left: 60, right: 240, top: 176, bottom: 200 }],
      },
      placement: "beside-caption",
    },
    {
      name: "幅いっぱいの盤面が、下の角より上で終わる",
      examples: {
        boards: [{ left: 0, right: 300, top: 0, bottom: 150 }],
        captions: [],
      },
      placement: "beside-caption",
    },
    {
      name: "右の例の言葉が下の角に届き、盤面は上の角に届かない",
      examples: {
        boards: [
          { left: 0, right: 140, top: 40, bottom: 200 },
          { left: 160, right: 250, top: 40, bottom: 170 },
        ],
        captions: [{ left: 160, right: 300, top: 176, bottom: 200 }],
      },
      placement: "top-corner",
    },
    {
      name: "幅いっぱいの盤面が上の角にも下の角にも届く",
      examples: {
        boards: [{ left: 0, right: 300, top: 0, bottom: 200 }],
        captions: [],
      },
      placement: "below-examples",
    },
    {
      name: "測れない（大きさの無い）例だけがある",
      examples: {
        boards: [{ left: 0, right: 0, top: 0, bottom: 0 }],
        captions: [],
      },
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
    test("言葉の行の右が空いていても、最後の例の横ではなく右上の角を選ぶこと", () => {
      const result = findResetButtonPosition(
        content,
        {
          boards: [
            { left: 0, right: 140, top: 40, bottom: 200 },
            { left: 160, right: 250, top: 40, bottom: 200 },
          ],
          captions: [],
        },
        2,
      ).placement;

      expect(result).toBe("top-corner");
    });

    test("盤面が右上の角に重ならなければ、押せる範囲で 16px に届かないほど迫っても右上の角を選ぶこと", () => {
      const result = findResetButtonPosition(
        content,
        {
          boards: [
            { left: 0, right: 140, top: 40, bottom: 200 },
            { left: 160, right: 255, top: 22, bottom: 200 },
          ],
          captions: [],
        },
        2,
      ).placement;

      expect(result).toBe("top-corner");
    });

    test("右上の角に例が届けば、例の下を選び、ボタンの列の外の言葉も数えて、どの言葉より下に置くこと", () => {
      const result = findResetButtonPosition(
        content,
        {
          boards: [
            { left: 0, right: 300, top: 0, bottom: 90 },
            { left: 100, right: 200, top: 100, bottom: 200 },
          ],
          captions: [{ left: 120, right: 180, top: 200, bottom: 220 }],
        },
        2,
      );

      expect(result).toEqual({
        placement: "below-examples",
        spaceBelowPx: 20,
        belowBoard: false,
      });
    });
  });
});

describe("findResetButtonSpot", () => {
  /** 面の内側。左右 0〜300px、上下 0〜400px。面の上下の余白は 32px。ボタンは右の縁の 264〜300px の列に置く。 */
  const content = { left: 0, right: 300, top: 0, bottom: 400 };
  const upper = { left: 60, right: 240, top: 0, bottom: 150 };
  const upperCaption = { left: 60, right: 240, top: 126, bottom: 150 };
  const lower = { left: 60, right: 240, top: 190, bottom: 400 };
  const lowerCaption = { left: 60, right: 240, top: 376, bottom: 400 };
  const captions = [
    { left: 120, right: 180, top: 130, bottom: 146 },
    { left: 120, right: 180, top: 380, bottom: 396 },
  ];
  const boards = [
    { left: 60, right: 240, top: 0, bottom: 120 },
    { left: 60, right: 240, top: 190, bottom: 370 },
  ];

  test("縦に積んだ上の例は、その例の言葉の1行目の横の、面の右の縁に置くこと", () => {
    const spot = findResetButtonSpot(content, upper, upperCaption, 120, {
      captions,
      boards,
    });

    // 言葉の1行目（126〜150px）の中央 138px にボタン（36px）の中央をそろえ、面の内側の上端から測る。
    expect(spot).toEqual({ side: "right", top: 120 });
  });

  test("縦に積んだ下の例は、その例の言葉の横に置き、上の例の横には置かないこと", () => {
    const spot = findResetButtonSpot(content, lower, lowerCaption, 370, {
      captions,
      boards,
    });

    expect(spot).toEqual({ side: "right", top: 370 });
  });

  test("面の左寄りの例は、面の左の縁に置くこと", () => {
    const left = { left: 0, right: 130, top: 0, bottom: 150 };

    const spot = findResetButtonSpot(content, left, null, 150, {
      captions: [],
      boards: [{ left: 80, right: 130, top: 0, bottom: 150 }],
    });

    expect(spot?.side).toBe("left");
  });

  test("言葉の横が言葉に届けば、例の上端の横に置くこと", () => {
    const wideCaption = { left: 0, right: 300, top: 126, bottom: 150 };

    const spot = findResetButtonSpot(content, upper, wideCaption, 120, {
      captions: [wideCaption],
      boards: [boards[0] ?? upper],
    });

    expect(spot).toEqual({ side: "right", top: -16 });
  });

  test("言葉の横と盤面の右下（駒台など）の間が押せる範囲で 16px に満たなければ、例の上端の横に置くこと", () => {
    // 盤面の右下の 100〜120px だけが、ボタンの列の左 14px まで届く。
    const stand = { left: 180, right: 250, top: 100, bottom: 120 };

    const spot = findResetButtonSpot(content, upper, upperCaption, 120, {
      captions,
      boards: [boards[0] ?? upper, stand],
    });

    expect(spot).toEqual({ side: "right", top: -16 });
  });

  test("言葉の横にも上端の横にも盤面が迫れば、盤面の下端から押せる範囲で 16px 離して置くこと", () => {
    const nearBoard = { left: 60, right: 250, top: 0, bottom: 100 };

    const spot = findResetButtonSpot(content, upper, upperCaption, 100, {
      captions,
      boards: [nearBoard],
    });

    expect(spot).toEqual({ side: "right", top: 120 });
  });

  test("押せる範囲で 16px 離すことを求めなければ、言葉の横の盤面から 4px 離れた所に置くこと", () => {
    // 盤面の右下の 100〜120px だけが、ボタンの列の左 14px まで届く。
    const stand = { left: 180, right: 250, top: 100, bottom: 120 };

    const spot = findResetButtonSpot(
      content,
      upper,
      upperCaption,
      120,
      { captions, boards: [boards[0] ?? upper, stand] },
      false,
    );

    expect(spot).toEqual({ side: "right", top: 120 });
  });

  test("どの所にも例が届き、盤面の下に面の余白しか無ければ、置かないこと", () => {
    const wide = { left: 0, right: 300, top: 0, bottom: 150 };

    const spot = findResetButtonSpot(
      { ...content, bottom: 150 },
      wide,
      upperCaption,
      150,
      {
        captions: [{ left: 0, right: 300, top: 126, bottom: 150 }],
        boards: [wide],
      },
    );

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

/** 押すと、面に変わったことを知らせる例。弾かれる手を押すと、変わっていないと知らせる。 */
function TouchableFigure({ name, rect }: { name: string; rect: string }) {
  const report = useReportHowToPlayExampleChange();
  return (
    <figure data-rect={rect}>
      <button type="button" data-rect={rect} onClick={() => report(true)}>
        {name}
      </button>
      <button type="button" onClick={() => report(false)}>
        {`${name}の弾かれる手`}
      </button>
    </figure>
  );
}

/** 2つの図にまたがる1つの例と、図の外の入力の段（ナンプレの数字の段など）。図のマスを押すと選び、入力の段を押すと選んだマスを変える。 */
function ExampleAcrossFigures() {
  const report = useReportHowToPlayExampleChange();
  return (
    <>
      <figure data-rect="60,0,240,150">
        <button type="button" onClick={() => report(true)}>
          上のマス
        </button>
      </figure>
      <figure data-rect="60,250,240,400">
        <button type="button" onClick={() => report(true)}>
          下のマス
        </button>
      </figure>
      <button type="button" onClick={() => report(true)}>
        入力の段
      </button>
      <button type="button" onClick={() => report(false)}>
        取り消す
      </button>
    </>
  );
}

function readPanelPlacement(): string | null | undefined {
  return screen
    .getByRole("button", { name: "例を元に戻す" })
    .closest("[data-reset-button-placement]")
    ?.getAttribute("data-reset-button-placement");
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
      ["上の例", "114px"],
      ["下の例", "364px"],
    ])(
      "%sを触ると、その例の下端の横の右の縁にボタンを出すこと",
      async (name, top) => {
        fireEvent.click(screen.getByRole("button", { name }));

        await waitFor(() => {
          expect(readButtonSpot()).toEqual({ side: "right", top });
        });
      },
    );

    test("上の例を変えた後に、変わっていない下の例で弾かれる手を押しても、ボタンを下の例の横へ移さないこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "上の例" }));
      fireEvent.click(
        screen.getByRole("button", { name: "下の例の弾かれる手" }),
      );

      await waitFor(() => {
        expect(readButtonSpot()).toEqual({ side: "right", top: "114px" });
      });
    });
  });

  describe("縦に積んだ2つの例の盤面が、どの横の所にもボタンの押せる範囲から 16px より近い場合", () => {
    beforeEach(() => {
      // 面の内側は 0〜300px・0〜400px。盤面はボタンの列（264〜300px）の左 14px まで届き、上下の例の間は 50px。
      mockRects("0,0,300,400");
      render(
        <HowToPlayExamplePanel resettable arrangement="stacked">
          <TouchableFigure name="上の例" rect="50,0,250,150" />
          <TouchableFigure name="下の例" rect="50,200,250,400" />
        </HowToPlayExamplePanel>,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("触った下の例の横に、盤面から 4px 離して置き、面の右上の角には置かないこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "下の例" }));

      await waitFor(() => {
        expect(readButtonSpot()).toEqual({ side: "right", top: "364px" });
      });
    });
  });

  describe("2つの図にまたがる例の場合", () => {
    beforeEach(async () => {
      mockRects("0,0,300,400");
      render(
        <HowToPlayExamplePanel resettable arrangement="stacked">
          <ExampleAcrossFigures />
        </HowToPlayExamplePanel>,
      );
      fireEvent.click(screen.getByRole("button", { name: "上のマス" }));
      await waitFor(() => {
        expect(readButtonSpot().top).toBe("114px");
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("下の図の上から指で送り始めても、Tab でフォーカスを送っても、その後に図の外で変えたときは、前に操作した上の図の横に置くこと", () => {
      const lower = screen.getByRole("button", { name: "下のマス" });
      fireEvent.pointerDown(lower);
      fireEvent.pointerCancel(lower);
      fireEvent.keyDown(lower, { key: "Tab" });
      fireEvent.click(screen.getByRole("button", { name: "入力の段" }));

      expect(readButtonSpot().top).toBe("114px");
    });

    test("下の図を変えると下の図の横へ移し、最初の姿に戻すとボタンを隠すこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "下のマス" }));
      const moved = readButtonSpot().top;
      fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

      expect({
        moved,
        hidden: screen
          .getByRole("button", { name: "例を元に戻す" })
          .hasAttribute("disabled"),
      }).toEqual({ moved: "364px", hidden: true });
    });
  });

  describe("横に並べた2つの例の場合", () => {
    beforeEach(() => {
      // 面の内側は 0〜400px・0〜200px。左の例は 20〜180px、右の例は 220〜340px で、同じ行に並ぶ。
      mockRects("0,0,400,200");
      render(
        <HowToPlayExamplePanel resettable>
          <TouchableFigure name="左の例" rect="20,40,180,200" />
          <TouchableFigure name="右の例" rect="220,40,340,200" />
        </HowToPlayExamplePanel>,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("どちらの例を触っても、面の右上の角の1か所にボタンを出すこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "左の例" }));
      const afterLeft = readButtonSpot();
      fireEvent.click(screen.getByRole("button", { name: "右の例" }));
      const afterRight = readButtonSpot();

      await waitFor(() => {
        expect({
          placement: readPanelPlacement(),
          afterLeft,
          afterRight,
        }).toEqual({
          placement: "top-corner",
          afterLeft: { side: undefined, top: undefined },
          afterRight: { side: undefined, top: undefined },
        });
      });
    });
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
        expect(readButtonSpot()).toEqual({ side: "right", top: "-16px" });
      });
    });
  });
});
