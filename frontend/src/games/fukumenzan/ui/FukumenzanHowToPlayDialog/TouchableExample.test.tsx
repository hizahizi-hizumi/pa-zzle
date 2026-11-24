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
  crossedCardPlaceOperationExample,
  crossOperationExample,
  crossShownOperationExample,
  type FukumenzanHowToPlayExample,
  leadingZeroRuleExamples,
  miscalculationLineRuleExample,
  moveOperationExample,
  placeOperationExample,
  replaceOperationExample,
  returnOperationExample,
  sameLetterRuleExample,
  sumRuleExamples,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { TouchableExample } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/TouchableExample";
import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
} from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/** クリア演出の動き。すぐ終える。 */
const animate = vi.fn(function createFinishedAnimation(): Animation {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
  } as unknown as Animation;
});

beforeEach(() => {
  animate.mockClear();
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
  Reflect.deleteProperty(document, "elementFromPoint");
});

const touch = { pointerType: "touch", button: 0, isPrimary: true };

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

function renderExample(example: FukumenzanHowToPlayExample): void {
  renderInPanel(<TouchableExample example={example} />);
}

function getFigures(): HTMLElement[] {
  return screen.getAllByRole("figure");
}

function getEquation(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "式" }));
}

function getCardRow(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "札" }));
}

/** 文字の最初の場所。 */
function getLetter(name: string): HTMLElement {
  return getEquation().getAllByRole("button", { name })[0]!;
}

function listCardNames(): (string | null)[] {
  return getCardRow()
    .getAllByRole("button")
    .map((card) => card.getAttribute("aria-label"));
}

/** 手がかりを重ねた押す所の読み上げ名。手がかりが無ければ `null`。 */
function readHintTarget(): string | null {
  const hint = document.querySelector("[data-how-to-play-press-hint]");
  return hint?.closest("button")?.getAttribute("aria-label") ?? null;
}

/** 鳴らした1つの音の名前を、鳴らした順に並べる。 */
function listPlayedSounds(): (string | undefined)[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(
      ([sound]) => (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
    );
}

function pressCard(name: string): void {
  fireEvent.click(getCardRow().getByRole("button", { name }));
}

/** 例の下の言葉。判定の例では判定と、添えたわけ。 */
function readVerdict(): string {
  let caption = "";
  screen.getByRole("figure", {
    name: (name) => {
      caption = name;
      return true;
    },
  });
  return caption;
}

function isResetShown(): boolean {
  return !screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

function hasClassTokens(element: Element, classNames: string): boolean {
  return classNames
    .split(" ")
    .every((token) => element.querySelector(`[class~="${token}"]`) !== null);
}

/** 指で運んで、落とし先の上で離す。落とし先は指の下の要素として返す。 */
function dragByTouch(source: HTMLElement, target: HTMLElement): void {
  document.elementFromPoint = vi.fn((x: number, y: number) =>
    x === 100 && y === 200 ? target : null,
  );
  fireEvent.pointerDown(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 500,
  });
  fireEvent.pointerMove(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 200,
  });
  fireEvent.pointerUp(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 200,
  });
}

