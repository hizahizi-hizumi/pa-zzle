import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import type { MagicSquareExamplePress } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-hint";
import {
  givenRuleExample,
  lineRuleExample,
  type MagicSquareHowToPlayExample,
  memoClearedOperationExample,
  memoOperationExample,
  placeOperationExample,
  replaceOperationExample,
  usedValueRuleExample,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/TouchableExample";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
});

function readPlayedSounds(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => (sound as unknown as { url: string }).url);
}

/**
 * 例ごとの、見えている判定の言葉と、判定の下に添えたわけ。判定の言葉はどれも同じ場所に重ね、見えていない言葉は読み上げから外す。
 * 重ねた言葉の中にさらに重ねた言葉があるときは、いちばん内側の見えている言葉を読む。
 * わけは、判定の言葉の後ろに空白で区切って続ける。
 */
function readCaptions(): string[] {
  return screen.getAllByRole("figure").map((figure) => {
    const caption = figure.querySelector("figcaption");
    const shown = [
      ...(caption?.querySelectorAll('[aria-hidden="false"]') ?? []),
    ]
      .filter(
        (layer) =>
          layer.parentElement?.closest('[aria-hidden="true"]') == null &&
          layer.querySelector('[aria-hidden="false"]') === null,
      )
      .map((layer) => layer.textContent);
    const reason = caption
      ?.querySelector("[data-how-to-play-verdict-reason]")
      ?.textContent?.replace("・", "");
    return [...shown, ...(reason ? [reason] : [])].join(" ");
  });
}

function getBoard(index: number): HTMLElement {
  const board = screen.getAllByRole("group", { name: "魔方陣の盤面" })[index];
  if (board === undefined) {
    throw new Error(`board ${index} is missing`);
  }
  return board;
}

function getCell(board: number, row: number, column: number): HTMLElement {
  return within(getBoard(board)).getByRole("button", {
    name: new RegExp(`^${row}行${column}列`),
  });
}

/** `board` 番目の盤面の下に並んだ数の札。 */
function getValue(value: number, board = 0): HTMLButtonElement {
  const pad = screen.getAllByRole("group", { name: "盤面の下に並んだ数" })[
    board
  ];
  if (pad === undefined) {
    throw new Error(`pad ${board} is missing`);
  }
  return within(pad).getByRole("button", { name: String(value) });
}

function readRowSum(board: number): string | undefined {
  return within(getBoard(board))
    .getAllByText(/^1行目の合計/)
    .map((label) => label.textContent ?? "")[0];
}

/** 手がかり（破線の枠と指）を付けた所の要素。 */
function findHinted(): Element[] {
  return [...document.querySelectorAll("[data-how-to-play-press-hint]")].map(
    (hint) => hint.closest("button") ?? hint,
  );
}

/** ✓ / ✕ の印を付けた所（マスか数の札）の読み上げ名と、印の向き。 */
function readMarks(): string[] {
  return [...document.querySelectorAll("[data-how-to-play-verdict-mark]")]
    .flatMap((mark) => {
      const button = mark.closest("button");
      return button === null
        ? []
        : [
            `${button.getAttribute("aria-label") ?? button.textContent} ${mark.getAttribute("data-how-to-play-verdict-mark")}`,
          ];
    })
    .map((text) => text.replace(/\s+/g, " "));
}

/** 手がかりの手が押す所の要素。マスは盤面での行と列の読み上げ名で、数の札はその盤面の下に並んだ数で探す。 */
function findPressTarget(press: MagicSquareExamplePress): Element {
  switch (press.kind) {
    case "cell":
      return getCell(
        press.board,
        Math.floor(press.cellIndex / 4) + 1,
        (press.cellIndex % 4) + 1,
      );
    case "value":
      return getValue(press.value, press.board);
    case "memo":
      return screen.getByRole("button", { name: "メモ" });
    case "undo":
      return screen.getByRole("button", { name: "待った" });
  }
}

