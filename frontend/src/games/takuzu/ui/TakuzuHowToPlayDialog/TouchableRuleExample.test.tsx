import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { VIOLATION_MARK_DELAY_MS } from "@/games/takuzu/ui/board/violation-mark-timing";
import {
  countRuleExamples,
  duplicateRuleExamples,
  runRuleExamples,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { TouchableRuleExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableRuleExample";
import { playSound, type SoundEffect } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(playSound).mockClear();
});

/** 遊び方と同じく、元に戻すボタンを持つ面に置いて描く。 */
function renderInPanel(example: ReactNode) {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

/** 違反の印が出るのを待つ。 */
function waitForMarks() {
  act(() => {
    vi.advanceTimersByTime(VIOLATION_MARK_DELAY_MS);
  });
}

function press(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** 例の判定の言葉。図の名前は、見えている判定の言葉から付く。 */
function readVerdict(): string | null {
  return (
    ["できない", "できる", "途中"].find(
      (verdict) =>
        screen.queryByRole("figure", { name: new RegExp(`^${verdict}`) }) !==
        null,
    ) ?? null
  );
}

function readCellNames(): string[] {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((name) => /^\d行\d列/.test(name));
}

function readHintedCells(): string[] {
  return readCellNames().filter((name) => name.includes("押すと"));
}

/** 鳴らした音の、音声ファイルの名前。 */
function listPlayedSounds(): (string | undefined)[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(
      ([sound]) => (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
    );
}

function isResetDisabled(): boolean {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

describe("TouchableRuleExample", () => {
  describe("3つ続けないのできる形の場合", () => {
    const board = runRuleExamples[0]?.board ?? { rows: [] };

    beforeEach(() => {
      renderInPanel(<TouchableRuleExample board={board} rule="run" />);
    });

    test("触る前は、✓ できる を添え、押す所のマスに、押すとなる丸を示すこと", () => {
      const verdict = readVerdict();
      const cells = readCellNames();

      expect(verdict).toBe("できる");
      expect(cells).toEqual(["1行1列 丸", "1行2列 丸", "1行3列 四角 押すと丸"]);
      expect(isResetDisabled()).toBe(true);
    });

    test("押す所を押すと、印と同じ時間だけ待ってから ✕ できない に替わり、手がかりが消えること", () => {
      press(/^1行3列 四角/);
      const beforeMarks = readVerdict();
      waitForMarks();

      expect(beforeMarks).toBe("できる");
      expect(readVerdict()).toBe("できない");
      expect(readCellNames()).toEqual([
        "1行1列 丸 3連続",
        "1行2列 丸 3連続",
        "1行3列 丸 3連続",
      ]);
      expect(isResetDisabled()).toBe(false);
    });

    test("素早く2回押して、反した姿を通り過ぎると、✕ できない を出さないこと", () => {
      press(/^1行3列 四角/);
      act(() => {
        vi.advanceTimersByTime(VIOLATION_MARK_DELAY_MS - 1);
      });
      const midway = readVerdict();
      press(/^1行3列 丸/);
      waitForMarks();

      expect(midway).toBe("できる");
      expect(readVerdict()).toBe("できる");
    });

    test("押し続けて最初の形に戻ると、手がかりが戻り、元に戻すが消えること", () => {
      press(/^1行3列 四角/);
      press(/^1行3列 丸/);
      const resetDisabledMidway = isResetDisabled();
      press(/^1行3列 空き/);

      expect(resetDisabledMidway).toBe(false);
      expect(readCellNames()).toContain("1行3列 四角 押すと丸");
      expect(isResetDisabled()).toBe(true);
    });

    test("押すたびに、本番と同じ置いた音と空きにした音を鳴らすこと", () => {
      press(/^1行3列 四角/);
      press(/^1行3列 丸/);
      press(/^1行3列 空き/);

      const sounds = listPlayedSounds();

      expect(sounds).toEqual(["tile-b-placed", "emptied", "tile-a-placed"]);
    });

    test("マウスの右クリックでは、本番と同じく逆の順に変わること", () => {
      const third = screen.getByRole("button", { name: /^1行3列 四角/ });

      fireEvent.pointerDown(third, { pointerType: "mouse" });
      fireEvent.contextMenu(third);

      expect(readCellNames()).toContain("1行3列 空き");
      expect(isResetDisabled()).toBe(false);
    });

    describe("押す所を押して反した姿にした場合", () => {
      beforeEach(() => {
        press(/^1行3列 四角/);
        waitForMarks();
        vi.mocked(playSound).mockClear();
      });

      test("押してルールに反さなくなると、すぐ ✓ できる に戻ること", () => {
        press(/^1行3列 丸/);

        expect(readVerdict()).toBe("できる");
        expect(readCellNames()).toEqual([
          "1行1列 丸",
          "1行2列 丸",
          "1行3列 空き",
        ]);
      });

      test("元に戻すと、最初の形と ✓ できる に戻り、元に戻すが消えること", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        expect(readVerdict()).toBe("できる");
        expect(readCellNames()).toContain("1行3列 四角 押すと丸");
        expect(isResetDisabled()).toBe(true);
      });

      test("元に戻すでは音を鳴らさないこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        const sounds = listPlayedSounds();

        expect(sounds).toEqual([]);
      });
    });
  });

  describe("4つずつのできる形の場合", () => {
    const board = countRuleExamples[0]?.board ?? { rows: [] };

    beforeEach(() => {
      renderInPanel(
        <TouchableRuleExample
          board={board}
          rule="overfilled"
          showsTileCounts
        />,
      );
    });

    test("触る前は、✓ できる と四角と丸の4つずつを添え、押すと丸が5つになる四角に手がかりを付けること", () => {
      const figure = screen.queryByRole("figure", { name: /^できる/ });

      expect(figure?.textContent).toMatch(/44$/);
      expect(readHintedCells()).toEqual(["1行5列 四角 押すと丸"]);
      expect(isResetDisabled()).toBe(true);
    });

    test("押す所を押すと、本番の判定で行の個数超過が付き、✕ できない になり、手がかりが消えること", () => {
      press(/押すと丸$/);
      waitForMarks();

      expect(readVerdict()).toBe("できない");
      expect(
        readCellNames().every((name) => name.endsWith("行の個数超過")),
      ).toBe(true);
      expect(readHintedCells()).toEqual([]);
    });

    test("押す所を押すと、数も ✓ / ✕ と同じく、印と同じ時間だけ待ってから替わること", () => {
      press(/押すと丸$/);
      const beforeMarks = screen.getByRole("figure", {
        name: /^できる/,
      }).textContent;
      waitForMarks();
      const afterMarks = screen.getByRole("figure", {
        name: /^できない/,
      }).textContent;

      expect(beforeMarks).toMatch(/44$/);
      expect(afterMarks).toMatch(/35$/);
    });

    test("1マス空けると、✓ を出さずに 途中 と、空けた後の数を添えること", () => {
      press(/^1行5列 四角/);
      press(/^1行5列 丸/);
      waitForMarks();

      const figure = screen.queryByRole("figure", { name: /^途中/ });

      expect(readVerdict()).toBe("途中");
      expect(figure?.textContent).toMatch(/34$/);
    });

    test("押し続けて最初の形に戻ると、✓ できる と手がかりが戻ること", () => {
      press(/^1行5列 四角/);
      press(/^1行5列 丸/);
      press(/^1行5列 空き/);

      expect(readVerdict()).toBe("できる");
      expect(readCellNames()).toContain("1行5列 四角 押すと丸");
    });
  });

  describe("同じ並びの例の場合", () => {
    function readMarkedCells(): string[] {
      return readCellNames()
        .filter((name) => name.endsWith("もう1行と違う"))
        .map((name) => name.split(" ")[0] ?? "");
    }

    describe("できる形の場合", () => {
      beforeEach(() => {
        renderInPanel(
          <TouchableRuleExample
            board={duplicateRuleExamples[0]?.board ?? { rows: [] }}
            rule="duplicate"
            marksRowDifferences
          />,
        );
      });

      test("触る前から、✓ できる を添え、2つの行で違う列に見比べる所の印を付けること", () => {
        const verdict = readVerdict();
        const markedCells = readMarkedCells();
        const hintedCells = readHintedCells();

        expect(verdict).toBe("できる");
        expect(markedCells).toEqual(["1行4列", "1行6列", "2行4列", "2行6列"]);
        expect(hintedCells).toEqual([]);
      });

      test("見比べる所の印の凡例を見せること", () => {
        const hidden = screen
          .getByText("違う所")
          .classList.contains("invisible");

        expect(hidden).toBe(false);
      });
    });

    describe("触ってできない形にする例の場合", () => {
      beforeEach(() => {
        renderInPanel(
          <TouchableRuleExample
            board={duplicateRuleExamples[1]?.board ?? { rows: [] }}
            rule="duplicate"
            marksRowDifferences
          />,
        );
      });

      test("触る前は、✓ を出さずに 途中 を添え、1つ目の空きにだけ手がかりを付けること", () => {
        const verdict = readVerdict();
        const hintedCells = readHintedCells();
        const markedCells = readMarkedCells();

        expect(verdict).toBe("途中");
        expect(hintedCells).toEqual(["2行3列 空き 押すと四角"]);
        expect(markedCells).toEqual([]);
      });

      test("見比べる所の印が無い間は、凡例の場所だけを取って隠すこと", () => {
        const hidden = screen
          .getByText("違う所")
          .classList.contains("invisible");

        expect(hidden).toBe(true);
      });

      test("手がかりどおりに左から1回ずつ押すと、1つ押した後は次の空きに手がかりが移り、最後に同じ並びの印と ✕ できない が付くこと", () => {
        press(/^2行3列 空き/);
        waitForMarks();
        const midwayVerdict = readVerdict();
        const midwayHints = readHintedCells();
        press(/押すと四角$/);
        waitForMarks();

        expect(midwayVerdict).toBe("途中");
        expect(midwayHints).toEqual(["2行7列 空き 押すと四角"]);
        expect(readVerdict()).toBe("できない");
        expect(
          screen.queryByRole("figure", { name: /^できない$/ }),
        ).not.toBeNull();
        expect(readCellNames().every((name) => name.includes("行の重複"))).toBe(
          true,
        );
        expect(readHintedCells()).toEqual([]);
        expect(readMarkedCells()).toEqual([]);
      });
    });
  });

  describe.each([
    {
      name: "3つ続くできない形",
      examples: runRuleExamples,
      rule: "run",
      initialMark: "3連続",
      pressed: /^3行1列 四角/,
    },
    {
      name: "4つずつのできない形",
      examples: countRuleExamples,
      rule: "overfilled",
      initialMark: "行の個数超過",
      pressed: /^1行1列 四角/,
    },
  ] as const)("$nameの場合", ({ examples, rule, initialMark, pressed }) => {
    const disallowed = examples.find(({ verdict }) => verdict === "disallowed");

    beforeEach(() => {
      renderInPanel(
        <TouchableRuleExample
          board={disallowed?.board ?? { rows: [] }}
          rule={rule}
        />,
      );
    });

    test("触る前は、本番の判定の印と ✕ できない を添えること", () => {
      const verdict = readVerdict();
      const marked = readCellNames().some((name) => name.includes(initialMark));

      expect(verdict).toBe("できない");
      expect(marked).toBe(true);
    });

    test("押してそのルールに反さなくなると、待たずに ✓ できる に替わること", () => {
      press(pressed);

      expect(readVerdict()).toBe("できる");
      expect(readCellNames().some((name) => name.includes(initialMark))).toBe(
        false,
      );
    });
  });

  describe("例が教えるルールとは別のルールに反した場合", () => {
    describe.each([
      {
        name: "4つずつの例で3つ続く",
        board: countRuleExamples[0]?.board ?? { rows: [] },
        rule: "overfilled",
        presses: [/^1行7列/],
        reason: "3つ以上続いている",
      },
      {
        name: "同じ並びの例で丸が多い",
        board: duplicateRuleExamples[0]?.board ?? { rows: [] },
        rule: "duplicate",
        presses: [/^1行1列/],
        reason: "丸が5つ",
      },
      {
        name: "同じ並びの例で四角が多い",
        board: duplicateRuleExamples[0]?.board ?? { rows: [] },
        rule: "duplicate",
        presses: [/^2行4列/, /^2行4列/],
        reason: "四角が5つ",
      },
      {
        name: "同じ並びの例で3つ続いて丸も多い",
        board: duplicateRuleExamples[1]?.board ?? { rows: [] },
        rule: "duplicate",
        presses: [/^2行7列/, /^2行7列/],
        reason: "3つ以上続いている・丸が5つ",
      },
      {
        name: "3つ続けないを教える2行の例で同じ並び",
        board: { rows: ["abaabbab", "abaabba."] },
        rule: "run",
        presses: [/^2行8列/, /^2行8列/],
        reason: "同じ並び",
      },
    ] as const)("$nameの場合", ({ board, rule, presses, reason }) => {
      beforeEach(() => {
        renderInPanel(<TouchableRuleExample board={board} rule={rule} />);
      });

      test("✕ できない の下に、破ったルールを添えること", () => {
        for (const name of presses) {
          press(name);
        }
        waitForMarks();

        const figure = screen.queryByRole("figure", {
          name: `できない・${reason}`,
        });

        expect(figure).not.toBeNull();
      });
    });
  });
});
