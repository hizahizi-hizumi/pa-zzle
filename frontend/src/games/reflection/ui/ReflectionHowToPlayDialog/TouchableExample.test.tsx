import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  blackHoleRuleExamples,
  completionRuleExample,
  countRuleExamples,
  exitRuleExamples,
  mirrorRuleExamples,
  moveOperationExample,
  type ReflectionHowToPlayExample,
  reflectorRuleExamples,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import {
  _private,
  TouchableExample,
  type TouchableExampleCaption,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/TouchableExample";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

const { describeLight } = _private;

const leftEntry = { side: "left", index: 0 } as const;

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(
  example: ReflectionHowToPlayExample,
  caption?: TouchableExampleCaption,
): void {
  render(
    <HowToPlayExamplePanel resettable>
      <TouchableExample example={example} caption={caption} />
    </HowToPlayExamplePanel>,
  );
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "リフレクション盤面" });
}

function getClue(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

/** 描いている外周の数字の読み上げ名。外周の数字は盤面のマスの group の外に並ぶので、画面全体から名前の形で探す。 */
function readClueLabels(): (string | null)[] {
  return screen
    .queryAllByRole("button", { name: /^(上|下|左|右)\d+(行|列) / })
    .map((clue) => clue.getAttribute("aria-label"));
}

/** 手がかりを付けた所の読み上げ名。 */
function readHintedLabels(): (string | null)[] {
  return Array.from(
    document.querySelectorAll("[data-how-to-play-press-hint]"),
  ).map((hint) => hint.closest("button")?.getAttribute("aria-label") ?? null);
}

function isResetShown(): boolean {
  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
    hidden: true,
  });
  return !button.disabled;
}