/** 手がかりの手を順に押す。押す前に、その手の所だけに手がかりが付いていたかを返す。 */
function pressHints(hints: readonly MagicSquareExamplePress[]): boolean[] {
  return hints.map((press) => {
    const target = findPressTarget(press);
    const hinted = findHinted();
    fireEvent.click(target);
    return hinted.length === 1 && hinted[0] === target;
  });
}

function getResetButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

function renderExample(
  example: MagicSquareHowToPlayExample,
  caption?: "line" | "given" | "used-values" | "memo-limit",
) {
  render(
    <HowToPlayExamplePanel resettable>
      <TouchableExample example={example} caption={caption} />
    </HowToPlayExamplePanel>,
  );
}

describe("列の合計のルールの例を描いた場合", () => {
  beforeEach(() => {
    renderExample(lineRuleExample, "line");
  });

  test("最初は、そろった行をそろう、空きがあるのに合計に届いた行をそろわないとし、そろった行の右端に手がかりを付けること", () => {
    expect(
      screen.getAllByRole("group", { name: "盤面の下に並んだ数" }),
    ).toHaveLength(2);
    const captions = readCaptions();

    expect(captions).toEqual([
      "そろう",
      "そろわない 空きがあるのに合計に届いた",
    ]);
    expect(readRowSum(1)).toBe("1行目の合計 34 空きがあるのに合計に届いた");
    expect(findHinted()).toEqual([getCell(0, 1, 4)]);
    expect(getResetButton().disabled).toBe(true);
  });

  describe("手がかりのマスを選んだ場合", () => {
    beforeEach(() => {
      fireEvent.click(getCell(0, 1, 4));
    });

    test("マスを選んだ姿にし、手がかりをその盤面の下に並んだ数の札へ移し、元に戻すボタンを出すこと", () => {
      expect(getCell(0, 1, 4).getAttribute("aria-pressed")).toBe("true");
      expect(findHinted()).toEqual([getValue(12, 0)]);
      expect(getResetButton().disabled).toBe(false);
    });

    test("ほかの盤面の下に並んだ数を押すと、その盤面のマスを選んでいないので、受け付けずに盤面を変えず、手がかりを残すこと", () => {
      fireEvent.click(getValue(12, 1));

      expect(readRowSum(0)).toBe("1行目の合計 34 そろった");
      expect(readRowSum(1)).toBe("1行目の合計 34 空きがあるのに合計に届いた");
      expect(readPlayedSounds()).toEqual([expect.stringContaining("rejected")]);
      expect(findHinted()).toEqual([getValue(12, 0)]);
    });

    describe("手がかりの数を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getValue(12, 0));
      });

      test("置き換えた数で行の合計を出し直し、埋まって合計が合わないとしてそろわないにし、手がかりを消すこと", () => {
        expect(readRowSum(0)).toBe("1行目の合計 35 埋まって合計が合わない");
        expect(readCaptions()[0]).toBe("そろわない 埋まって合計が合わない");
        expect(findHinted()).toEqual([]);
      });

      test("本番の数を置く音を鳴らすこと", () => {
        const played = readPlayedSounds();

        expect(played).toHaveLength(1);
        expect(played[0]).toContain("placed");
      });

      test("元に戻すと、最初の判定と手がかりに戻ること", () => {
        fireEvent.click(getResetButton());

        expect(readCaptions()).toEqual([
          "そろう",
          "そろわない 空きがあるのに合計に届いた",
        ]);
        expect(findHinted()).toEqual([getCell(0, 1, 4)]);
        expect(getResetButton().disabled).toBe(true);
      });
    });
  });

  test("盤面の下に並んだ数は、盤面ごとに、その盤面にある数をくぼみにすること", () => {
    expect(getValue(16, 0).disabled).toBe(false);
    expect(getValue(16, 1).disabled).toBe(true);
    expect(getValue(5, 1).disabled).toBe(false);
  });

  test("そろった行の数を外すと、埋まり切らない途中の行として判定し直すこと", () => {
    fireEvent.click(getCell(0, 1, 4));
    fireEvent.click(getValue(11, 0));

    expect(readCaptions()[0]).toBe("途中");
  });

  test("ほかの盤面のマスを選ぶと、本番と同じく選んだマスを1つにし、前の盤面の選びを外すこと", () => {
    fireEvent.click(getCell(0, 1, 4));
    fireEvent.click(getCell(1, 1, 3));

    expect(
      [getCell(0, 1, 4), getCell(1, 1, 3)].map((cell) =>
        cell.getAttribute("aria-pressed"),
      ),
    ).toEqual(["false", "true"]);
  });

  test("そろわない行の空きに数を置いて埋めると、埋まって合計が合わない行として判定し直すこと", () => {
    fireEvent.click(getCell(1, 1, 3));
    fireEvent.click(getValue(1, 1));

    expect(readCaptions()[1]).toBe("そろわない 埋まって合計が合わない");
  });

  test("マスを選ぶ前に数を押すと、本番と同じく受け付けずに受け付けない音を鳴らすこと", () => {
    fireEvent.click(getValue(12));

    expect(readRowSum(0)).toBe("1行目の合計 34 そろった");
    expect(readPlayedSounds()).toEqual([expect.stringContaining("rejected")]);
  });
});

