import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { ReactElement } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  amountRuleExamples,
  completeRuleExamples,
  destinationRuleExamples,
  pourDestinationExample,
  pourOperationExample,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
} from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

/** ボトルの揺れ。動かした要素を記録する。注ぐ動きは、終わらないまま止められたことだけを記録する。 */
const animate = vi.fn(function createUnfinishedAnimation(): Animation {
  return {
    finished: new Promise(() => {}),
    cancel: vi.fn(),
  } as unknown as Animation;
});

beforeEach(() => {
  animate.mockClear();
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

/**
 * 例の図を、読み上げの名前で探す。図の名前は、図に添えた言葉（判定・わけ・量・各ボトルの答え）のうち、見えているものから付く。
 * 見つからなければ `null`。
 */
function queryFigure(name: string): HTMLElement | null {
  return screen.queryByRole("figure", { name });
}

/** 各候補の下に添えた、注げるかの答え。 */
function readDestinationAnswers(): (string | null)[] {
  return within(screen.getByRole("figure"))
    .queryAllByText(/^ボトル \d+: 注げ/)
    .map((answer) => answer.textContent);
}

/** 答えの下に添えた、✓ と ✕ の言葉の行が見えているか。隠すときは場所を取ったまま `invisible` にする。 */
function isDestinationLegendShown(): boolean {
  const figure = within(screen.getByRole("figure"));
  const legends = [
    figure.queryByText("注げる"),
    figure.queryByText("注げない"),
  ];
  return legends.every(
    (legend) => legend !== null && legend.closest(".invisible") === null,
  );
}

function getBottle(position: number): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^ボトル ${position}:`),
  });
}

function readBottleNames(): (string | null)[] {
  return screen
    .getAllByRole("button", { name: /^ボトル/ })
    .map((button) => button.getAttribute("aria-label"));
}

/** 押す所の手がかりを付けたボトルの番号（1から）。 */
function readHintedBottle(): number | null {
  const hint = document
    .querySelector("[data-hinted-bottle]")
    ?.getAttribute("data-hinted-bottle");
  return hint === undefined || hint === null ? null : Number(hint) + 1;
}

function isResetVisible(): boolean {
  return !screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

/** 鳴らした通らない音の数と、注いだ泡の音の数。 */
function countSounds(): { invalid: number; poured: number } {
  return {
    invalid: vi
      .mocked(playSound)
      .mock.calls.filter(([sound]) =>
        (sound as SoundEffect & { url: string }).url.includes("invalid"),
      ).length,
    poured: vi.mocked(playLayeredSound).mock.calls.length,
  };
}

describe("TouchableExample", () => {
  describe("どこに注げるかの例の場合", () => {
    const initialBottles = [
      "ボトル 1: 青、赤",
      "ボトル 2: 緑、赤",
      "ボトル 3: 緑、青",
      "ボトル 4: 空",
      "ボトル 5: 青、緑、赤、赤",
    ];
    const answers = [
      "ボトル 2: 注げる",
      "ボトル 3: 注げない",
      "ボトル 4: 注げる",
      "ボトル 5: 注げない",
    ];
    /** 各ボトルの答えと、✕ の真下のわけを、ボトルの順に読み上げる名前。 */
    const initialName =
      "ボトル 2: 注げる。ボトル 3: 注げない・色違い。ボトル 4: 注げる。ボトル 5: 注げない・満杯。";

    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={pourDestinationExample}
          caption={{ kind: "destinations" }}
        />,
      );
    });

    test("左のボトルを本番と同じく選んだ姿から始め、各ボトルの下に左のボトルから注げるかを添え、✓ の候補に押す所の手がかりを付けること", () => {
      const pressed = getBottle(1).getAttribute("aria-pressed");
      const shown = readDestinationAnswers();
      const hinted = readHintedBottle();

      expect(pressed).toBe("true");
      expect(shown).toEqual(answers);
      expect(hinted).toBe(2);
    });

    test("押す前から、各 ✕ の真下に注げないわけを添えること", () => {
      const figure = queryFigure(initialName);

      expect(figure).not.toBeNull();
    });

    test("各ボトルの答えの下に、✓ と ✕ の言葉を1行で添えること", () => {
      const legendShown = isDestinationLegendShown();

      expect(legendShown).toBe(true);
    });

    describe.each([
      {
        destination: 2,
        bottlesAfterPour: [
          "ボトル 1: 青",
          "ボトル 2: 緑、赤、赤",
          "ボトル 3: 緑、青",
          "ボトル 4: 空",
          "ボトル 5: 青、緑、赤、赤",
        ],
      },
      {
        destination: 4,
        bottlesAfterPour: [
          "ボトル 1: 青",
          "ボトル 2: 緑、赤",
          "ボトル 3: 緑、青",
          "ボトル 4: 赤",
          "ボトル 5: 青、緑、赤、赤",
        ],
      },
    ])(
      "✓ の $destination 本目を押した場合",
      ({ destination, bottlesAfterPour }) => {
        test("本番と同じく注いで泡の音を鳴らし、選ぶのをやめるので答え・わけ・手がかり・凡例を消して、注いだボトルにだけ注げたことを添え、元に戻すを出すこと", () => {
          fireEvent.click(getBottle(destination));

          const bottles = readBottleNames();
          const pressed = getBottle(1).getAttribute("aria-pressed");
          const shown = readDestinationAnswers();
          const figure = queryFigure(`ボトル ${destination}: 注げた。`);
          const hinted = readHintedBottle();
          const sounds = countSounds();
          const resetVisible = isResetVisible();
          const legendShown = isDestinationLegendShown();

          expect(bottles).toEqual(bottlesAfterPour);
          expect(pressed).toBe("false");
          expect(shown).toEqual([`ボトル ${destination}: 注げた`]);
          expect(figure).not.toBeNull();
          expect(legendShown).toBe(false);
          expect(hinted).toBeNull();
          expect(sounds).toEqual({ invalid: 0, poured: 1 });
          expect(resetVisible).toBe(true);
        });
      },
    );

    test.each([3, 5])(
      "✕ の %i 本目を押すと、本番と同じく押したボトルが揺れて通らない音を鳴らし、選んだまま盤面・答え・わけを変えず、手がかりを消すこと",
      (destination) => {
        fireEvent.click(getBottle(destination));

        const shaken = animate.mock.contexts.includes(getBottle(destination));
        const pressed = getBottle(1).getAttribute("aria-pressed");
        const bottles = readBottleNames();
        const sounds = countSounds();
        const figure = queryFigure(initialName);
        const hinted = readHintedBottle();

        expect(shaken).toBe(true);
        expect(pressed).toBe("true");
        expect(bottles).toEqual(initialBottles);
        expect(sounds).toEqual({ invalid: 1, poured: 0 });
        expect(figure).not.toBeNull();
        expect(hinted).toBeNull();
      },
    );

    describe("✕ のボトルで弾かれた場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(3));
      });

      test("左のボトルを押して選ぶのをやめると、答えとわけを消し、手がかりを左のボトルに戻すこと", () => {
        fireEvent.click(getBottle(1));

        const unnamed = queryFigure("");
        const hinted = readHintedBottle();

        expect(unnamed).not.toBeNull();
        expect(hinted).toBe(1);
      });
    });

    test("左のボトルをもう一度押すと、選ぶのをやめて答えと凡例を消し、手がかりを左のボトルへ移すこと", () => {
      fireEvent.click(getBottle(1));

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const shown = readDestinationAnswers();
      const legendShown = isDestinationLegendShown();
      const hinted = readHintedBottle();

      expect(pressed).toBe("false");
      expect(shown).toEqual([]);
      expect(legendShown).toBe(false);
      expect(hinted).toBe(1);
    });

    describe("選ぶのをやめた場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(1));
      });

      test("ほかのボトルを選ぶと、そのボトルから各ボトルへ注げるかと注げないわけに替え、隣り合う ✕ のわけも1行に並べること", () => {
        fireEvent.click(getBottle(3));

        const figure = queryFigure(
          "ボトル 1: 注げない・色違い。ボトル 2: 注げない・色違い。ボトル 4: 注げる。ボトル 5: 注げない・満杯。",
        );

        expect(figure).not.toBeNull();
      });
    });

    describe("空のボトルへ注いだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(4));
      });

      test("ボトルを選び直すと、注いだ後の盤面で、そのボトルから各ボトルへ注げるかを凡例と添えること", () => {
        fireEvent.click(getBottle(2));

        const shown = readDestinationAnswers();
        const legendShown = isDestinationLegendShown();

        expect(legendShown).toBe(true);

        expect(shown).toEqual([
          "ボトル 1: 注げない",
          "ボトル 3: 注げない",
          "ボトル 4: 注げる",
          "ボトル 5: 注げない",
        ]);
      });
    });

    describe("注いでいる途中の場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(2));
      });

      test("遊び方を送ると、本番と同じ注ぐ動きを止めること", () => {
        const animations = animate.mock.results.map(({ value }) => value);
        fireEvent.scroll(document.body);

        const cancelled = animations.some(
          (animation) => vi.mocked(animation.cancel).mock.calls.length > 0,
        );

        expect(animations.length).toBeGreaterThan(0);
        expect(cancelled).toBe(true);
      });
    });

    describe("注いだ後の場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(2));
        vi.mocked(playLayeredSound).mockClear();
      });

      test("元に戻すと、左のボトルを選んだ最初の姿・答え・手がかりに戻り、音は鳴らさないこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        const bottles = readBottleNames();
        const pressed = getBottle(1).getAttribute("aria-pressed");
        const shown = readDestinationAnswers();
        const hinted = readHintedBottle();
        const sounds = countSounds();

        expect(bottles).toEqual(initialBottles);
        expect(pressed).toBe("true");
        expect(shown).toEqual(answers);
        expect(hinted).toBe(2);
        expect(sounds).toEqual({ invalid: 0, poured: 0 });
      });
    });
  });

  describe("いっぱいで、いちばん上の色も違うボトルが候補にある場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={{
            bottles: [[1, 0], [1, 2, 2, 2], []],
            selectedBottleIndex: 0,
          }}
          caption={{ kind: "destinations" }}
        />,
      );
    });

    test("わけを1つにし、満杯を先にすること", () => {
      const figure = queryFigure(
        "ボトル 2: 注げない・満杯。ボトル 3: 注げる。",
      );

      expect(figure).not.toBeNull();
    });
  });

  describe.each([
    {
      title: "1色でいっぱいの、選べない例",
      example: completeRuleExamples[1],
      rule: "complete",
    },
    {
      title: "どこにも注げない例",
      example: destinationRuleExamples[1],
      rule: "no-destination",
    },
  ] as const)("$title の場合", ({ example, rule }) => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={example}
          caption={{ kind: "selection", rule }}
        />,
      );
    });

    test("触る前は、左のボトルに押す所の手がかりを付けること", () => {
      const hinted = readHintedBottle();

      expect(hinted).toBe(1);
    });

    test("手がかりを付けた左のボトルを押して弾かれると、手の続きが無いので手がかりを消し、✕ 選べない のままにすること", () => {
      fireEvent.click(getBottle(1));

      const hinted = readHintedBottle();
      const figure = queryFigure("選べない");

      expect(hinted).toBeNull();
      expect(figure).not.toBeNull();
    });
  });

  describe("1色でいっぱいの、選べる例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={completeRuleExamples[0]}
          caption={{ kind: "selection", rule: "complete" }}
        />,
      );
    });

    test("選ぶ前に右の空のボトルを押すと、本番と同じく選べずに弾かれ、✕ 選べない に、教えるルールと別のわけの、空っぽであることを添え、左のボトルの手がかりを消すこと", () => {
      fireEvent.click(getBottle(2));

      const figure = queryFigure("選べない・空っぽ");
      const hinted = readHintedBottle();

      expect(figure).not.toBeNull();
      expect(hinted).toBeNull();
    });

    test("注ぐと、上に続く赤が空のボトルへ移り、試した手の結果として ✓ 選べた にすること", () => {
      fireEvent.click(getBottle(1));
      fireEvent.click(getBottle(2));

      const bottles = readBottleNames();
      const figure = queryFigure("選べた");

      expect(bottles).toEqual(["ボトル 1: 青", "ボトル 2: 赤、赤、赤"]);
      expect(figure).not.toBeNull();
    });

    describe("選ぶ前に右の空のボトルを押して弾かれた場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(2));
      });

      test("左のボトルを選ぶと、✓ 選べる に戻し、手がかりを注ぎ先に付けること", () => {
        fireEvent.click(getBottle(1));

        const figure = queryFigure("選べる");
        const hinted = readHintedBottle();

        expect(figure).not.toBeNull();
        expect(hinted).toBe(2);
      });

      test("注ぐボトルを選び直すと、弾かれた ✕ を消して ✓ 選べる に戻すこと", () => {
        fireEvent.click(getBottle(1));
        fireEvent.click(getBottle(1));

        const figure = queryFigure("選べる");

        expect(figure).not.toBeNull();
      });
    });

    describe("注いだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getBottle(1));
        fireEvent.click(getBottle(2));
      });

      test("今の盤面では選べないボトルを押すと、その手の結果の ✕ 選べない にすること", () => {
        fireEvent.click(getBottle(2));

        const figure = queryFigure("選べない・どこにも注げない");

        expect(figure).not.toBeNull();
      });
    });
  });

  describe("どこにも注げない例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={destinationRuleExamples[1]}
          caption={{ kind: "selection", rule: "no-destination" }}
        />,
      );
    });

    test("触る前は ✕ 選べない を添え、教えるルールで注げないのでわけは添えないこと", () => {
      const figure = queryFigure("選べない");

      expect(figure).not.toBeNull();
    });

    test("注ぐボトルを押すと、本番と同じく選べずに揺れて通らない音を鳴らすこと", () => {
      fireEvent.click(getBottle(1));

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const shaken = animate.mock.contexts.includes(getBottle(1));
      const sounds = countSounds();

      expect(pressed).toBe("false");
      expect(shaken).toBe(true);
      expect(sounds).toEqual({ invalid: 1, poured: 0 });
    });
  });

  describe("注げるボトルがある例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={destinationRuleExamples[0]}
          caption={{ kind: "selection", rule: "no-destination" }}
        />,
      );
    });

    test("注ぐボトルを押すと、本番と同じく選べること", () => {
      fireEvent.click(getBottle(1));

      const pressed = getBottle(1).getAttribute("aria-pressed");

      expect(pressed).toBe("true");
    });
  });

  describe("動きを減らす設定で、1色でいっぱいの例を押した場合", () => {
    beforeEach(() => {
      // 本番の盤面と効果音は、どちらも画面の設定から動きを減らすかを読む。
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      renderInPanel(
        <TouchableExample
          example={completeRuleExamples[1]}
          caption={{ kind: "selection", rule: "complete" }}
        />,
      );
    });

    test("本番と同じく揺らさず、画面が何も変わらないので通らない音も鳴らさないこと", () => {
      fireEvent.click(getBottle(1));

      const shaken = animate.mock.contexts.includes(getBottle(1));
      const sounds = countSounds();

      expect(shaken).toBe(false);
      expect(sounds).toEqual({ invalid: 0, poured: 0 });
    });
  });

  describe("1色でいっぱいの、選べない例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={completeRuleExamples[1]}
          caption={{ kind: "selection", rule: "complete" }}
        />,
      );
    });

    test("空のボトルがあっても、本番と同じく選べずに揺れること", () => {
      fireEvent.click(getBottle(1));

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const sounds = countSounds();

      expect(pressed).toBe("false");
      expect(sounds).toEqual({ invalid: 1, poured: 0 });
    });
  });

  describe.each([
    {
      example: amountRuleExamples[0],
      amount: "2つとも入る",
      bottlesAfterPour: ["ボトル 1: 青", "ボトル 2: 赤、赤"],
    },
    {
      example: amountRuleExamples[1],
      amount: "1つだけ入る",
      bottlesAfterPour: ["ボトル 1: 青、赤", "ボトル 2: 緑、緑、赤、赤"],
    },
  ])(
    "入るだけまとめて注ぐ例（$amount）の場合",
    ({ example, amount, bottlesAfterPour }) => {
      beforeEach(() => {
        renderInPanel(
          <TouchableExample example={example} caption={{ kind: "amount" }} />,
        );
      });

      test("注ぐ前に、本番で入る量と、上に続く同じ色が全部入るかを添えること", () => {
        const figure = queryFigure(amount);

        expect(figure).not.toBeNull();
      });

      test("注ぐと本番と同じ量だけ移り、注いだ後も入った量を添えたままにすること", () => {
        fireEvent.click(getBottle(1));
        fireEvent.click(getBottle(2));

        const figure = queryFigure(amount);
        const bottles = readBottleNames();

        expect(figure).not.toBeNull();
        expect(bottles).toEqual(bottlesAfterPour);
      });

      describe("注いだ場合", () => {
        beforeEach(() => {
          fireEvent.click(getBottle(1));
          fireEvent.click(getBottle(2));
        });

        test("左のボトルを押して弾かれても、入った量を添えたままにすること", () => {
          fireEvent.click(getBottle(1));

          const figure = queryFigure(amount);

          expect(figure).not.toBeNull();
        });
      });
    },
  );

  describe("操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={pourOperationExample} />);
    });

    test("言葉を添えないこと", () => {
      const caption = within(screen.getByRole("figure")).queryByText(/./);

      expect(caption).toBeNull();
    });
  });
});