describe("TouchableExample", () => {
  describe("合うかの例の場合", () => {
    beforeEach(() => {
      renderInPanel(countRuleExamples[1], "match");
    });

    test("本番の判定で、判定する数字が合わないと言うこと", () => {
      const figure = screen.getByRole("figure", { name: "合わない" });

      expect(figure).toBeTruthy();
    });

    test("描く数字だけに絞ること", () => {
      const clues = readClueLabels();

      expect(clues).toEqual(["上2列 退出 2マス", "左1行 退出 2マス"]);
    });

    test("手がかりを判定する数字に付けること", () => {
      const hinted = readHintedLabels();

      expect(hinted).toEqual(["左1行 退出 2マス"]);
    });

    describe("判定する数字を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getClue(/^左1行/));
      });

      test("本番と同じく光路を出し、今の光が通るマスの数を添えること", () => {
        const clue = getClue(/^左1行/);

        expect(clue.getAttribute("aria-pressed")).toBe("true");
        expect(clue.getAttribute("aria-description")).toBe("今の光 退出 3マス");
      });

      test("手を打ち終えたので手がかりを消すこと", () => {
        const hinted = readHintedLabels();

        expect(hinted).toEqual([]);
      });

      test("元に戻すボタンを出すこと", () => {
        const shown = isResetShown();

        expect(shown).toBe(true);
      });
    });
  });

  describe("光の進み方の例の場合", () => {
    beforeEach(() => {
      renderInPanel(mirrorRuleExamples[1], "light");
    });

    test("判定する数字の光が今の盤面でどう進むかを、入れた辺から言うこと", () => {
      const caption = screen.getByText("上から3マスで右へ出る");

      expect(caption).toBeTruthy();
    });

    describe("鏡を選んで別のマスへ移した場合", () => {
      beforeEach(() => {
        const board = getBoard();
        fireEvent.click(within(board).getByRole("button", { name: /^2行2列/ }));
        fireEvent.click(within(board).getByRole("button", { name: /^2行3列/ }));
      });

      test("今の盤面から言い直すこと", () => {
        const caption = screen.getByText("上から3マスで下へ出る");

        expect(caption).toBeTruthy();
      });

      test("本番と同じく置いた音を鳴らすこと", () => {
        expect(playSound).toHaveBeenCalledTimes(1);
      });
    });

    describe("鏡を移してから元のマスへ戻した場合", () => {
      beforeEach(() => {
        const board = getBoard();
        for (const name of [/^2行2列/, /^2行3列/, /^2行3列/, /^2行2列/]) {
          fireEvent.click(within(board).getByRole("button", { name }));
        }
      });

      test("揃っても完成に入らず、完成の音を鳴らさずに盤面を押せるままにすること", () => {
        const cell = within(getBoard()).getByRole<HTMLButtonElement>("button", {
          name: "1行1列 空き",
        });

        expect(cell.disabled).toBe(false);
        expect(playLayeredSound).not.toHaveBeenCalled();
      });
    });
  });

  describe("手がかりの無い数字を押した場合", () => {
    beforeEach(() => {
      renderInPanel(reflectorRuleExamples[1], "light");
      fireEvent.click(getClue(/^上3列/));
    });

    test("例の下の言葉を、光路を出した数字のことに言い直すこと", () => {
      const caption = screen.getByText("上から3マスで戻る");

      expect(caption).toBeTruthy();
    });
  });

  describe("出た先の数字が違って合わない例の場合", () => {
    beforeEach(() => {
      renderInPanel(exitRuleExamples[1], "match");
    });

    test("✕ 合わないと言い、判定の下に出た先の数字を添えること", () => {
      const figure = screen.getByRole("figure", {
        name: "合わない・出た先の数字は2",
      });

      expect(figure).toBeTruthy();
    });
  });

  describe("完成の例の場合", () => {
    beforeEach(() => {
      renderInPanel(completionRuleExample, "completion");
    });

    test("手持ちが残る間は途中と言うこと", () => {
      const figure = screen.getByRole("figure", { name: "途中" });

      expect(figure).toBeTruthy();
    });

    test("手がかりをストックのブラックホールに付けること", () => {
      const hinted = readHintedLabels();

      expect(hinted).toEqual(["ブラックホール 残り1"]);
    });

    describe("例が見せる手のとおりに置いた場合", () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "ブラックホール 残り1" }),
        );
        fireEvent.click(
          within(getBoard()).getByRole("button", { name: "3行2列 空き" }),
        );
      });

      test("本番の判定で完成と言うこと", () => {
        const figure = screen.getByRole("figure", { name: "完成" });

        expect(figure).toBeTruthy();
      });

      test("本番と同じく完成の音を鳴らすこと", () => {
        expect(playLayeredSound).toHaveBeenCalledTimes(1);
      });

      test("本番と同じく、完成した盤面を押せなくすること", () => {
        const cell = within(getBoard()).getByRole<HTMLButtonElement>("button", {
          name: "1行1列 空き",
        });

        expect(cell.disabled).toBe(true);
      });
    });
  });

  describe("最初からピースを置いた例の場合", () => {
    beforeEach(() => {
      renderInPanel(moveOperationExample);
    });

    test("最初から置いてあるピースは、現れる動き無しで描くこと", () => {
      const cell = within(getBoard()).getByRole("button", { name: /^1行1列/ });

      const appearing = cell.querySelector("[data-appearing]");

      expect(appearing).toBeNull();
    });

    describe("ピースを別のマスへ移した場合", () => {
      beforeEach(() => {
        const board = getBoard();
        fireEvent.click(within(board).getByRole("button", { name: /^1行1列/ }));
        fireEvent.click(within(board).getByRole("button", { name: /^1行3列/ }));
      });

      test("置いた手のピースは、本番と同じく現れる動きで描くこと", () => {
        const cell = within(getBoard()).getByRole("button", {
          name: /^1行3列/,
        });

        const appearing = cell.querySelector("[data-appearing]");

        expect(appearing).not.toBeNull();
      });
    });
  });

  describe("操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(moveOperationExample);
    });

    test("外周の数字を描かないこと", () => {
      const clues = readClueLabels();

      expect(clues).toEqual([]);
    });

    describe("端のマスにフォーカスを置いた場合", () => {
      let cell: HTMLElement;

      beforeEach(() => {
        cell = within(getBoard()).getByRole("button", { name: /^1行1列/ });
        cell.focus();
      });

      test("描いていない外周の数字の方へ矢印キーを押しても、フォーカスの置き場所を動かさないこと", () => {
        fireEvent.keyDown(cell, { key: "ArrowLeft" });
        fireEvent.keyDown(document.activeElement ?? cell, {
          key: "ArrowRight",
        });

        const focused = document.activeElement?.getAttribute("aria-label");

        expect(cell.tabIndex).toBe(-1);
        expect(focused).toBe("1行2列 空き");
      });
    });

    describe("ピースを選んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(
          within(getBoard()).getByRole("button", { name: /^1行1列/ }),
        );
      });

      test("手がかりを次に押すマスへ移すこと", () => {
        const hinted = readHintedLabels();

        expect(hinted).toEqual(["1行3列 空き"]);
      });

      test("選んだだけでは元に戻すボタンを出さないこと", () => {
        const shown = isResetShown();

        expect(shown).toBe(false);
      });
    });

    describe("ピースを移してから元に戻した場合", () => {
      beforeEach(() => {
        const board = getBoard();
        fireEvent.click(within(board).getByRole("button", { name: /^1行1列/ }));
        fireEvent.click(within(board).getByRole("button", { name: /^1行3列/ }));
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));
      });

      test("始まりの盤面に戻し、最初の手がかりをまた出すこと", () => {
        const hinted = readHintedLabels();

        expect(hinted).toEqual(["1行1列 右上がりの鏡"]);
      });
    });
  });
});

describe("describeLight", () => {
  const cases = [
    [
      "出る光は、入れた辺と通るマスの数と出る辺を言うこと",
      mirrorRuleExamples[1].board,
      mirrorRuleExamples[1].focusEntry ?? leftEntry,
      "上から3マスで右へ出る",
    ],
    [
      "戻る光は、入れた辺と戻るまでのマスの数を言うこと",
      reflectorRuleExamples[1].board,
      reflectorRuleExamples[1].focusEntry ?? leftEntry,
      "左から5マスで戻る",
    ],
    [
      "吸い込まれる光は、入れた辺と吸い込まれるマスまでの数を言うこと",
      blackHoleRuleExamples[0].board,
      blackHoleRuleExamples[0].focusEntry ?? leftEntry,
      "左から2マス目で吸い込まれる",
    ],
  ] as const;

  test.each(cases)("%s", (_, board, entry, expected) => {
    const { text } = describeLight(board, entry);

    expect(text).toBe(expected);
  });
});