describe("数を1回ずつ使うルールの例を描いた場合", () => {
  beforeEach(() => {
    renderExample(usedValueRuleExample, "used-values");
  });

  test("最初は、盤面にある数の札に ✕、ほかの札に ✓ を付け、盤面にある数を押せなくし、両方の凡例を出すこと", () => {
    const marks = readMarks();

    expect(marks.filter((mark) => mark.endsWith("disallowed"))).toEqual([
      "4 disallowed",
      "5 disallowed",
      "14 disallowed",
    ]);
    expect(marks.filter((mark) => mark.endsWith(" allowed"))).toHaveLength(13);
    expect(getValue(4).disabled).toBe(true);
    expect(readCaptions()).toEqual(["まだ置ける、もう置いてある"]);
  });

  describe("空きのマスに手がかりの数を置いた場合", () => {
    beforeEach(() => {
      fireEvent.click(getCell(0, 1, 4));
      fireEvent.click(getValue(11));
    });

    test("行をそろった合計にし、置いた数の札を本番と同じく選んだマスの数として縁取り、印を付けないこと", () => {
      expect(readRowSum(0)).toBe("1行目の合計 34 そろった");
      expect(getValue(11).getAttribute("aria-pressed")).toBe("true");
      expect(readMarks().filter((mark) => mark.startsWith("11 "))).toEqual([]);
    });

    test("最初から置いてある数のマスを選ぶと、置いた数の札にも ✕ を付け、最初から置いてある数の札は ✕ のままにすること", () => {
      fireEvent.click(getCell(0, 1, 1));

      expect(readMarks().filter((mark) => mark.endsWith("disallowed"))).toEqual(
        ["4 disallowed", "5 disallowed", "11 disallowed", "14 disallowed"],
      );
    });
  });
});

describe("最初から置いてある数のルールの例を描いた場合", () => {
  beforeEach(() => {
    renderExample(givenRuleExample, "given");
  });

  test("最初は、最初から置いてある数に ✕、置いた数に ✓ を付け、両方の凡例を出し、最初から置いてある数に手がかりを付けること", () => {
    expect(readMarks()).toEqual([
      "1行1列 14 disallowed",
      "1行2列 4 disallowed",
      "1行3列 5 allowed",
    ]);
    expect(readCaptions()).toEqual(["変えられる、変えられない"]);
    expect(findHinted()).toEqual([getCell(0, 1, 1)]);
  });

  describe("最初から置いてある数を選んで手がかりの数を押した場合", () => {
    beforeEach(() => {
      fireEvent.click(getCell(0, 1, 1));
      fireEvent.click(getValue(6));
    });

    test("数を変えずに受け付けない音を鳴らし、凡例の場所にわけを出し、手がかりを置いた数のマスへ移すこと", () => {
      expect(getCell(0, 1, 1).getAttribute("aria-label")).toBe("1行1列 14");
      expect(readPlayedSounds()).toEqual([expect.stringContaining("rejected")]);
      expect(readCaptions()).toEqual(["最初から置いてある数"]);
      expect(findHinted()).toEqual([getCell(0, 1, 3)]);
    });

    test("置いた数のマスを選ぶと、わけを消して凡例に戻すこと", () => {
      fireEvent.click(getCell(0, 1, 3));

      expect(readCaptions()).toEqual(["変えられる、変えられない"]);
    });
  });

  test("置いた数を選んで別の数を押すと、置き換えて ✓ を付けたままにすること", () => {
    fireEvent.click(getCell(0, 1, 3));
    fireEvent.click(getValue(6));

    expect(readMarks()).toContain("1行3列 6 allowed");
  });
});

