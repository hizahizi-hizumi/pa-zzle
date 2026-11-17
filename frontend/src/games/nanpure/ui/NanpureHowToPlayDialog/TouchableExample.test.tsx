import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import type { NanpureExamplePress } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-hint";
import {
  completedDigitAssistExample,
  enterOperationExample,
  eraseOperationExample,
  givenRuleExample,
  mistakeAssistExample,
  type NanpureHowToPlayExample,
  notesClearedAssistExample,
  notesOperationExample,
  replaceOperationExample,
  rowRuleExample,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/nanpure/ui/NanpureHowToPlayDialog/TouchableExample";
import { playSound } from "@/lib/audio/sound-effects";

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
});

/** 例ごとの、見えている判定の言葉。判定の言葉はどれも同じ場所に重ね、見えていない言葉は読み上げから外す。 */
function readVerdicts(): string[] {
  return screen
    .getAllByRole("figure")
    .map(
      (figure) =>
        figure.querySelector('figcaption [aria-hidden="false"]')?.textContent ??
        "",
    );
}

function getBoard(index: number): HTMLElement {
  const board = screen
    .getAllByRole("group")
    .filter((group) => group.tagName !== "FIELDSET")[index];
  if (board === undefined) {
    throw new Error(`board ${index} is missing`);
  }
  return board;
}

function getDigit(digit: number): HTMLButtonElement {
  return within(screen.getByRole("group", { name: "数字入力" })).getByText(
    String(digit),
  ) as HTMLButtonElement;
}

/** 手がかり（破線の枠と指）を付けた所の要素。 */
function findHinted(): Element[] {
  return [...document.querySelectorAll("[data-how-to-play-press-hint]")].map(
    (hint) => hint.closest("button") ?? hint,
  );
}

/** 手がかりの手が押す所の要素。マスは、範囲の中の行と列の読み上げ名で探す。 */
function findPressTarget(
  example: NanpureHowToPlayExample,
  press: NanpureExamplePress,
): Element {
  switch (press.kind) {
    case "cell": {
      const region = example.boards[press.board]?.region;
      if (region === undefined) {
        throw new Error(`board ${press.board} is missing`);
      }
      const row = Math.floor(press.cellIndex / 9) - region.row + 1;
      const column = (press.cellIndex % 9) - region.column + 1;
      return within(getBoard(press.board)).getByRole("button", {
        name: new RegExp(`^${row}行${column}列`),
      });
    }
    case "digit":
      return getDigit(press.digit);
    case "erase":
      return screen.getByRole("button", { name: "消す" });
    case "notes":
      return screen.getByRole("button", { name: "メモ" });
  }
}

function getResetButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

describe("形のルールの例を描いた場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={rowRuleExample} caption="unit" />
      </HowToPlayExamplePanel>,
    );
  });

  test("最初は、できる形とできない形の判定を出し、できる形の入れた数字に手がかりを付けること", () => {
    const verdicts = readVerdicts();
    const hinted = findHinted();

    expect(verdicts).toEqual(["できる", "できない"]);
    expect(hinted).toEqual([
      within(getBoard(0)).getByRole("button", { name: /^1行5列、2/ }),
    ]);
    expect(getResetButton().disabled).toBe(true);
  });

  describe("手がかりのマスを選んだ場合", () => {
    beforeEach(() => {
      fireEvent.click(
        within(getBoard(0)).getByRole("button", { name: /^1行5列/ }),
      );
    });

    test("マスを選んだ姿にし、手がかりを数字のボタンへ移し、元に戻すボタンを出すこと", () => {
      const cell = within(getBoard(0)).getByRole("button", {
        name: /^1行5列/,
      });
      const hinted = findHinted();

      expect(cell.getAttribute("aria-pressed")).toBe("true");
      expect(hinted).toEqual([getDigit(6)]);
      expect(getResetButton().disabled).toBe(false);
    });

    describe("手がかりの数字を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getDigit(6));
      });

      test("重なった数字に本番と同じ印を付け、できない判定にし、手がかりを消すこと", () => {
        const conflicted = within(getBoard(0))
          .getAllByRole("button")
          .filter((cell) => cell.getAttribute("aria-invalid") === "true")
          .map((cell) => cell.getAttribute("aria-label"));
        const verdicts = readVerdicts();

        expect(conflicted).toEqual([
          "1行1列、6、初期ヒント、競合",
          "1行5列、6、誤り、競合",
        ]);
        expect(verdicts).toEqual(["できない", "できない"]);
        expect(findHinted()).toEqual([]);
      });

      test("答えと違う数字を入れた本番のミスの音を鳴らすこと", () => {
        const played = vi
          .mocked(playSound)
          .mock.calls.map(
            ([sound]) => (sound as unknown as { url: string }).url,
          );

        expect(played).toHaveLength(1);
        expect(played[0]).toContain("mistake-entered");
      });

      test("元に戻すと、最初の姿と手がかりに戻ること", () => {
        fireEvent.click(getResetButton());

        expect(readVerdicts()).toEqual(["できる", "できない"]);
        expect(findHinted()).toHaveLength(1);
        expect(getResetButton().disabled).toBe(true);
      });
    });
  });

  describe("できない形の重なった数字を答えに入れ替えた場合", () => {
    beforeEach(() => {
      fireEvent.click(
        within(getBoard(1)).getByRole("button", { name: /^1行9列/ }),
      );
      fireEvent.click(getDigit(4));
    });

    test("できる判定に替わること", () => {
      const verdicts = readVerdicts();

      expect(verdicts).toEqual(["できる", "できる"]);
    });
  });
});