describe("TouchableExample", () => {
  describe("札を入れる例の場合", () => {
    beforeEach(() => {
      renderExample(placeOperationExample);
    });

    test("触る前は札の並びの 5〜9 の段だけを見せ、8 の札に手がかりを付けること", () => {
      expect([listCardNames(), readHintTarget()]).toEqual([
        ["5 の札", "6 の札", "7 の札", "8 の札", "9 の札"],
        "8 の札",
      ]);
    });

    test("札を押すと手がかりを D へ移すこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));

      expect(readHintTarget()).toBe("D");
    });

    describe("札を押してから D を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
        fireEvent.click(getLetter("D"));
      });

      test("D の全部の場所に 8 が入り、手がかりを消すこと", () => {
        expect([
          getEquation().getAllByRole("button", { name: "D に 8" }).length,
          readHintTarget(),
        ]).toEqual([4, null]);
      });

      test("本番と同じく札を入れる音を鳴らすこと", () => {
        expect(listPlayedSounds()).toEqual(["placed"]);
      });

      test("元に戻すと、触る前の姿と手がかりに戻ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        expect([
          getEquation().queryAllByRole("button", { name: "D に 8" }).length,
          readHintTarget(),
        ]).toEqual([0, "8 の札"]);
      });
    });

    test("札を D へ運ぶと D の全部の場所に入ること", () => {
      dragByTouch(
        getCardRow().getByRole("button", { name: "8 の札" }),
        getEquation().getAllByRole("button", { name: "D" })[1]!,
      );

      expect(
        getEquation().getAllByRole("button", { name: "D に 8" }),
      ).toHaveLength(4);
    });

    test("押すだけの空の文字では指のスクロールを止めず、札では止めること", () => {
      expect([
        getLetter("D").classList.contains("touch-manipulation"),
        getCardRow()
          .getByRole("button", { name: "8 の札" })
          .classList.contains("touch-none"),
      ]).toEqual([true, true]);
    });
  });

  test("ほかの例の文字の上で離しても札を入れないこと", () => {
    render(
      <>
        <HowToPlayExamplePanel resettable>
          <TouchableExample example={placeOperationExample} />
        </HowToPlayExamplePanel>
        <HowToPlayExamplePanel resettable>
          <TouchableExample example={placeOperationExample} />
        </HowToPlayExamplePanel>
      </>,
    );
    const [first, second] = getFigures();

    dragByTouch(
      getCardRow(first).getByRole("button", { name: "8 の札" }),
      getEquation(second).getAllByRole("button", { name: "D" })[0]!,
    );

    expect(screen.queryAllByRole("button", { name: "D に 8" })).toEqual([]);
  });

  describe("同じ文字のルールの例の場合", () => {
    beforeEach(() => {
      renderExample(sameLetterRuleExample);
    });

    test("空の式から始め、8 の札に手がかりを付け、起きたことはまだ言わないこと", () => {
      expect([
        getEquation().queryAllByRole("button", { name: / に / }).length,
        readHintTarget(),
        readVerdict(),
      ]).toEqual([0, "8 の札", ""]);
    });

    describe("1つ目の手（8 を D へ）を打った場合", () => {
      beforeEach(() => {
        dragByTouch(
          getCardRow().getByRole("button", { name: "8 の札" }),
          getLetter("D"),
        );
      });

      test("D の全部の場所に 8 が入ったと言い、2つ目の手の D に手がかりを移すこと", () => {
        expect([
          getEquation().getAllByRole("button", { name: "D に 8" }).length,
          readVerdict(),
          readHintTarget(),
        ]).toEqual([4, "4つの D に 8 が入る", "D に 8"]);
      });

      test("2つ目の手（D の 8 を E へ）を打つと、D が空いたと言い、手がかりを消すこと", () => {
        dragByTouch(getLetter("D に 8"), getLetter("E"));

        expect([
          getEquation().getAllByRole("button", { name: "D" }).length,
          getEquation().getAllByRole("button", { name: "E に 8" }).length,
          readVerdict(),
          readHintTarget(),
        ]).toEqual([4, 1, "8 が E へ移り D が空く", null]);
      });
    });
  });

  describe("線の例の場合", () => {
    beforeEach(() => {
      renderExample(miscalculationLineRuleExample);
    });

    test("触る前は線が無いことを言い、0 の札に手がかりを付けること", () => {
      expect([readVerdict(), readHintTarget()]).toEqual([
        "一の位が空いていて線が出ない",
        "0 の札",
      ]);
    });

    test("U に 0 を入れると、十の位に本番と同じ線を引き、線が出たと言うこと", () => {
      pressCard("0 の札");
      fireEvent.click(getLetter("U"));

      expect([
        hasClassTokens(
          getLetter("D に 8").closest("[role=group]")!,
          fukumenzanToneClassNames.noticeLine,
        ),
        readVerdict(),
      ]).toEqual([true, "十の位の答えの下に線が出る"]);
    });
  });

  describe("札の入った文字へ別の札を入れる例の場合", () => {
    beforeEach(() => {
      renderExample(replaceOperationExample);
    });

    test("触る前は 8 の札に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("8 の札");
    });

    test("8 を D に入れると、前の 6 が札の並びへ戻ること", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
      fireEvent.click(getLetter("D に 6"));

      expect([
        getEquation().getAllByRole("button", { name: "D に 8" }).length,
        getCardRow().queryByRole("button", { name: "6 の札" }) !== null,
      ]).toEqual([4, true]);
    });
  });

  test("文字に入った札を別の文字へ運ぶと、元の文字が空になること", () => {
    renderExample(moveOperationExample);

    dragByTouch(getLetter("U に 8"), getLetter("D"));

    expect([
      getEquation().getAllByRole("button", { name: "D に 8" }).length,
      getEquation().getAllByRole("button", { name: "U" }).length,
    ]).toEqual([4, 2]);
  });

  describe("札を戻す例の場合", () => {
    beforeEach(() => {
      renderExample(returnOperationExample);
    });

    test("触る前は D に手がかりを付け、D を押すと空いた場所へ移すこと", () => {
      const before = readHintTarget();
      fireEvent.click(getLetter("D に 8"));

      expect([before, readHintTarget()]).toEqual(["D に 8", "8 の札の場所"]);
    });

    test("D を押してから空いた場所を押すと、札が並びへ戻ること", () => {
      fireEvent.click(getLetter("D に 8"));
      fireEvent.click(
        getCardRow().getByRole("button", { name: "8 の札の場所" }),
      );

      expect([
        getEquation().queryAllByRole("button", { name: "D に 8" }).length,
        getCardRow().queryByRole("button", { name: "8 の札" }) !== null,
      ]).toEqual([0, true]);
    });

    test("D から札の並びへ運ぶと、札が並びへ戻ること", () => {
      dragByTouch(
        getLetter("D に 8"),
        getCardRow().getByRole("button", { name: "7 の札" }),
      );

      expect(
        getEquation().queryAllByRole("button", { name: "D に 8" }),
      ).toEqual([]);
    });
  });

  describe("× を付け外しする例の場合", () => {
    beforeEach(() => {
      renderExample(crossOperationExample);
    });

    test("触る前は U に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("U");
    });

    test("U を押してから 5 の札を押すと × が付き、もう一度押すと外れること", () => {
      fireEvent.click(getLetter("U"));
      fireEvent.click(getCardRow().getByRole("button", { name: "5 の札" }));
      const crossed = getCardRow().queryByRole("button", {
        name: "5 の札（×）",
      });
      fireEvent.click(crossed!);

      expect([
        crossed !== null,
        getCardRow().queryByRole("button", { name: "5 の札（×）" }),
      ]).toEqual([true, null]);
    });
  });

  describe("× を付けた文字を選ぶ例の場合", () => {
    beforeEach(() => {
      renderExample(crossShownOperationExample);
    });

    test("0〜9 の札を全部見せ、U に手がかりを付けること", () => {
      expect([listCardNames().length, readHintTarget()]).toEqual([
        10,
        "U（候補 7）",
      ]);
    });

    test("U を押すと × を付けた札に × を出し、2つ目の手としてもう一度 U に手がかりを付けること", () => {
      fireEvent.click(getLetter("U（候補 7）"));

      expect([
        listCardNames().filter((name) => name?.endsWith("（×）")),
        readHintTarget(),
      ]).toEqual([
        ["5 の札（×）", "6 の札（×）", "7 の札（×）"],
        "U（候補 7）",
      ]);
    });

    test("U をもう一度押すと、選ぶのをやめて × を消すこと", () => {
      fireEvent.click(getLetter("U（候補 7）"));
      fireEvent.click(getLetter("U（候補 7）"));

      expect(listCardNames().filter((name) => name?.endsWith("（×）"))).toEqual(
        [],
      );
    });

    test("U を選んで式と札の外を押すと、選ぶのをやめて × を消すこと", () => {
      fireEvent.click(getLetter("U（候補 7）"));
      fireEvent.pointerDown(document.body);

      expect(listCardNames().filter((name) => name?.endsWith("（×）"))).toEqual(
        [],
      );
    });

    describe("札を入れて式を解いた場合", () => {
      beforeEach(() => {
        for (const [digit, letter] of [
          ["1", "M"],
          ["9", "R"],
          ["8", "D"],
          ["2", "E"],
          ["0", "U（候補 7）"],
        ] as const) {
          pressCard(`${digit} の札`);
          fireEvent.click(getLetter(letter));
        }
      });

      test("本番と同じく答えの桁を跳ねさせ、クリアの音を鳴らすこと", () => {
        expect([
          animate.mock.calls.length > 0,
          vi.mocked(playLayeredSound).mock.calls.length,
        ]).toEqual([true, 1]);
      });

      test("それからは札を押しても受け付けないこと", () => {
        const sounds = listPlayedSounds().length;
        fireEvent.click(getLetter("M に 1"));
        fireEvent.click(
          getCardRow().getByRole("button", { name: "1 の札の場所" }),
        );

        expect([
          getEquation().getAllByRole("button", { name: "M に 1" }).length,
          listPlayedSounds().length,
        ]).toEqual([2, sounds]);
      });
    });
  });

  describe("× を付けた札を入れる例の場合", () => {
    beforeEach(() => {
      renderExample(crossedCardPlaceOperationExample);
    });

    test("触る前は U に、U を選ぶと × の付いた 8 の札に手がかりを付けること", () => {
      const before = readHintTarget();
      fireEvent.click(getLetter("U（候補 9）"));

      expect([before, readHintTarget()]).toEqual([
        "U（候補 9）",
        "8 の札（×）",
      ]);
    });

    test("U を選んだまま × の付いた 8 を U へ運ぶと入り、手がかりを消すこと", () => {
      fireEvent.click(getLetter("U（候補 9）"));
      dragByTouch(
        getCardRow().getByRole("button", { name: "8 の札（×）" }),
        getLetter("U（候補 9）"),
      );

      expect([
        getEquation().getAllByRole("button", { name: "U に 8" }).length,
        readHintTarget(),
      ]).toEqual([2, null]);
    });
  });

  describe("先頭の0のできる形の例の場合", () => {
    beforeEach(() => {
      renderExample(leadingZeroRuleExamples[0]);
    });

    test("触る前はできると言い、0 を入れる手の 0 の札に手がかりを付けること", () => {
      expect([readVerdict(), readHintTarget()]).toEqual(["できる", "0 の札"]);
    });

    test("手がかりのとおり D に 0 を入れると、D の札を本番と同じ赤で描き、できないとわけを言うこと", () => {
      pressCard("0 の札");
      fireEvent.click(getLetter("D に 8"));

      expect([
        getEquation()
          .getAllByRole("button", { name: "D に 0" })
          .some((tile) =>
            hasClassTokens(tile, fukumenzanToneClassNames.notice),
          ),
        readVerdict(),
        readHintTarget(),
      ]).toEqual([true, "できない・いちばん左が0", null]);
    });
  });

  describe("足し算の合う形の例の場合", () => {
    beforeEach(() => {
      renderExample(sumRuleExamples[0]);
    });

    test("触る前は合うと言い、7 の札に手がかりを付けること", () => {
      expect([readVerdict(), readHintTarget()]).toEqual(["合う", "7 の札"]);
    });

    test("手がかりのとおり R に 7 を入れると、十の位に本番と同じ線を引き、合わないとわけを言うこと", () => {
      pressCard("7 の札");
      fireEvent.click(getLetter("R に 9"));

      expect([
        hasClassTokens(
          getLetter("D に 8").closest("[role=group]")!,
          fukumenzanToneClassNames.noticeLine,
        ),
        readVerdict(),
      ]).toEqual([true, "合わない・十の位が合わない"]);
    });
  });

  describe("できない形の例の場合", () => {
    test("先頭の0の例は、手がかりを付けず、D の 0 を本番と同じ赤で描いて、できないとわけを言うこと", () => {
      renderExample(leadingZeroRuleExamples[1]);

      expect([
        getEquation()
          .getAllByRole("button", { name: "D に 0" })
          .some((tile) =>
            hasClassTokens(tile, fukumenzanToneClassNames.notice),
          ),
        readVerdict(),
        readHintTarget(),
      ]).toEqual([true, "できない・いちばん左が0", null]);
    });

    test("足し算の例は、手がかりを付けず、十の位に本番と同じ線を引いて、合わないとわけを言うこと", () => {
      renderExample(sumRuleExamples[1]);

      expect([
        hasClassTokens(
          getLetter("D に 8").closest("[role=group]")!,
          fukumenzanToneClassNames.noticeLine,
        ),
        readVerdict(),
        readHintTarget(),
      ]).toEqual([true, "合わない・十の位が合わない", null]);
    });
  });

  test("先頭の0の例で足し算の線が出ると、別のルールのわけを言うこと", () => {
    renderExample(leadingZeroRuleExamples[0]);
    for (const [digit, letter] of [
      ["2", "E"],
      ["3", "U"],
    ] as const) {
      pressCard(`${digit} の札`);
      fireEvent.click(getLetter(letter));
    }

    expect(readVerdict()).toBe(
      "できる・足し算の合わない桁に赤い線が出ています",
    );
  });

  describe("クリアしない例", () => {
    test.each([
      ["先頭の0", leadingZeroRuleExamples[0], "0 の札", "D に 8"],
      ["足し算", sumRuleExamples[0], "7 の札", "R に 9"],
    ] as const)(
      "%s のできる形は、触る前も手がかりの手を打った後もクリアの演出と音を出さないこと",
      (_, example, card, letter) => {
        renderExample(example);
        pressCard(card);
        fireEvent.click(getLetter(letter));

        expect([
          animate.mock.calls.length,
          vi.mocked(playLayeredSound).mock.calls.length,
        ]).toEqual([0, 0]);
      },
    );
  });

  describe("音", () => {
    test("× を付けると付ける音を、外すと外す音を鳴らすこと", () => {
      renderExample(crossOperationExample);
      fireEvent.click(getLetter("U"));
      pressCard("5 の札");
      pressCard("5 の札（×）");

      expect(listPlayedSounds()).toEqual(["crossed", "uncrossed"]);
    });

    test("札を列へ戻すと戻す音を鳴らすこと", () => {
      renderExample(returnOperationExample);
      fireEvent.click(getLetter("D に 8"));
      pressCard("8 の札の場所");

      expect(listPlayedSounds()).toEqual(["returned"]);
    });
  });

  describe("元に戻すボタン", () => {
    const examples = {
      札を入れる: placeOperationExample,
      同じ文字: sameLetterRuleExample,
      入れ替える: replaceOperationExample,
      運ぶ: moveOperationExample,
      戻す: returnOperationExample,
      "× を付ける": crossOperationExample,
      "× を出す": crossShownOperationExample,
      "× の札を入れる": crossedCardPlaceOperationExample,
      線: miscalculationLineRuleExample,
      先頭の0: leadingZeroRuleExamples[0],
      先頭の0のできない形: leadingZeroRuleExamples[1],
      足し算: sumRuleExamples[0],
      足し算のできない形: sumRuleExamples[1],
    } as const satisfies Record<string, FukumenzanHowToPlayExample>;

    test.each(Object.entries(examples))(
      "%s の例では、触る前は押せず、盤面を変えると押せること",
      (_, example) => {
        renderExample(example);
        const before = isResetShown();
        fireEvent.click(
          getCardRow().getAllByRole("button", { name: /の札$/ })[0]!,
        );
        fireEvent.click(
          getEquation().getAllByRole("button", { name: /^[A-Z]/ })[0]!,
        );

        expect([before, isResetShown()]).toEqual([false, true]);
      },
    );
  });
});