describe("メモの操作の例を描いてマスを選んだ場合", () => {
  beforeEach(() => {
    renderExample(memoOperationExample);
    fireEvent.click(getCell(0, 1, 3));
  });

  test("手がかりをメモのボタンへ移すこと", () => {
    expect(findHinted()).toEqual([
      screen.getByRole("button", { name: "メモ" }),
    ]);
  });

  test("本番と同じく、盤面の下に並んだ数の後ろに待った・メモの順にボタンを置くこと", () => {
    const pad = screen.getByRole("group", { name: "盤面の下に並んだ数" });
    const names = within(pad)
      .getAllByRole("button")
      .slice(-2)
      .map((button) => button.getAttribute("aria-label"));

    expect(names).toEqual(["待った", "メモ"]);
  });

  test("まだ盤面を変えていないので、待ったを押せなくすること", () => {
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "待った" })
        .disabled,
    ).toBe(true);
  });

  describe("メモに切り替えて数を押した場合", () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole("button", { name: "メモ" }));
      fireEvent.click(getValue(5));
    });

    test("1回目でメモを書き、本番のメモを書く音を鳴らし、同じ数に手がかりを残すこと", () => {
      expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe(
        "1行3列 空き メモ 5",
      );
      expect(readPlayedSounds().at(-1)).toContain("memo-written");
      expect(findHinted()).toEqual([getValue(5)]);
    });

    test("待ったを押すと、書いたメモを消して1つ前の盤面に戻すこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe("1行3列 空き");
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "待った" })
          .disabled,
      ).toBe(true);
    });

    test("2回目でメモを消し、本番のメモを消す音を鳴らし、手がかりをメモのボタンへ移すこと", () => {
      fireEvent.click(getValue(5));

      expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe("1行3列 空き");
      expect(readPlayedSounds().at(-1)).toContain("memo-erased");
      expect(findHinted()).toEqual([
        screen.getByRole("button", { name: "メモ" }),
      ]);
    });

    test("メモを消してからメモのボタンを押すと、数を置く入れ方に戻し、手がかりを消すこと", () => {
      fireEvent.click(getValue(5));
      fireEvent.click(screen.getByRole("button", { name: "メモ" }));
      fireEvent.click(getValue(5));

      expect(
        screen
          .getByRole("button", { name: "メモ" })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe("1行3列 5");
      expect(findHinted()).toEqual([]);
    });
  });
});

describe("メモの例で、4つ書いたマスに5つ目を書こうとした場合", () => {
  beforeEach(() => {
    renderExample(memoOperationExample, "memo-limit");
    fireEvent.click(getCell(0, 1, 3));
    fireEvent.click(screen.getByRole("button", { name: "メモ" }));
  });

  function readShownCaption(): string {
    return readCaptions()[0] ?? "";
  }

  test("4つ目までは、例の下に何も出さないこと", () => {
    for (const value of [1, 2, 3, 5]) {
      fireEvent.click(getValue(value));
    }

    expect(readShownCaption()).toBe("");
  });

  test("5つ目は本番と同じく受け付けずに受け付けない音を鳴らし、例の下にメモは4つまでと出すこと", () => {
    for (const value of [1, 2, 3, 5, 6]) {
      fireEvent.click(getValue(value));
    }

    expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe(
      "1行3列 空き メモ 1 2 3 5",
    );
    expect(readPlayedSounds().at(-1)).toContain("rejected");
    expect(readShownCaption()).toBe("メモは4つまで");
  });
});