describe("最初からある数字のルールの例を描いた場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={givenRuleExample} caption="given" />
      </HowToPlayExamplePanel>,
    );
  });

  test("最初は、手がかりの最初からある数字の答えとして変えられない判定を出すこと", () => {
    const verdicts = readVerdicts();

    expect(verdicts).toEqual(["変えられない"]);
  });

  test("最初からある数字を選ぶと、数字のボタンを押せなくし、手がかりを消すこと", () => {
    fireEvent.click(screen.getByRole("button", { name: /^1行1列/ }));

    expect(getDigit(1).disabled).toBe(true);
    expect(readVerdicts()).toEqual(["変えられない"]);
    expect(findHinted()).toEqual([]);
  });

  describe("入れた数字を、ブロックの最初からある数字と同じ数字に変えた場合", () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole("button", { name: /^1行2列/ }));
      fireEvent.click(getDigit(7));
    });

    test("変えられる判定のまま、ブロックで重なることを判定の下に添えること", () => {
      const caption = screen.getByRole("figure").querySelector("figcaption");

      expect(readVerdicts()).toEqual(["変えられる"]);
      expect(caption?.textContent).toContain("ブロックで重なる");
    });
  });

  test("最初は、別のルールで重なったことを添えないこと", () => {
    const caption = screen.getByRole("figure").querySelector("figcaption");

    expect(caption?.textContent).not.toContain("重なる");
  });

  test("入れた数字を選ぶと、数字のボタンを押せるようにし、変えられる判定にすること", () => {
    fireEvent.click(screen.getByRole("button", { name: /^1行2列/ }));

    expect(getDigit(1).disabled).toBe(false);
    expect(readVerdicts()).toEqual(["変えられる"]);
  });
});

describe("メモの操作の例を描いてマスを選んだ場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={notesOperationExample} />
      </HowToPlayExamplePanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^1行2列/ }));
  });

  test("手がかりをメモのボタンへ移すこと", () => {
    const hinted = findHinted();

    expect(hinted).toEqual([screen.getByRole("button", { name: "メモ" })]);
  });

  describe("メモをオンにして数字を2回押した場合", () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole("button", { name: "メモ" }));
      fireEvent.click(getDigit(4));
    });

    test("1回目でメモを書き、本番のメモを書く音を鳴らし、同じ数字に手がかりを残すこと", () => {
      const cell = screen.getByRole("button", { name: /^1行2列/ });
      const played = vi
        .mocked(playSound)
        .mock.calls.map(([sound]) => (sound as unknown as { url: string }).url);

      expect(cell.getAttribute("aria-label")).toBe(
        "1行2列、空き、メモ 1、3、4",
      );
      expect(played.at(-1)).toContain("note-added");
      expect(findHinted()).toEqual([getDigit(4)]);
    });

    test("2回目でメモを消し、手がかりを消すこと", () => {
      fireEvent.click(getDigit(4));

      const label = screen
        .getByRole("button", { name: /^1行2列/ })
        .getAttribute("aria-label");
      expect(label).toBe("1行2列、空き、メモ 1、3");
      expect(findHinted()).toEqual([]);
    });
  });
});

describe.each([
  { name: "入れ方", example: enterOperationExample },
  { name: "入れ替え", example: replaceOperationExample },
  { name: "答えと違う数字", example: mistakeAssistExample },
  { name: "9つそろった数字", example: completedDigitAssistExample },
  { name: "メモが消える", example: notesClearedAssistExample },
  { name: "消し方", example: eraseOperationExample },
  { name: "メモ", example: notesOperationExample },
])("$name の例を描いた場合", ({ example }) => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={example} />
      </HowToPlayExamplePanel>,
    );
  });

  test("手がかりの手を順に押すと、手がかりが押す所へ1つずつ移り、押し終えると消えること", () => {
    const hintedBeforeEachPress = example.hints.map((press) => {
      const target = findPressTarget(example, press);
      const hinted = findHinted();
      fireEvent.click(target);
      return hinted.length === 1 && hinted[0] === target;
    });

    expect(hintedBeforeEachPress.every(Boolean)).toBe(true);
    expect(findHinted()).toEqual([]);
    expect(getResetButton().disabled).toBe(false);
  });

  describe("手がかりの手を押し終えた場合", () => {
    beforeEach(() => {
      for (const press of example.hints) {
        fireEvent.click(findPressTarget(example, press));
      }
    });

    test("元に戻すと、元に戻すボタンを押せなくし、最初の手がかりに戻ること", () => {
      fireEvent.click(getResetButton());

      const [first] = example.hints;
      expect(getResetButton().disabled).toBe(true);
      expect(findHinted()).toEqual(
        first === undefined ? [] : [findPressTarget(example, first)],
      );
    });
  });
});