describe("数を置くとメモが消える例を描いた場合", () => {
  beforeEach(() => {
    renderExample(memoClearedOperationExample);
    fireEvent.click(getCell(0, 1, 3));
    fireEvent.click(getValue(5));
  });

  test("置いた数と同じ数のメモを、ほかのマスからも消すこと", () => {
    expect(getCell(0, 1, 4).getAttribute("aria-label")).toBe(
      "1行4列 空き メモ 11",
    );
  });

  test("置いた数を外すと、そのマスのほかのメモが戻ること", () => {
    fireEvent.click(getValue(5));

    expect(getCell(0, 1, 3).getAttribute("aria-label")).toBe(
      "1行3列 空き メモ 11",
    );
  });
});

describe("置き換えの例で、手がかりどおりに置き換えてから同じ数を押した場合", () => {
  beforeEach(() => {
    renderExample(replaceOperationExample);
    fireEvent.click(getCell(0, 1, 4));
    fireEvent.click(getValue(11));
    fireEvent.click(getValue(11));
  });

  test("数を外して空きにし、外すときは本番と同じく音を鳴らさないこと", () => {
    expect(getCell(0, 1, 4).getAttribute("aria-label")).toBe("1行4列 空き");
    expect(readPlayedSounds()).toEqual([expect.stringContaining("placed")]);
  });
});

describe("置き方の例で、手がかりの後に残る空きも埋めた場合", () => {
  beforeEach(() => {
    renderExample(placeOperationExample);
    pressHints(placeOperationExample.hints);
    fireEvent.click(getCell(0, 3, 3));
    fireEvent.click(getValue(12));
  });

  test("本番と同じく、すべての列を合計にそろえてクリアの音を鳴らすこと", () => {
    expect(readRowSum(0)).toBe("1行目の合計 34 そろった");
    expect(playLayeredSound).toHaveBeenCalledTimes(1);
  });

  test("解き終えた後は、本番と同じくマスを押しても選ばないこと", () => {
    fireEvent.click(getCell(0, 1, 2));

    expect(getCell(0, 1, 2).getAttribute("aria-pressed")).not.toBe("true");
  });

  test("元に戻すと、解く前の最初の盤面に戻ること", () => {
    fireEvent.click(getResetButton());

    expect(getCell(0, 2, 2).getAttribute("aria-label")).toBe("2行2列 空き");
    expect(findHinted()).toEqual([getCell(0, 2, 2)]);
  });
});

describe.each([
  { name: "置き方", example: placeOperationExample },
  { name: "置き換え", example: replaceOperationExample },
  { name: "メモ", example: memoOperationExample },
  { name: "メモが消える", example: memoClearedOperationExample },
  { name: "列の合計", example: lineRuleExample },
  { name: "数を1回ずつ", example: usedValueRuleExample },
  { name: "最初から置いてある数", example: givenRuleExample },
])("$name の例を描いた場合", ({ example }) => {
  beforeEach(() => {
    renderExample(example);
  });

  test("手がかりの手を順に押すと、手がかりが押す所へ1つずつ移り、押し終えると消えること", () => {
    const hintedBeforeEachPress = pressHints(example.hints);

    expect(hintedBeforeEachPress.every(Boolean)).toBe(true);
    expect(findHinted()).toEqual([]);
    expect(getResetButton().disabled).toBe(false);
  });

  describe("手がかりの手を押し終えた場合", () => {
    beforeEach(() => {
      pressHints(example.hints);
    });

    test("元に戻すと、元に戻すボタンを押せなくし、最初の手がかりに戻ること", () => {
      fireEvent.click(getResetButton());

      const [first] = example.hints;
      expect(getResetButton().disabled).toBe(true);
      expect(findHinted()).toEqual(
        first === undefined ? [] : [findPressTarget(first)],
      );
    });
  });
});
